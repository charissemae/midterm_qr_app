import { supabase } from './supabase';
import { isMissingColumnError } from './dbErrors';
import { parseQRPayload } from './qr';
import { getEventByCode } from './events';
import { getProfile, ensureProfile } from './profiles';
import { toLocalDateString, toLocalTimeString } from './datetime';

export type AttendanceStatus = 'present' | 'late' | 'absent';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
  status: AttendanceStatus;
  attendanceDate: string | null;
  attendanceTime: string | null;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
  status?: AttendanceStatus;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
  attendees: {
    studentId: string;
    studentName: string | null;
    scannedAt: string;
    status: AttendanceStatus;
  }[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

const DEFAULT_LATE_THRESHOLD_MINUTES = 10;

// A scan is "late" when it lands after the event start plus the late
// threshold of the event (10 minutes by default).
function computeAttendanceStatus(
  event: { start_time?: string | null; late_threshold_minutes?: number | null },
  scannedAt: Date
): AttendanceStatus {
  const start = event.start_time ? new Date(event.start_time).getTime() : null;
  if (!start || Number.isNaN(start)) return 'present';
  const threshold =
    (event.late_threshold_minutes ?? DEFAULT_LATE_THRESHOLD_MINUTES) * 60 * 1000;
  return scannedAt.getTime() > start + threshold ? 'late' : 'present';
}

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) {
    return { success: false, message: parsed.message };
  }
  const payload = parsed.payload;

  try {
    // 1. Only student accounts may record attendance. A teacher or an
    //    administrator scanning the code must not create a record.
    let profile = await getProfile(studentId);
    if (!profile) {
      // The profile row can be missing (signup trigger race). Recreate it
      // with the account email so the role lookup works afterwards.
      const { data: authData } = await supabase.auth.getUser();
      await ensureProfile(studentId, authData?.user?.email ?? null);
      profile = await getProfile(studentId);
    }
    if (!profile) {
      return {
        success: false,
        message:
          'Your account profile could not be loaded. Please sign out and sign in again.',
      };
    }
    if (profile.role !== 'student') {
      return {
        success: false,
        message: 'Only student accounts can record attendance.',
      };
    }

    // 2. The QR must belong to an event that really exists. The event is
    //    created by the teacher/admin first — scanning never creates one.
    const event = await getEventByCode(payload.event);
    if (!event) {
      return {
        success: false,
        message: 'This QR code does not match any event.',
      };
    }

    // 3. A closed event no longer accepts attendance.
    if (event.status === 'closed') {
      return {
        success: false,
        message: 'This event is closed. Attendance is no longer accepted.',
        eventTitle: event.title,
      };
    }

    // 4. The event must be running right now.
    const now = Date.now();
    const start = event.start_time ? new Date(event.start_time).getTime() : null;
    const end = event.end_time ? new Date(event.end_time).getTime() : null;

    if (start && now < start) {
      return {
        success: false,
        message: 'Event has not started yet.',
        eventTitle: event.title,
      };
    }
    if (end && now > end) {
      return {
        success: false,
        message: 'Event has already ended.',
        eventTitle: event.title,
      };
    }

    // Guard against double-recorded scans: check first so duplicates are
    // caught even when the `attendance` table has no unique constraint on
    // (student_id, event_id) yet. If the read fails, fall through to the
    // insert — the 23505 handler still catches duplicates when the
    // constraint exists.
    const { data: existing, error: preError } = await supabase
      .from('attendance')
      .select('id')
      .eq('student_id', studentId)
      .eq('event_id', event.id)
      .maybeSingle();

    if (!preError && existing) {
      return {
        success: false,
        message: 'Already registered for this event.',
        eventTitle: event.title,
      };
    }

    const scannedAt = new Date();
    const status = computeAttendanceStatus(event, scannedAt);

    const row = {
      student_id: studentId,
      event_id: event.id,
      status,
      attendance_date: toLocalDateString(scannedAt),
      attendance_time: toLocalTimeString(scannedAt),
    };

    let { data: insertedRows, error: attError } = await supabase
      .from('attendance')
      .insert([row])
      .select('id');

    // The status/date/time columns arrive with
    // sql/part1_minimum_features.sql. Fall back to the original columns so
    // the scan still works before that script has been run.
    if (attError && isMissingColumnError(attError)) {
      ({ data: insertedRows, error: attError } = await supabase
        .from('attendance')
        .insert([{ student_id: studentId, event_id: event.id }])
        .select('id'));
    }

    if (attError) {
      if (attError.code === '23505') {
        return {
          success: false,
          message: 'Already registered for this event.',
          eventTitle: event.title,
        };
      }
      return { success: false, message: attError.message, eventTitle: event.title };
    }

    if (!insertedRows || insertedRows.length === 0) {
      return {
        success: false,
        message:
          'Attendance was not recorded. Your account may not be allowed to scan. Please sign out and sign back in as a student account.',
      };
    }

    return {
      success: true,
      message:
        status === 'late'
          ? 'Attendance recorded (late).'
          : 'Attendance recorded!',
      eventTitle: event.title,
      status,
    };
  } catch {
    return {
      success: false,
      message: 'Network error. Please check your connection and try again.',
    };
  }
}

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  try {
    const fullSelect =
      'id, scanned_at, status, attendance_date, attendance_time, events ( event_code, title )';
    const legacySelect = 'id, scanned_at, events ( event_code, title )';

    let data: any = null;
    let error: any = null;

    ({ data, error } = await supabase
      .from('attendance')
      .select(fullSelect)
      .eq('student_id', studentId)
      .order('scanned_at', { ascending: false }));

    if (error && isMissingColumnError(error)) {
      ({ data, error } = await supabase
        .from('attendance')
        .select(legacySelect)
        .eq('student_id', studentId)
        .order('scanned_at', { ascending: false }));
    }

    if (error || !data) {
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      eventId: row.events?.event_code ?? '',
      eventTitle: row.events?.title ?? '',
      scannedAt: row.scanned_at,
      status: (row.status ?? 'present') as AttendanceStatus,
      attendanceDate: row.attendance_date ?? null,
      attendanceTime: row.attendance_time ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  try {
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('id, event_code, title, start_time, end_time')
      .eq('created_by', teacherId)
      .order('created_at', { ascending: false });

    if (eventError || !events) return [];

    const eventIds = events.map((e: any) => e.id);
    if (eventIds.length === 0) return [];

    const fullSelect = 'student_id, scanned_at, event_id, status';
    const legacySelect = 'student_id, scanned_at, event_id';

    let attendance: any = null;

    ({ data: attendance } = await supabase
      .from('attendance')
      .select(fullSelect)
      .in('event_id', eventIds)
      .order('scanned_at', { ascending: false }));

    if (!attendance) {
      const retry = await supabase
        .from('attendance')
        .select(legacySelect)
        .in('event_id', eventIds)
        .order('scanned_at', { ascending: false });
      attendance = retry.data;
    }

    const rows = attendance ?? [];

    let nameMap: Record<string, string | null> = {};
    try {
      const studentIds = Array.from(
        new Set(rows.map((a: any) => a.student_id))
      );
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', studentIds);
        (profiles ?? []).forEach((p: any) => {
          nameMap[p.id] = p.full_name ?? null;
        });
      }
    } catch {
      // names are optional; the attendee list/count must never depend on them
    }

    return events.map((e: any) => {
      const evRows = rows.filter((a: any) => a.event_id === e.id);
      return {
        eventId: e.id,
        eventCode: e.event_code,
        title: e.title,
        startTime: e.start_time,
        endTime: e.end_time,
        attendeeCount: evRows.length,
        attendees: evRows.map((a: any) => ({
          studentId: a.student_id,
          studentName: nameMap[a.student_id] ?? null,
          scannedAt: a.scanned_at,
          status: (a.status ?? 'present') as AttendanceStatus,
        })),
      };
    });
  } catch {
    return [];
  }
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  try {
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('id, event_code, title')
      .eq('created_by', teacherId)
      .order('created_at', { ascending: false });

    if (eventError || !events) return [];

    const eventIds = events.map((e: any) => e.id);
    if (eventIds.length === 0) return [];

    const { data: attendance } = await supabase
      .from('attendance')
      .select('event_id')
      .in('event_id', eventIds);

    const counts: Record<string, number> = {};
    (attendance ?? []).forEach((a: any) => {
      counts[a.event_id] = (counts[a.event_id] ?? 0) + 1;
    });

    return events.map((e: any) => ({
      eventId: e.id,
      eventCode: e.event_code,
      title: e.title,
      attendeeCount: counts[e.id] ?? 0,
    }));
  } catch {
    return [];
  }
}

