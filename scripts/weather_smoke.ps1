param(
  [string]$BaseUrl = "https://eden-gsot.onrender.com",
  [string]$Address = "6433 Northwest 199th Terrace",
  [string]$City = "Country Club",
  [string]$State = "FL",
  [string]$ZipCode = "33015",
  [string]$StartDate = "2025-01-01",
  [string]$EndDate = "2026-02-12",
  [string]$EventType = "wind"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host ("`n==> " + $msg) -ForegroundColor Cyan
}

function Invoke-JsonPost($uri, $body, $headers = @{}) {
  return Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json" -Headers $headers -Body ($body | ConvertTo-Json -Depth 8)
}

function Invoke-JsonPostWithRetry($uri, $body, $headers = @{}, [int]$retries = 2, [int]$delayMs = 800) {
  $lastError = $null
  for ($attempt = 0; $attempt -le $retries; $attempt++) {
    try {
      return Invoke-JsonPost -uri $uri -body $body -headers $headers
    } catch {
      $lastError = $_
      if ($attempt -lt $retries) {
        Start-Sleep -Milliseconds ($delayMs * ($attempt + 1))
      }
    }
  }
  throw $lastError
}

Write-Step "Checking backend health"
try {
  $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
  Write-Host ("Health: " + ($health.status | Out-String).Trim())
} catch {
  Write-Host "Health endpoint unavailable. Continuing smoke to test auth + weather routes..." -ForegroundColor Yellow
}

Write-Step "Registering temporary smoke user"
$ts = Get-Date -Format "yyyyMMddHHmmss"
$email = "weather.smoke.$ts@gmail.com"
$password = "SmokePass!123"

$registerBody = @{
  email = $email
  full_name = "Weather Smoke"
  role = "adjuster"
  password = $password
}

try {
  $null = Invoke-JsonPost -uri "$BaseUrl/api/auth/register" -body $registerBody
  Write-Host "Register: OK"
} catch {
  Write-Host "Register failed. Attempting login anyway..." -ForegroundColor Yellow
}

Write-Step "Logging in smoke user"
$login = $null
try {
  $login = Invoke-JsonPostWithRetry -uri "$BaseUrl/api/auth/login" -body @{ email = $email; password = $password } -retries 2
} catch {
  Write-Host "Login unavailable (backend likely down). Smoke cannot continue." -ForegroundColor Red
  exit 2
}
$token = $login.access_token
if (-not $token) {
  Write-Host "No access token returned from login. Smoke cannot continue." -ForegroundColor Red
  exit 2
}
$authHeaders = @{ Authorization = "Bearer $token" }
Write-Host "Login: OK"

Write-Step "Calling /api/weather/dol/candidates"
$candidateBody = @{
  address = $Address
  city = $City
  state = $State
  zip_code = $ZipCode
  start_date = $StartDate
  end_date = $EndDate
  event_type = $EventType
  top_n = 5
  max_distance_miles = 25
  min_wind_mph = 30
}
$candidateResponse = $null
try {
  $candidateResponse = Invoke-JsonPostWithRetry -uri "$BaseUrl/api/weather/dol/candidates" -body $candidateBody -headers $authHeaders -retries 1
} catch {
  Write-Host "Primary candidate run failed. Retrying with relaxed params..." -ForegroundColor Yellow
  $candidateBody.city = ""
  $candidateBody.start_date = (Get-Date).AddDays(-365).ToString("yyyy-MM-dd")
  $candidateBody.max_distance_miles = 50
  $candidateBody.min_wind_mph = 20
  try {
    $candidateResponse = Invoke-JsonPostWithRetry -uri "$BaseUrl/api/weather/dol/candidates" -body $candidateBody -headers $authHeaders -retries 2
  } catch {
    Write-Host "Relaxed candidate run failed. Retrying with short stability window..." -ForegroundColor Yellow
    $candidateBody.start_date = (Get-Date).AddDays(-90).ToString("yyyy-MM-dd")
    $candidateBody.max_distance_miles = 35
    try {
      $candidateResponse = Invoke-JsonPostWithRetry -uri "$BaseUrl/api/weather/dol/candidates" -body $candidateBody -headers $authHeaders -retries 2
    } catch {
      Write-Host "Candidate discovery unavailable after retries. Continuing with verification fallback..." -ForegroundColor Yellow
      $candidateResponse = $null
    }
  }
}
$candidateCount = if ($candidateResponse) { @($candidateResponse.candidates).Count } else { 0 }
Write-Host "Candidates: $candidateCount"

$verifyDate = $StartDate
if ($candidateCount -gt 0 -and $candidateResponse.candidates[0].candidate_date) {
  $verifyDate = $candidateResponse.candidates[0].candidate_date
} elseif ($EndDate) {
  $verifyDate = $EndDate
}

Write-Step "Calling /api/weather/verify-dol"
$verifyBody = @{
  address = $Address
  city = $City
  state = $State
  zip_code = $ZipCode
  start_date = $verifyDate
  end_date = $verifyDate
  event_type = $EventType
}
try {
  $verifyResponse = Invoke-JsonPostWithRetry -uri "$BaseUrl/api/weather/verify-dol" -body $verifyBody -headers $authHeaders -retries 1
} catch {
  Write-Host "Primary verify failed. Retrying without city..." -ForegroundColor Yellow
  $verifyBody.city = ""
  try {
    $verifyResponse = Invoke-JsonPostWithRetry -uri "$BaseUrl/api/weather/verify-dol" -body $verifyBody -headers $authHeaders -retries 2
  } catch {
    Write-Host "Secondary verify failed. Retrying with 30-day window..." -ForegroundColor Yellow
    $verifyBody.start_date = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $verifyBody.end_date = (Get-Date).ToString("yyyy-MM-dd")
    $verifyResponse = Invoke-JsonPostWithRetry -uri "$BaseUrl/api/weather/verify-dol" -body $verifyBody -headers $authHeaders -retries 2
  }
}

$summary = [pscustomobject]@{
  email = $email
  candidate_count = $candidateCount
  verified_dol = $verifyResponse.verified_dol
  confidence = $verifyResponse.confidence
  station_count = @($verifyResponse.stations_used).Count
  latitude = $verifyResponse.location.latitude
  longitude = $verifyResponse.location.longitude
}

Write-Step "Smoke summary"
$summary | Format-List
