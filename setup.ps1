# Deal Desk — one-command local setup (Windows PowerShell 5.1+ / PowerShell 7). macOS/Linux: ./setup.sh
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1 [-EnvFile C:\path\dealdesk.env] [-NoStart] [-ForceEnv]
# 1) checks Node >= 20  2) npm ci  3) creates .env.local (from dealdesk.env if found, else .env.example + prompts)
# 4) runs the preflight (key presence + free health pings; values are never printed)  5) starts the app on :3000
param([string]$EnvFile = "", [switch]$NoStart, [switch]$ForceEnv)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
function Say($m) { Write-Host "`n$m" -ForegroundColor Cyan }

Say "1/5 Node"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "Node.js is not installed. Install Node 20 LTS or newer from https://nodejs.org (or: winget install OpenJS.NodeJS.LTS), reopen PowerShell and re-run."; exit 1 }
$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 20) { Write-Host "Node $(node -v) found; Deal Desk needs Node 20 or newer (https://nodejs.org)."; exit 1 }
Write-Host "node $(node -v), npm $(npm -v)"

Say "2/5 Dependencies"
if (Test-Path package-lock.json) { npm ci --no-audit --no-fund } else { npm install --no-audit --no-fund }
if ($LASTEXITCODE -ne 0) { Write-Host "npm install failed (above)."; exit 1 }

Say "3/5 Environment (.env.local)"
if (-not $EnvFile) {
  foreach ($c in @(".\dealdesk.env", "..\dealdesk.env", "$env:USERPROFILE\Downloads\dealdesk.env", "$env:USERPROFILE\Desktop\dealdesk.env")) {
    if (Test-Path $c) { $EnvFile = $c; break }
  }
}
if ((Test-Path .env.local) -and -not $ForceEnv) {
  Write-Host ".env.local already exists; keeping it (use -ForceEnv to replace it)."
} elseif ($EnvFile) {
  if (-not (Test-Path $EnvFile)) { Write-Host "Env bundle not found: $EnvFile"; exit 1 }
  Copy-Item $EnvFile .env.local -Force
  Write-Host "Copied $EnvFile -> .env.local"
} else {
  Copy-Item .env.example .env.local -Force
  Write-Host "No dealdesk.env found. Enter keys (input hidden; press Enter to skip an optional one)."
  function Set-Key($name, $prompt) {
    $sec = Read-Host -AsSecureString $prompt
    $v = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    if (-not $v) { return }
    $lines = Get-Content .env.local
    $found = $false
    $lines = $lines | ForEach-Object { if ($_ -match "^$name=") { $found = $true; "$name=$v" } else { $_ } }
    if (-not $found) { $lines += "$name=$v" }
    Set-Content -Path .env.local -Value $lines -Encoding ascii
  }
  Set-Key CRUSTDATA_API_KEY "CRUSTDATA_API_KEY (required)"
  Set-Key CRUSTDATA_API_KEY_BACKUP "CRUSTDATA_API_KEY_BACKUP (optional failover)"
  Set-Key OPENAI_API_KEY "OPENAI_API_KEY (required for the AI agent)"
  Set-Key GOOGLE_CLIENT_ID "GOOGLE_CLIENT_ID (optional, for Gmail/Calendar)"
  Set-Key GOOGLE_CLIENT_SECRET "GOOGLE_CLIENT_SECRET (optional)"
  Set-Key GOOGLE_REFRESH_TOKEN "GOOGLE_REFRESH_TOKEN (optional; or sign in from Settings > Connectors)"
  Set-Key ELEVENLABS_API_KEY "ELEVENLABS_API_KEY (optional, voice)"
}

Say "4/5 Preflight"
npx tsx scripts/preflight.ts
if ($LASTEXITCODE -ne 0) { Write-Host "Preflight reported a problem (above). The app still starts; fix the x lines for the full demo." -ForegroundColor Yellow }

if (-not $NoStart) {
  Say "5/5 Starting Deal Desk on http://localhost:3000  (Ctrl+C to stop)"
  Start-Job -ScriptBlock { Start-Sleep 10; Start-Process "http://localhost:3000/landing" } | Out-Null
  npm run dev:demo
} else {
  Say "5/5 Done. Start with: npm run dev:demo  -> http://localhost:3000"
}
