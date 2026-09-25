$ErrorActionPreference = 'Continue'
$url = 'https://vsamdgwjeygdrcejlfya.supabase.co'
$key = 'sb_publishable_jfEYhaBpxhM0r9ZX7bkdkg_tByOXrLE'

function ReqJson($method, $token, $path, $body = $null, $prefer = $null) {
    $h = @{ apikey = $key; 'Content-Type' = 'application/json' }
    if ($token) { $h.Authorization = "Bearer $token" }
    if ($prefer) { $h.Prefer = $prefer }
    try {
        if ($body -ne $null) { return Invoke-RestMethod -Method $method -Uri ($url + $path) -Headers $h -Body ($body | ConvertTo-Json -Depth 6) }
        return Invoke-RestMethod -Method $method -Uri ($url + $path) -Headers $h
    } catch { return $null }
}

$suffix = Get-Random -Minimum 100000 -Maximum 999999
$pw = 'Qr-Atlantis-2026!'
$et = "name_t_$suffix@qratt.test"; $e1 = "name_s1_$suffix@qratt.test"; $e2 = "name_s2_$suffix@qratt.test"
ReqJson 'Post' $null '/auth/v1/signup' @{ email = $et; password = $pw } | Out-Null
ReqJson 'Post' $null '/auth/v1/signup' @{ email = $e1; password = $pw } | Out-Null
ReqJson 'Post' $null '/auth/v1/signup' @{ email = $e2; password = $pw } | Out-Null
Start-Sleep -Seconds 2
$toke = ReqJson 'Post' $null '/auth/v1/token?grant_type=password' @{ email = $et; password = $pw }
$s1k = ReqJson 'Post' $null '/auth/v1/token?grant_type=password' @{ email = $e1; password = $pw }
$s2k = ReqJson 'Post' $null '/auth/v1/token?grant_type=password' @{ email = $e2; password = $pw }
if (-not $s1k.user -or -not $s2k.user) { Write-Output 'SIGNIN FAILED'; return }
$ut = $toke.user.id; $u1 = $s1k.user.id; $u2 = $s2k.user.id

ReqJson 'Patch' $toke.access_token "/rest/v1/profiles?id=eq.$ut" @{ role = 'teacher' } | Out-Null
# students set their full_name like the app's register flow does
ReqJson 'Patch' $s1k.access_token "/rest/v1/profiles?id=eq.$u1" @{ full_name = 'Student One'; role = 'student' } | Out-Null
ReqJson 'Patch' $s2k.access_token "/rest/v1/profiles?id=eq.$u2" @{ full_name = 'Student Two'; role = 'student' } | Out-Null

$code = 'NAME-' + $suffix
$ev = @(ReqJson 'Post' $toke.access_token '/rest/v1/events?select=id' @{ event_code = $code; title = 'Name Test'; created_by = $ut } 'return=representation')
$eid = $ev[0].id
ReqJson 'Post' $s1k.access_token '/rest/v1/attendance?select=id' @{ student_id = $u1; event_id = $eid } | Out-Null
ReqJson 'Post' $s2k.access_token '/rest/v1/attendance?select=id' @{ student_id = $u2; event_id = $eid } | Out-Null

Write-Output "--- teacher reads attendance with profiles join (names) ---"
$rows = @(ReqJson 'Get' $toke.access_token "/rest/v1/attendance?select=student_id,scanned_at,profiles(full_name,email)&event_id=eq.$eid")
foreach ($r in $rows) { Write-Output ("  name='" + $r.profiles.full_name + "' email=" + $r.profiles.email) }
Write-Output "count=$($rows.Count)"

Write-Output "--- teacher reads profiles directly (fallback check) ---"
$direct = @(ReqJson 'Get' $toke.access_token "/rest/v1/profiles?select=id,full_name&id=in.($u1,$u2)")
Write-Output "direct profiles rows=$($direct.Count)"
foreach ($r in $direct) { Write-Output ("  id=" + $r.id.Substring(0,8) + " name='" + $r.full_name + "'") }