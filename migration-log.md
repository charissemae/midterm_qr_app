# Migration Log — Local SQLite → Supabase

> Project: School Event QR Attendance App (Expo SDK 54)
> This log documents the migration from an on-device SQLite database
> (`expo-sqlite`) to a cloud backend (Supabase Postgres + Auth + RLS).

---

## 1. Why migrate

The original app stored attendance only on the phone's local SQLite database:

- Data was **device-local** — a teacher and the students did not share anything.
- No users / logins — everyone used the same hard-coded student id.
- No teacher/student roles, no event ownership, no per-student attendee lists.

Supabase adds shared cloud data, real accounts, per-event attendance, and role-based
permissions via Row Level Security (RLS).

---

## 2. Old architecture (before)

| Item | Old (SQLite, `lib/database.ts`) |
|---|---|
| Storage | `expo-sqlite`, file `qr-attendance.db` |
| Table `events` | `eventId TEXT PRIMARY KEY, title, start, end` |
| Table `attendance` | `id INTEGER PK AUTOINCREMENT, studentId, eventId, scannedAt` |
| Uniqueness | `UNIQUE (studentId, eventId)` — duplicate scan → "Already registered" |
| Identity | No auth; a constant student id |
| Functions | `registerAttendance`, `getAttendanceHistory`, `createEvent` |
| Share | None (per device) |

---

## 3. New architecture (after)

### Modules

| New module | Responsibility |
|---|---|
| `lib/supabase.ts` | Supabase client (SecureStore storage on native, localStorage on web) |
| `lib/auth.ts` | Sign up / sign in / sign out, session restore, stale-session guard |
| `lib/attendance.ts` | `registerAttendance`, `getAttendanceHistory`, `getTeacherEventAttendance`, `getTeacherEventSummary` |
| `lib/events.ts` | `createEvent` (upsert on `event_code`), `getEventByCode`, `getEventsByTeacher` |
| `lib/profiles.ts` | `getProfile`, `updateProfile` (role + name) |
| `lib/qr.ts` | `buildQRPayload`, `parseQRPayload` (`v:1` payload) |

### Cloud schema (Supabase)

- `auth.users` — Supabase managed accounts.
- `profiles` — `id (PK→auth.users)`, `email`, `full_name`, `role ('student'|'teacher')`.
  Created by a signup trigger (default `'student'`); the app PATCHes `full_name`/`role`
  chosen on the Register screen.
- `events` — `id (PK)`, `event_code (UNIQUE)`, `title`, `start_time`, `end_time`,
  `created_by (→ auth.users)`, `created_at`.
- `attendance` — `id (PK)`, `student_id (→ auth.users)`, `event_id (→ events)`,
  `scanned_at`.

**Note:** `attendance` has **no** unique constraint on `(student_id, event_id)`
(verified by duplicate-insert test). This differs from the old SQLite schema, which had one.

### RLS behavior (verified against the live project)

| Table · action | Policy observed |
|---|---|
| `events` select | Authenticated users can read events (used by `getEventByCode`); teacher history filters by `created_by` in-app |
| `events` insert/upsert | Authenticated; `created_by` set to the creator |
| `attendance` insert | Permissive for an authenticated user inserting their own `student_id` (even teacher profile / missing profile rows pass with-check) |
| `attendance` select | Students see own rows; teachers see rows for events they created |
| `profiles` select | **Own-row only** (`id = auth.uid()`) — teachers cannot read other students' `full_name` by default |
| `profiles` update | Own row |

---

## 4. File / behavior mapping

| Old | New | Notes |
|---|---|---|
| `registerAttendance(raw, studentId)` | `lib/attendance.ts` same name | Now inserts to `attendance` + finds/creates `events` row by `event_code`; returns `23505` → "Already registered" |
| `getAttendanceHistory(studentId)` | `lib/attendance.ts` same name | Reads `attendance` joined to `events` (per user) |
| `createEvent(event)` | `lib/events.ts` same name | Upsert on `event_code`, sets `created_by` |
| student id constant | `user.id` from `useAuth()` | Real account per device |
| — | `getTeacherEventAttendance` | New: per-event attendee list + count for teachers |
| — | `lib/profiles.ts` | New: role / name handling |

