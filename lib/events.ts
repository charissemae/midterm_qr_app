import { supabase } from './supabase';
import { isMissingColumnError } from './dbErrors';

// The stored status of an event. "open" accepts attendance, "closed" does not.
export type EventStatus = 'open' | 'closed';

// The lifecycle phase derived from the schedule. A closed event always
// reports as 'closed' no matter what the clock says.
export type EventPhase = 'upcoming' | 'ongoing' | 'ended' | 'closed';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
  venue?: string;
  description?: string;
  status?: EventStatus;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  venue?: string | null;
  description?: string | null;
  status?: EventStatus | null;
  late_threshold_minutes?: number | null;
  created_by: string | null;
  created_at: string;
};

export async function createEvent(
  event: Event
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const base = {
    event_code: event.eventId,
    title: event.title,
    start_time: event.start || null,
    end_time: event.end || null,
    created_by: user?.id ?? null,
  };

  const full = {
    ...base,
    venue: event.venue?.trim() || null,
    description: event.description?.trim() || null,
    status: event.status ?? ('open' as EventStatus),
  };

  let { error } = await supabase
    .from('events')
    .upsert(full, { onConflict: 'event_code' });

  // The venue/description/status columns arrive with
  // sql/part1_minimum_features.sql. Until that script has been run the
  // insert falls back to the original columns so event creation keeps
  // working instead of failing with "column does not exist".
  if (error && isMissingColumnError(error)) {
    ({ error } = await supabase
      .from('events')
      .upsert(base, { onConflict: 'event_code' }));
  }

  return { error: error?.message ?? null };
}

export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as CloudEvent[];
}

export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CloudEvent;
}

// "Close an event" / reopen it. A closed event refuses new attendance.
export async function setEventStatus(
  eventId: string,
  status: EventStatus
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('events')
      .update({ status })
      .eq('id', eventId);

    if (error) {
      if (isMissingColumnError(error)) {
        return {
          error:
            'The event status column is missing. Run sql/part1_minimum_features.sql in Supabase first.',
        };
      }
      return { error: error.message };
    }

    return { error: null };
  } catch (err: any) {
    return { error: err?.message ?? 'network error' };
  }
}

export function isEventClosed(event: {
  status?: EventStatus | null;
}): boolean {
  return event.status === 'closed';
}

export function getEventPhase(event: {
  start_time?: string | null;
  end_time?: string | null;
  status?: EventStatus | null;
}): EventPhase {
  if (isEventClosed(event)) return 'closed';

  const now = Date.now();
  const start = event.start_time ? new Date(event.start_time).getTime() : null;
  const end = event.end_time ? new Date(event.end_time).getTime() : null;

  if (start && now < start) return 'upcoming';
  if (end && now > end) return 'ended';
  return 'ongoing';
}

// Events any signed-in student can see: live events first, then upcoming,
// then ended. RLS lets every authenticated user read the events table.
export async function getAvailableEvents(): Promise<CloudEvent[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    const rank: Record<EventPhase, number> = {
      ongoing: 0,
      upcoming: 1,
      ended: 2,
      closed: 3,
    };

    return [...(data as CloudEvent[])].sort((a, b) => {
      const diff = rank[getEventPhase(a)] - rank[getEventPhase(b)];
      if (diff !== 0) return diff;
      const aStart = a.start_time ? new Date(a.start_time).getTime() : Number.MAX_SAFE_INTEGER;
      const bStart = b.start_time ? new Date(b.start_time).getTime() : Number.MAX_SAFE_INTEGER;
      return aStart - bStart;
    });
  } catch {
    return [];
  }
}

// Every event in the system (administrator view). Needs the admin RLS
// policies from supabase-admin-setup.sql to return rows created by others.
export async function getAllEvents(): Promise<CloudEvent[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as CloudEvent[];
  } catch {
    return [];
  }
}

export type EventUpdates = {
  title?: string;
  start_time?: string | null;
  end_time?: string | null;
  venue?: string | null;
  description?: string | null;
  status?: EventStatus;
};

export async function updateEvent(
  eventId: string,
  updates: EventUpdates
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId);

    if (error && isMissingColumnError(error)) {
      const legacy: EventUpdates = {};
      if (updates.title !== undefined) legacy.title = updates.title;
      if (updates.start_time !== undefined) legacy.start_time = updates.start_time;
      if (updates.end_time !== undefined) legacy.end_time = updates.end_time;
      const retry = await supabase
        .from('events')
        .update(legacy)
        .eq('id', eventId);
      return { error: retry.error?.message ?? null };
    }

    return { error: error?.message ?? null };
  } catch (err: any) {
    return { error: err?.message ?? 'network error' };
  }
}

export async function deleteEvent(eventId: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    return { error: error?.message ?? null };
  } catch (err: any) {
    return { error: err?.message ?? 'network error' };
  }
}
