-- ============================================================
-- QR-ATT administrator setup + missing RLS policies
-- Run this whole file once in Supabase:
--   Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (uses drop-if-exists / or-if-not-exists).
-- ============================================================

-- 1) Allow the 'admin' role in profiles.role
--    (the original check constraint only allowed student/teacher)
alter table if exists public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

-- 2) Helper: is the current user an administrator?
--    SECURITY DEFINER so policies on profiles do not recurse.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 3) profiles: administrators can read and update every account
--    (needed by the Admin tab: manage users, change roles)
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4) events: teachers can delete their own events; administrators everything
drop policy if exists "Teachers can delete their own events" on public.events;
create policy "Teachers can delete their own events"
  on public.events for delete to authenticated
  using (auth.uid() = created_by);

drop policy if exists "Admins can update any event" on public.events;
create policy "Admins can update any event"
  on public.events for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete any event" on public.events;
create policy "Admins can delete any event"
  on public.events for delete to authenticated
  using (public.is_admin());

-- 5) attendance: administrators can view, add, correct and delete any record
drop policy if exists "Admins can view all attendance" on public.attendance;
create policy "Admins can view all attendance"
  on public.attendance for select to authenticated
  using (public.is_admin());

drop policy if exists "Admins can add attendance" on public.attendance;
create policy "Admins can add attendance"
  on public.attendance for insert to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can correct attendance" on public.attendance;
create policy "Admins can correct attendance"
  on public.attendance for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete attendance" on public.attendance;
create policy "Admins can delete attendance"
  on public.attendance for delete to authenticated
  using (public.is_admin());

-- 6) Administrators can fully remove an account (auth + profile + attendance
--    via the on-delete cascades). SECURITY DEFINER because only the database
--    owner may write to auth.users.
create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Only administrators can delete accounts.';
  end if;

  delete from auth.users where id = target;
end;
$$;

revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- 7) Promote your own account to administrator (edit the email first).
--    After that, the Admin tab appears and you can promote others in-app.
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';