---

## 5. Issues found during and after migration

### 5.1 Attendee count "did not increase" after two students scanned

- **Symptom:** two different student accounts scanned the same event, both saw
  "Attendance recorded!", but the `attendance` table had only 1 row.
- **Diagnosis (tests in `test/`):** the full app path (event found by code → insert →
  teacher count) works with fresh accounts (2 students → 2 rows → teacher reads 2).
  A PostgREST insert can fail RLS silently (returns no error, no row), and a
  **stale build** on one phone writes to the old local SQLite only.
- **Fix (code):** `registerAttendance` now requests the inserted row (`.select('id')`)
  and returns an explicit error if 0 rows were actually written — no more fake
  "Attendance recorded!".

### 5.2 Missing unique constraint on attendance

- Old SQLite schema had `UNIQUE (studentId, eventId)`; the cloud `attendance` table did not.
- Consequence: duplicates were possible and the `23505 → "Already registered"` path never fired.
- Recommended SQL (run in Supabase SQL editor):

```sql
alter table attendance
  add constraint attendance_student_event_unique
  unique (student_id, event_id);
```

### 5.3 Attendee list showed ids, not names

- `attendance` stores `student_id` (auth uuid), not display names.
- `profiles` RLS SELECT is own-row only, so a join in the attendance query was both
  blocked and dangerous (see 5.4).
- **Fix:** names are now read with a **separate** `profiles` query and joined in
  JavaScript; the UI falls back to `…shortId` when the name is unavailable.
  To populate names, add a `profiles` SELECT policy (see `attendance-history.md`).

### 5.4 Names join "deleted" the attendee list

- PostgREST embeds behave like an **inner join**; joining `profiles` under the
  own-row RLS silently dropped attendance rows the teacher could not read names for,
  hiding existing attendee records.
- **Fix:** keep the attendance query free of embeds so the count/list always render;
  fetch names separately. Attendance rows are never deleted by this — they were only hidden.

### 5.5 Teacher's events appeared to disappear from history

- An earlier version returned `[]` for the whole teacher-history function when the
  attendance subquery errored — the events list vanished even though `events` rows existed.
- **Fix:** the events query is independent; an attendance/name error now yields the
  events with empty attendee data instead of hiding them.

### 5.6 UX additions while here

- `app/(tabs)/history.tsx`: expandable event cards (tap to show the full attendee list),
  pull-to-refresh, and a **Teacher/Student** badge so the active view is obvious.

### 5.7 "failed to connect" on scan

- Causes: phone not on the same LAN as the dev server (use `npx expo start --tunnel`),
  Supabase free project paused, or expired session (sign out/in). Details in
  `attendance-history.md` § 6.

---

## 6. Current status

- [x] Shared cloud storage (Supabase)
- [x] Email/password auth with role selection
- [x] Teacher creates events + QR (upsert on `event_code`, `created_by` owner)
- [x] Student scan records attendance (verified row insert)
- [x] Teacher history: per-event attendee count + expandable attendee list
- [x] Student history: per-user scanned events
- [x] Graceful name fallback until a `profiles` SELECT policy is added
- [ ] Add `attendance_student_event_unique` constraint (recommended)

---

## 7. Test scripts

Kept under `test/` (diagnostic, PowerShell/Node against the live project):

- `rls-read-test.ps1` — teacher/student read path sanity check
- `rls-attendance-probe.ps1` — insert RLS + duplicate behavior
- `rls-select-visibility.ps1` — who can read attendance for owned vs. orphan events
- `rls-profile-name-read.ps1` — profiles name visibility via join vs. direct

Related doc: `attendance-history.md`