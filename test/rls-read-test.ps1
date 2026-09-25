$ErrorActionPreference = 'Continue'
$url = 'https://vsamdgwjeygdrcejlfya.supabase.co'
$key = 'sb_publishable_jfEYhaBpxhM0r9ZX7bkdkg_tByOXrLE'
$anon = @{ apikey = $key; 'Content-Type' = 'application/json' }

function Invoke-AnonRetry($path) {
    for ($i = 1; $i -le 4; $i++) {
        try {
            return Invoke-RestMethod -Method Get -Uri ($url + $path) -Headers $anon -ErrorAction Stop
        } catch { Start-Sleep -MillisMilliseconds 900 }
    }
    return @()
}

function AsAnon($method, $token, $path, $body = $null) {
    $h = @{ apikey = $key; 'Content-Type' = 'application/json'; Authorization = "Bearer $token" }
    for ($i = 1; $i -le 4; $i++) {
        try {
            if ($body -ne $null) { return Invoke-RestMethod -Method $method -Uri ($url + $path) -Headers $h -Body ($body | ConvertToJson -Depth 6) -ErrorAction Stop }
            return Invoke-RestMethod -Method $method -Uri ($url + $path) -Headers $h -ErrorAction Stop
        } catch { Start-Sleep -Milliseconds 900 }
    }
    return $null
}

$suffix = Get-Random -Minimum 10000 -Maximum 99999
$pw = 'Qr-Atlantis-2026!'
$e1 = "rev_$suffix@qratt.test"; $e2 = "rev2_$suffix@qratt.test"; $et = "revt_$suffix@qratt.test"

AsAnon 'Post' $null '/auth/v1/signup' @{ email = $e1; password = $pw } | Out-Null
AsAnon 'Post' $null '/auth/v1/signup' @{ email = $e2; password = $pw } | Out-Null
AsAnon 'Post' $null '/auth/v1/signup' @{ email = $et; password = $pw } | Out-Null

$tok1 = AsAnon 'Post' $null '/auth/v1/token?grant_type=password' @{ email = $e1; password = $pw }
$tok2 = AsAnon 'Post' $null '/auth/v1/token?grant_type=password' @{ email = $e2; password = $pw }
$toke = AsAnon 'Post' $null '/auth/v1/token?grant_type=password' @{ email = $et; password = $pw }

$u1 = $tok1.user.id; $u2 = $tok2.user.id; $ut = $toke.user.id
Write-Output "u1=$u1`nu2=$u2`nteacher=$ut"

# teacher creates an event
$event = AsAnon 'Post' $toke.access_token '/rest/v1/events?select=id,event_code' @{
  event_code = 'REV-TEST-' + $suffix; title = 'Reverse Count Test'; start_time = $null; end_time = $null; created_by = $ut
}
$eid = $event[0].id
Write-Output "eventId=$eid"

# two students insert attendance (app's own path)
$att1 = AsAnon 'Post' $tok1.access_token '/rest/v1/attendance?select=id' @{ student_id = $u1; event_id = $eid }
$att2 = AsAnon 'Post' $tok2.access_token '/rest/v1/attendance?select=id' @{ student_id = $u2; event_id = $eid }
Write-Output "att1=$($att1[0].id)`natt2=$($att2[0].id)"

Write-Output "--- teacher reads attendance (app path) ---"
try {
  $rows = AsAnon 'Get' $toke.access_token "/rest/v1/attendance?select=student_id,event_id,scanned_at&event_id=eq.$eid"
  Write-Output "teacherRows=$(@($rows).Count)"
  @($rows) | ForEach-Object { Write-Output ("  student_id=" + $_.student_id) }
} catch { Write-Output "teacherRows=ERR $($_.Exception.Message)" }

Write-Output "--- students read own history (app path) ---"
try {
  $own1 = AsAnon 'Get' $tok1.access_token "/rest/v1/attendance?select=student_id,event_id,scanned_at,events(event_code,title)&student_id=eq.$u1"
  Write-Output "student1Rows=$(@($own1).Count)"
  @($own1) | ForEach-Object { Write-Output ("  " + $_.events.event_code + " / " + $_.events.title) }
} catch { Write-Output "student1Rows=ERR $($_.Exception.Message)" }

Write-Output "--- anon reads (should be 0) ---"
$anonRead = Invoke-AnonRetry "/rest/v1/attendance?select=student_id,event_id&event_id=eq.$eid"
Write-Output "anonRows=$(@($anonRead).Count)"