export type AdminAttendanceRecord = {
  id: string;
  studentId: string;
  studentName: string | null;
  studentEmail: string | null;
  eventId: string;
  eventCode: string;
  eventTitle: string;
  scannedAt: string;
  status: AttendanceStatus;
  attendanceDate: string | null;
  attendanceTime: string | null;
};

// Every attendance row in the system (administrator view). Needs the admin
// RLS policies from supabase-admin-setup.sql.
export async function getAllAttendance(): Promise<AdminAttendanceRecord[]> {
  try {
    const fullSelect =
      'id, student_id, event_id, scanned_at, status, attendance_date, attendance_time, events ( event_code, title )';
    const legacySelect =
      'id, student_id, event_id, scanned_at, events ( event_code, title )';

    let data: any = null;
    let error: any = null;

    ({ data, error } = await supabase
      .from('attendance')
      .select(fullSelect)
      .order('scanned_at', { ascending: false }));

    if (error && isMissingColumnError(error)) {
      ({ data, error } = await supabase
        .from('attendance')
        .select(legacySelect)
        .order('scanned_at', { ascending: false }));
    }

    if (error || !data) return [];

    let nameMap: Record<string, { name: string | null; email: string | null }> = {};
    try {
      const studentIds = Array.from(new Set(data.map((r: any) => r.student_id)));
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', studentIds);
        (profiles ?? []).forEach((p: any) => {
          nameMap[p.id] = { name: p.full_name ?? null, email: p.email ?? null };
        });
      }
    } catch {
      // names are optional; the record list must never depend on them
    }

    return data.map((row: any) => ({
      id: row.id,
      studentId: row.student_id,
      studentName: nameMap[row.student_id]?.name ?? null,
      studentEmail: nameMap[row.student_id]?.email ?? null,
      eventId: row.event_id,
      eventCode: row.events?.event_code ?? '',
      eventTitle: row.events?.title ?? '',
      scannedAt: row.scanned_at,
      status: (row.status ?? 'present') as AttendanceStatus,
      attendanceDate: row.attendance_date ?? null,
      attendanceTime: row.attendance_time ?? null,
    }));
  } catch {
    return [];
  }
}

