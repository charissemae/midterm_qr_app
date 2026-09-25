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

function RowDump($label, $rows) {
    Write-Output ("  " + $label + " -> " + @($rows).Count + " rows")
    @($rows) | ForEach-Object { Write-Output ("      student=" + $_.student_id.Substring(0,8) + "... event=" + $_.event_id.Substring(0,8)) }
}

$suffix = Get-Random -Minimum 100000 -Maximum 999999
$pw = 'Qr-Atlantis-2026!'
$et = "vis_t_$suffix@qratt.test"; $e1 = "vis_s1_$suffix@qratt.test"; $e2 = "vis_s2_$suffix@qratt.test"
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

# Event B owned by TEACHER
$codeB = 'VIS-T-' + $suffix
$evB = @(ReqJson 'Post' $toke.access_token '/rest/v1/events?select=id' @{ event_code = $codeB; title = "Owned $suffix"; created_by = $ut } 'return=representation')
$eidB = $evB[0].id
# Event C owned by NOBODY (created_by null) = like an event created by a student scan
$codeC = 'VIS-N-' + $suffix
$evC = @(ReqJson 'Post' $toke.access_token '/rest/v1/events?select=id' @{ event_code = $codeC; title = "Orphan $suffix"; created_by = $null } 'return=representation')
$eidC = $evC[0].id
Write-Output "eventB(owned-by-teacher)=$eidB"
Write-Output "eventC(created_by=null)=$eidC"

ReqJson 'Post' $s1k.access_token '/rest/v1/attendance?select=id' @{ student_id = $u1; event_id = $eidB } | Out-Null
ReqJson 'Post' $s2k.access_token '/rest/v1/attendance?select=id' @{ student_id = $u2; event_id = $eidB } | Out-Null
ReqJson 'Post' $s1k.access_token '/rest/v1/attendance?select=id' @{ student_id = $u1; event_id = $eidC } | Out-Null
ReqJson 'Post' $s2k.access_token '/rest/v1/attendance?select=id' @{ student_id = $u2; event_id = $eidC } | Out-Null

Write-Output "SELECT VISIBILITY:"
RowDump "teacher R eventB"  (ReqJson 'Get' $toke.access_token "/rest/v1/attendance?select=student_id,event_id&event_id=eq.$eidB")
RowDump "teacher R eventC"  (ReqJson 'Get' $toke.access_token "/rest/v1/attendance?select=student_id,event_id&event_id=eq.$eidC")
RowDump "s1 reads own eventB" (ReqJson 'Get' $s1k.access_token "/rest/v1/attendance?select=student_id,event_id&event_id=eq.$eidB")
RowDump "s1 reads own eventC" (ReqJson 'Get' $s1k.access_token "/rest/v1/attendance?select=student_id,event_id&event_id=eq.$eidC")
RowDump "s2 reads own eventB" (ReqJson 'Get' $s2k.access_token "/rest/v1/attendance?select=student_id,event_id&event_id=eq.$eidB")
RowDump "teacher R ALL events by teacher (app path)" (ReqJson 'Get' $toke.access_token "/rest/v1/attendance?select=student_id,event_id,event:events!inner(event_code,title)")