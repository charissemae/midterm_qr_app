# Attendance History — Feature Guide

> Target: School Event QR Attendance App (Expo SDK 54 + Supabase)

---

## 1. What it does

- **Student view** — lists the events a logged-in student has scanned (from `attendance`).
- **Teacher view** — lists events the teacher created (`events.created_by = teacher id`) and, for each:
  - an **attendee count badge** in the card header,
  - the list of attendees (student id + scan time).

Data lives in Supabase tables: `events`, `attendance`, `profiles`.

---

## 2. How the count is computed

`lib/attendance.ts -> getTeacherEventAttendance(teacherId)`

1. Query `events` where `created_by = teacherId`.
2. Collect `event_ids`.
3. Query `attendance` where `event_id in (event_ids)`.
4. `attendeeCount = number of rows per event_id`.

That is why events **must have `created_by` set** — a scan that lands on an event row with `created_by = null`
is invisible in the teacher's history (verified by test on this project).

The scan flow `lib/attendance.ts -> registerAttendance(rawPayload, studentId)`:

1. Parse the QR payload (`lib/qr.ts`, requires `v: 1` + `event` code).
2. Check the QR start/end window against the server clock.
3. Find the event by `event_code` (`getEventByCode`). If missing, insert a new event
   (this row has `created_by = null` unless the teacher created it first).
4. Insert `attendance(student_id, event_id)`.

---

## 3. What we found (diagnosis log)

Symptoms reported: two different student accounts scanning the same event and both saw
"Attendance recorded!", but the teacher's history stayed at 1 attendee, and the
`attendance` table had only 1 row.

Tests run against the live project (`test/rls-read-test.ps1`, `test/rls-attendance-probe.ps1`,
`test/rls-select-visibility.ps1`) prove that with a fresh teacher event + 2 students the
full path records **2 rows** and the teacher reads **2**:

| check | result |
|---|---|
| student can `getEventByCode` | OK (1 row) |
| student can insert own `attendance` row (RLS) | OK — even teacher/no-profile roles insert fine |
| teacher reads count for own event | OK (2 rows) |
| teacher reads count for `created_by = null` event | **0 rows (invisible)** |
| duplicate insert on `(student_id, event_id)` | **returns success — NO unique constraint exists** |

Conclusions:

1. The counting/reporting logic is correct for events created by the teacher.
2. One recorded row while two scans "succeeded" points to the second phone running a
   **stale build** (the old local-SQLite version, `lib/database.ts`, replaced during the
   Supabase migration): it wrote locally and printed a fake success, never hitting Supabase.
3. No unique index exists on `attendance(student_id, event_id)`, so the app's
   "Already registered" (error code `23505`) path can never trigger and a student scanning
   twice would double-record.

---

## 4. Fixes applied

- `lib/attendance.ts` — attendance insert now requests the inserted row
  (`.select('id')`) and returns an explicit failure if 0 rows were actually written,
  instead of a silent "Attendance recorded!".
- `app/(tabs)/history.tsx` — added **pull-to-refresh** so the attendee badge/count can
  always be reloaded; the list already reloads on screen focus.

---

## 5. Check list when the count "does not increase"

1. Both phones must run the **current build**:
   - Restart the dev server: `npx expo start --clear`
   - Fully close Expo Go (swipe it away), reopen, re-scan the QR.
   - If one phone still misbehaves: uninstall + reinstall Expo Go.
2. In the **events** table, the scanned event must have `created_by` filled with the
   teacher's id. If `null`, the attendance for it is invisible to the teacher history.
3. After scanning, open the **History** tab (it reloads on focus) or pull down to refresh.
4. If a student now sees an error like "Attendance was not recorded...", the insert was
   rejected/blocked — check the Supabase dashboard `attendance` table editor for their row.

### Optional: enforce one attendance per student per event

Run this in the Supabase **SQL editor** to add the missing unique index:

```sql
alter table attendance
  add constraint attendance_student_event_unique
  unique (student_id, event_id);
```

After adding it, scanning the same event twice shows "Already registered for this event."
Remove any existing duplicate rows first if needed:

```sql
with ranked as (
  select id,
         row_number() over (partition by student_id, event_id order by scanned_at) as rn
  from attendance
)
delete from attendance a using ranked r
where a.id = r.id and r.rn > 1;
```

---

### Show student NAMES in the attendee list

The teacher history shows real names when they can be read
(`lib/attendance.ts -> getTeacherEventAttendance`, plus `app/(tabs)/history.tsx`).

The names are fetched with a **separate** `profiles` query (never embedded in the
attendance query). This is deliberate: PostgREST embeds act like an inner join, so a
join to `profiles` under the current own-row RLS would silently **drop attendance rows**
the teacher cannot read names for — killing the attendee count/list. Keeping the queries
separate guarantees the count and the attendee list always render correctly.

**To make names populate**, the `profiles` RLS `SELECT` policy must allow reading others'
rows. Run this in the Supabase **SQL editor**:

```sql
-- allows any signed-in user to read names/emails/roles of all profiles
create policy "profiles_select_authenticated"
  on profiles for select
  to authenticated
  using (true);
```

Safer, scoped alternative (a teacher may read profiles only of students who
attended their own events — plus their own row):

```sql
create policy "profiles_select_teacher_event_attendees"
  on profiles for select
  to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1
      from attendance a
      join events e on e.id = a.event_id
      where a.student_id = profiles.id
        and e.created_by = auth.uid()
    )
  );
```

Until a policy exists, the app falls back to showing the short student id
(`…xxxxxxxx`) instead of the name — the attendee list and count still render.
Adding/removing these policies never affects the attendance rows themselves.

---

## 6. Troubleshooting "failed to connect" on scan

Messages to look for in `app/(tabs)/scan.tsx`:
- **Could not reach the server. Please try again.** — the Supabase request threw.
- **Network error. Please check your connection and try again.** — thrown inside
  `registerAttendance`.

Likely causes & fixes, in order:

| Cause | Fix |
|---|---|
| Phone not on the same Wi-Fi as the computer (Expo Go can't load the app) | Put both on the same LAN, or start with `npx expo start --tunnel` |
| Expo Go says "Failed to connect to the development server" when scanning the Metro QR | Same fix as above: same network / tunnel / firewall allows port 8081 |
| Supabase free project paused (idle) so every request fails | Supabase dashboard → check the project is **not paused** (Settings → status) |
| Device has no internet / plane mode / blocking VPN | Check other apps connect; retry scan |
| Token expired mid-session | Sign out and sign back in (Profile tab) |

---

## 7. Relevant code

| Area | File |
|---|---|
| Scan handler | `app/(tabs)/scan.tsx` |
| Attendance logic | `lib/attendance.ts` |
| Event CRUD | `lib/events.ts` |
| QR payload | `lib/qr.ts` |
| Auth / profile | `lib/auth.ts`, `lib/profiles.ts` |
| History UI | `app/(tabs)/history.tsx` |