export async function deleteAttendanceRecord(
  recordId: string
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('id', recordId);
    return { error: error?.message ?? null };
  } catch (err: any) {
    return { error: err?.message ?? 'network error' };
  }
}

export async function updateAttendanceStatus(
  recordId: string,
  status: AttendanceStatus
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('attendance')
      .update({ status })
      .eq('id', recordId);

    if (error && isMissingColumnError(error)) {
      return {
        error:
          'The attendance status column is missing. Run sql/part1_minimum_features.sql in Supabase first.',
      };
    }

    return { error: error?.message ?? null };
  } catch (err: any) {
    return { error: err?.message ?? 'network error' };
  }
}

export async function addAttendanceRecord(input: {
  studentId: string;
  eventId: string;
  scannedAt?: string;
  status?: AttendanceStatus;
}): Promise<{ error: string | null }> {
  try {
    const scannedAt = input.scannedAt ? new Date(input.scannedAt) : new Date();
    const row = {
      student_id: input.studentId,
      event_id: input.eventId,
      scanned_at: scannedAt.toISOString(),
      status: input.status ?? ('present' as AttendanceStatus),
      attendance_date: toLocalDateString(scannedAt),
      attendance_time: toLocalTimeString(scannedAt),
    };

    const { error } = await supabase.from('attendance').insert([row]);

    if (error) {
      if (error.code === '23505') {
        return { error: 'That student already has a record for this event.' };
      }
      if (isMissingColumnError(error)) {
        const legacy = await supabase.from('attendance').insert([
          {
            student_id: input.studentId,
            event_id: input.eventId,
            scanned_at: row.scanned_at,
          },
        ]);
        if (!legacy.error) return { error: null };
        return { error: legacy.error.message };
      }
      return { error: error.message };
    }
    return { error: null };
  } catch (err: any) {
    return { error: err?.message ?? 'network error' };
  }
}
