param(
  [string]$TokenPath = "",
  [switch]$RunLocalBuild
)

$ErrorActionPreference = "Stop"

function Invoke-Native([scriptblock]$Command) {
  $previous = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = & $Command 2>&1
    $exitCode = $LASTEXITCODE
    return @{
      Output = $output
      ExitCode = $exitCode
    }
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Read-ProjectJson([string]$Path) {
  if (-not (Test-Path $Path)) {
    return $null
  }
  return Get-Content $Path -Raw | ConvertFrom-Json
}

function Assert-Eden2Link([string]$Dir, [string]$Scope, [string]$Token) {
  $projectFile = Join-Path $Dir ".vercel/project.json"
  $project = Read-ProjectJson $projectFile

  if ($project -and $project.projectName -eq "eden2") {
    return
  }

  Write-Host "Linking $Dir to existing Vercel project 'eden2'..."
  Push-Location $Dir
  try {
    $result = if ($Token) {
      Invoke-Native { npx vercel link --yes --project eden2 --scope $Scope --token $Token }
    } else {
      Invoke-Native { npx vercel link --yes --project eden2 --scope $Scope }
    }
    if ($result.ExitCode -ne 0) {
      throw ("Vercel link failed in {0}: {1}" -f $Dir, ($result.Output -join "`n"))
    }
  } finally {
    Pop-Location
  }

  $linked = Read-ProjectJson $projectFile
  if (-not $linked -or $linked.projectName -ne "eden2") {
    throw "Vercel link check failed in $Dir. Expected projectName='eden2'."
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$frontendRoot = $repoRoot
$appDir = Join-Path $repoRoot "frontend"
$deployDir = $repoRoot
$scope = "team_sgUnwrDyrMp8pPKOIZN0qUlz"
$productionAlias = "https://eden2-five.vercel.app"

if (-not (Test-Path $appDir)) {
  throw "App directory not found: $appDir"
}

$token = $env:VERCEL_TOKEN
if (-not $token) {
  if (-not $TokenPath -and $env:VERCEL_TOKEN_PATH) {
    $TokenPath = $env:VERCEL_TOKEN_PATH
  }
  if ($TokenPath -and (Test-Path $TokenPath)) {
    $token = (Get-Content $TokenPath -Raw).Trim()
  }
}

if (-not $token) {
  Write-Host "No token loaded. Using local Vercel auth session if available."
}

Assert-Eden2Link -Dir $frontendRoot -Scope $scope -Token $token
Assert-Eden2Link -Dir $appDir -Scope $scope -Token $token

Push-Location $deployDir
try {
  if ($RunLocalBuild) {
    Write-Host "Building frontend (optional local check)..."
    Push-Location $appDir
    try {
      cmd /c "set CI=false&& npm run build" | Out-Host
      if ($LASTEXITCODE -ne 0) {
        throw "Local frontend build failed."
      }
    } finally {
      Pop-Location
    }
  }

  Write-Host "Deploying production build to project 'eden2'..."
  $deploy = if ($token) {
    Invoke-Native { npx vercel deploy --prod --yes --scope $scope --token $token }
  } else {
    Invoke-Native { npx vercel deploy --prod --yes --scope $scope }
  }
  $deploy.Output | Out-Host
  if ($deploy.ExitCode -ne 0) {
    throw ("Vercel deploy failed: {0}" -f ($deploy.Output -join "`n"))
  }

  $project = Read-ProjectJson ".vercel/project.json"
  if (-not $project -or $project.projectName -ne "eden2") {
    throw "Post-deploy link check failed. Project is not 'eden2'."
  }

  Write-Host "Verifying production alias..."
  try {
    $resp = Invoke-WebRequest -Uri $productionAlias -Method Head -UseBasicParsing -TimeoutSec 30
    if ($resp.StatusCode -lt 200 -or $resp.StatusCode -ge 400) {
      throw "Unexpected status code from $productionAlias : $($resp.StatusCode)"
    }
  } catch {
    throw "Alias check failed for $productionAlias. $($_.Exception.Message)"
  }

  Write-Host "Deploy guard passed. Production alias is reachable at $productionAlias"
} finally {
  Pop-Location
}
