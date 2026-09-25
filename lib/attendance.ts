import { supabase } from './supabase';
import { parseQRPayload } from './qr';
import { getEventByCode } from './events';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
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
  }[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) {
    return { success: false, message: parsed.message };
  }
  const payload = parsed.payload;

  const now = Date.now();
  const start = payload.start ? new Date(payload.start).getTime() : null;
  const end = payload.end ? new Date(payload.end).getTime() : null;

  if (start && now < start) {
    return { success: false, message: 'Event has not started yet.' };
  }
  if (end && now > end) {
    return { success: false, message: 'Event has already ended.' };
  }

  const title = payload.title ?? payload.event;

  try {
    let event: { id: string; title: string } | null = null;

    const foundEvent = await getEventByCode(payload.event);
    if (foundEvent) {
      event = foundEvent;
    } else {
      const { data: newEvent, error: insertError } = await supabase
        .from('events')
        .insert([
          {
            event_code: payload.event,
            title,
            start_time: payload.start ?? null,
            end_time: payload.end ?? null,
          },
        ])
        .select('id, title')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          const raced = await getEventByCode(payload.event);
          if (raced) {
            event = raced;
          } else {
            return { success: false, message: 'Could not create event.' };
          }
        } else {
          return { success: false, message: 'Could not create event.' };
        }
      } else {
        event = newEvent;
      }
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

    const { data: insertedRows, error: attError } = await supabase
      .from('attendance')
      .insert([
        {
          student_id: studentId,
          event_id: event.id,
        },
      ])
      .select('id');

    if (attError) {
      if (attError.code === '23505') {
        return {
          success: false,
          message: 'Already registered for this event.',
          eventTitle: event.title,
        };
      }
      return { success: false, message: attError.message };
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
      message: 'Attendance recorded!',
      eventTitle: event.title,
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
    const { data, error } = await supabase
      .from('attendance')
      .select('id, scanned_at, events ( event_code, title )')
      .eq('student_id', studentId)
      .order('scanned_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      eventId: row.events?.event_code ?? '',
      eventTitle: row.events?.title ?? '',
      scannedAt: row.scanned_at,
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

    const { data: attendance } = await supabase
      .from('attendance')
      .select('student_id, scanned_at, event_id')
      .in('event_id', eventIds)
      .order('scanned_at', { ascending: false });

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