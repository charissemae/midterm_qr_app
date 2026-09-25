$ErrorActionPreference = 'Continue'
$url = 'https://vsamdgwjeygdrcejlfya.supabase.co'
$key = 'sb_publishable_jfEYhaBpxhM0r9ZX7bkdkg_tByOXrLE'
$anon = @{ apikey = $key; 'Content-Type' = 'application/json' }

function ReqJson($method, $token, $path, $body = $null, $prefer = $null) {
    $h = @{ apikey = $key; 'Content-Type' = 'application/json' }
    if ($token) { $h.Authorization = "Bearer $token" }
    if ($prefer) { $h.Prefer = $prefer }
    try {
        if ($body -ne $null) {
            return Invoke-RestMethod -Method $method -Uri ($url + $path) -Headers $h -Body ($body | ConvertTo-Json -Depth 6)
        }
        return Invoke-RestMethod -Method $method -Uri ($url + $path) -Headers $h
    } catch {
        return $null
    }
}

$suffix = Get-Random -Minimum 100000 -Maximum 999999
$pw = 'Qr-Atlantis-2026!'
$et = "prb_t_$suffix@qratt.test"; $e1 = "prb_s1_$suffix@qratt.test"; $e2 = "prb_s2_$suffix@qratt.test"

ReqJson 'Post' $null '/auth/v1/signup' @{ email = $et; password = $pw } | Out-Null
ReqJson 'Post' $null '/auth/v1/signup' @{ email = $e1; password = $pw } | Out-Null
ReqJson 'Post' $null '/auth/v1/signup' @{ email = $e2; password = $pw } | Out-Null
Start-Sleep -Seconds 2

$toke = ReqJson 'Post' $null '/auth/v1/token?grant_type=password' @{ email = $et; password = $pw }
$s1k = ReqJson 'Post' $null '/auth/v1/token?grant_type=password' @{ email = $e1; password = $pw }
$s2k = ReqJson 'Post' $null '/auth/v1/token?grant_type=password' @{ email = $e2; password = $pw }

if (-not $s1k.user -or -not $s2k.user) { Write-Output 'SIGNIN FAILED'; return }

$ut = $toke.user.id; $u1 = $s1k.user.id; $u2 = $s2k.user.id
Write-Output "teacher=$ut"; Write-Output "s1=$u1"; Write-Output "s2=$u2"

ReqJson 'Patch' $toke.access_token "/rest/v1/profiles?id=eq.$ut" @{ role = 'teacher' } | Out-Null

$code = 'PRB-' + $suffix
$ev = ReqJson 'Post' $toke.access_token '/rest/v1/events?select=id' @{ event_code = $code; title = "Probe $suffix"; created_by = $ut } 'return=representation'
$eid = @($ev)[0].id
Write-Output "eventId=$eid"

# 1. S1 inserts own row -> expectation: ok
$probe1 = @(ReqJson 'Post' $s1k.access_token '/rest/v1/attendance?select=id,student_id,event_id' @{ student_id = $u1; event_id = $eid } 'return=representation')
Write-Output ("1) student inserts OWN row: rows=" + $probe1.Count)

# 2. S2 inserts own row -> expectation: ok
$probe2 = @(ReqJson 'Post' $s2k.access_token '/rest/v1/attendance?select=id,student_id,event_id' @{ student_id = $u2; event_id = $eid } 'return=representation')
Write-Output ("2) student2 inserts OWN row: rows=" + $probe2.Count)

# 2b. S2 inserts AGAIN (duplicate student+event) -> expectation: Already registered (23505)
$probe2b = @(ReqJson 'Post' $s2k.access_token '/rest/v1/attendance?select=id,student_id,event_id' @{ student_id = $u2; event_id = $eid } 'return=representation')
Write-Output ("2b) student2 DUPLICATE insert rows=" + $probe2b.Count + " (0 = unique violation, correct)")

# 3. Delete S2's profile row (simulate account without profile / trigger miss), then S2 inserts again
ReqJson 'Delete' $toke.access_token "/rest/v1/profiles?id=eq.$u2" | Out-Null
$probe3 = @(ReqJson 'Post' $s2k.access_token '/rest/v1/attendance?select=id,student_id,event_id' @{ student_id = $u2; event_id = $eid } 'return=representation')
Write-Output ("3) S2 with NO profile row inserts OWN row: rows=" + $probe3.Count)

# 4. Given S2's profile is deleted, set role via direct insert with teacher role
ReqJson 'Post' $toke.access_token '/rest/v1/profiles?select=id' @{ id = $u2; email = $e2; full_name = 'S2'; role = 'teacher' } 'return=representation' | Out-Null
$probe4 = @(ReqJson 'Post' $s2k.access_token '/rest/v1/attendance?select=id,student_id,event_id' @{ student_id = $u2; event_id = $eid } 'return=representation')
Write-Output ("4) S2 with role=teacher profile inserts OWN row: rows=" + $probe4.Count)

# 5. Teacher inserts OWN row into own event
$probe5 = @(ReqJson 'Post' $toke.access_token '/rest/v1/attendance?select=id,student_id,event_id' @{ student_id = $ut; event_id = $eid } 'return=representation')
Write-Output ("5) TEACHER inserts OWN row into own event: rows=" + $probe5.Count)

# 6. Count all rows in event from teacher's read (app path)
$rows = @(ReqJson 'Get' $toke.access_token "/rest/v1/attendance?select=student_id,event_id&event_id=eq.$eid")
Write-Output ("6) teacher-read total rows in event = " + $rows.Count)