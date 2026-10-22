-- ============================================================
-- QR-ATT — PART I #4 "Minimum Required Features" completion
--
-- Adds the pieces the individual final project was still missing:
--
--   events.venue                  -> Event "Venue"
--   events.description            -> Event "Description"
--   events.status                 -> Event "Status" (open / closed)
--                                    + "Close an event" support
--   events.late_threshold_minutes -> when a scan becomes "late"
--   attendance.status             -> Attendance "Status" (present / late / absent)
--   attendance.attendance_date    -> Attendance "Date"
--   attendance.attendance_time    -> Attendance "Time"
--
--   + trigger that stops unauthorised attendance recording
--     (teachers/admins cannot insert their own attendance, and
--      closed events reject new attendance rows)
--   + stricter RLS policy: only student accounts may insert attendance
--
-- HOW TO RUN:
--   1. Supabase Dashboard -> SQL Editor -> New query
--   2. Paste this ENTIRE file
--   3. Click "Run"
--
-- This script is IDEMPOTENT: it can be run more than once safely.
-- ============================================================

-- ------------------------------------------------------------
-- 0. PROFILES — allow the 'admin' role and apply the role that
--    was chosen on the Register screen.
--
--    The signup trigger reads the role from the signup metadata
--    (raw_user_meta_data) so an account created as Administrator
--    keeps that role even when email confirmation is required.
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    alter table public.profiles drop constraint if exists profiles_role_check;
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('student', 'teacher', 'admin'));
  end if;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  if v_role not in ('student', 'teacher', 'admin') then
    v_role := 'student';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    v_role
  )
  on conflict (id) do update
    set role = excluded.role,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1. EVENTS — venue, description, status, late threshold
-- ------------------------------------------------------------
alter table public.events add column if not exists venue text;
alter table public.events add column if not exists description text;
alter table public.events add column if not exists late_threshold_minutes integer;
alter table public.events add column if not exists status text not null default 'open';

update public.events set late_threshold_minutes = 10 where late_threshold_minutes is null;
alter table public.events alter column late_threshold_minutes set default 10;

update public.events set status = 'open' where status is null;

alter table public.events drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check
  check (status in ('open', 'closed'));

-- ------------------------------------------------------------
-- 2. ATTENDANCE — status, date, time
-- ------------------------------------------------------------
alter table public.attendance add column if not exists status text;
alter table public.attendance add column if not exists attendance_date date;
alter table public.attendance add column if not exists attendance_time time;

update public.attendance set status = 'present' where status is null;
alter table public.attendance alter column status set default 'present';

alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance
  add constraint attendance_status_check
  check (status in ('present', 'late', 'absent'));

-- Fill attendance_date / attendance_time from scanned_at when the app did
-- not send them. The app sends the local date/time of the scan, so the
-- stored values match what the student sees in their history.
create or replace function public.attendance_fill_date_time()
returns trigger
language plpgsql
as $$
begin
  if new.attendance_date is null then
    new.attendance_date := (new.scanned_at)::timestamp::date;
  end if;
  if new.attendance_time is null then
    new.attendance_time := (new.scanned_at)::timestamp::time;
  end if;
  return new;
end;
$$;

drop trigger if exists on_attendance_fill_date_time on public.attendance;
create trigger on_attendance_fill_date_time
  before insert or update on public.attendance
  for each row execute function public.attendance_fill_date_time();

-- ------------------------------------------------------------
-- 3. GUARD — stop unauthorised attendance recording
--
--   * only a student profile may create an attendance row
--   * a closed event rejects new attendance
--
-- SECURITY DEFINER so the trigger can read profiles/events even
-- when the calling row-level policy would hide them.
-- ------------------------------------------------------------
create or replace function public.guard_attendance_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_actor_role text;
  v_event_status text;
begin
  -- Administrators may correct records, even for a closed event.
  select p.role into v_actor_role
  from public.profiles p
  where p.id = auth.uid();

  if v_actor_role = 'admin' then
    return new;
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = new.student_id;

  if v_role is distinct from 'student' then
    raise exception 'Only student accounts can record attendance.';
  end if;

  select e.status into v_event_status
  from public.events e
  where e.id = new.event_id;

  if v_event_status = 'closed' then
    raise exception 'This event is closed. Attendance is no longer accepted.';
  end if;

  return new;
end;
$$;

drop trigger if exists on_attendance_insert_guard on public.attendance;
create trigger on_attendance_insert_guard
  before insert on public.attendance
  for each row execute function public.guard_attendance_insert();

-- ------------------------------------------------------------
-- 4. RLS — only students may insert their own attendance
--
-- The old policy is dropped first: permissive policies are OR-ed
-- together, so leaving it in place would keep the hole open.
-- ------------------------------------------------------------
drop policy if exists "Students can insert their own attendance" on public.attendance;
create policy "Students can insert their own attendance"
  on public.attendance for insert to authenticated
  with check (
    auth.uid() = student_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'student'
    )
  );

-- ------------------------------------------------------------
-- END
-- ------------------------------------------------------------
