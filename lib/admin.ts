import { supabase } from './supabase';
import { getAllEvents, type CloudEvent } from './events';
import type { Role } from './profiles';

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
};

// Every registered account. Needs the admin RLS policies from
// supabase-admin-setup.sql to return rows owned by other people.
export async function listUsers(): Promise<AdminUser[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as AdminUser[];
  } catch {
    return [];
  }
}

export async function setUserRole(
  userId: string,
  role: Role
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);
    return { error: error?.message ?? null };
  } catch (err: any) {
    return { error: err?.message ?? 'network error' };
  }
}

// Removes the account from Supabase Auth. Everything that belongs to it
// (profile, attendance rows) is removed by the database cascades. Runs
// through the security-definer function defined in supabase-admin-setup.sql.
export async function deleteUserAccount(userId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.rpc('admin_delete_user', {
      target: userId,
    });
    return { error: error?.message ?? null };
  } catch (err: any) {
    return { error: err?.message ?? 'network error' };
  }
}

export type EventStat = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

export type SystemStats = {
  totalUsers: number;
  students: number;
  teachers: number;
  admins: number;
  totalEvents: number;
  totalAttendance: number;
  todayAttendance: number;
  perEvent: EventStat[];
};

export async function getSystemStats(): Promise<SystemStats | null> {
  try {
    const [users, events] = await Promise.all([listUsers(), getAllEvents()]);

    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('event_id, scanned_at');

    if (attendanceError) return null;

    const rows = attendance ?? [];
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const counts: Record<string, number> = {};
    let todayAttendance = 0;
    rows.forEach((row: any) => {
      counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
      if (row.scanned_at && new Date(row.scanned_at).getTime() >= startOfDay.getTime()) {
        todayAttendance += 1;
      }
    });

    const perEvent: EventStat[] = (events as CloudEvent[])
      .map((event) => ({
        eventId: event.id,
        eventCode: event.event_code,
        title: event.title,
        attendeeCount: counts[event.id] ?? 0,
      }))
      .sort((a, b) => b.attendeeCount - a.attendeeCount);

    return {
      totalUsers: users.length,
      students: users.filter((u) => u.role === 'student').length,
      teachers: users.filter((u) => u.role === 'teacher').length,
      admins: users.filter((u) => u.role === 'admin').length,
      totalEvents: events.length,
      totalAttendance: rows.length,
      todayAttendance,
      perEvent,
    };
  } catch {
    return null;
  }
}
