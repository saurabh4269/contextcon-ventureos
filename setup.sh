#!/usr/bin/env bash
# Deal Desk — one-command local setup (macOS / Linux). Windows: run setup.ps1 instead.
#   ./setup.sh [path/to/dealdesk.env] [--no-start] [--force-env]
# 1) checks Node ≥ 20  2) npm ci  3) creates .env.local (from dealdesk.env if found, else .env.example + prompts)
# 4) runs the preflight (key presence + free health pings; values are never printed)  5) starts the app on :3000
set -euo pipefail
cd "$(dirname "$0")"

BUNDLE="" START=1 FORCE=0
for a in "$@"; do
  case "$a" in
    --no-start) START=0 ;;
    --force-env) FORCE=1 ;;
    *) BUNDLE="$a" ;;
  esac
done

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "1/5 Node"
if ! command -v node >/dev/null 2>&1; then echo "Node.js is not installed. Install Node 20 or newer from https://nodejs.org and re-run."; exit 1; fi
MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$MAJOR" -lt 20 ]; then echo "Node $(node -v) found; Deal Desk needs Node 20 or newer (https://nodejs.org)."; exit 1; fi
echo "node $(node -v), npm $(npm -v)"

say "2/5 Dependencies"
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

say "3/5 Environment (.env.local)"
if [ -z "$BUNDLE" ]; then
  for c in ./dealdesk.env ../dealdesk.env "$HOME/Downloads/dealdesk.env" "$HOME/Desktop/dealdesk.env"; do
    if [ -f "$c" ]; then BUNDLE="$c"; break; fi
  done
fi
if [ -f .env.local ] && [ "$FORCE" -eq 0 ]; then
  echo ".env.local already exists; keeping it (use --force-env to replace it)."
elif [ -n "$BUNDLE" ]; then
  [ -f "$BUNDLE" ] || { echo "Env bundle not found: $BUNDLE"; exit 1; }
  cp "$BUNDLE" .env.local && chmod 600 .env.local
  echo "Copied $BUNDLE → .env.local"
else
  cp .env.example .env.local && chmod 600 .env.local
  echo "No dealdesk.env found. Enter keys (input hidden; press Enter to skip an optional one)."
  setkey() { # name, prompt
    local v; read -r -s -p "$2: " v; echo
    [ -z "$v" ] && return 0
    node -e 'const fs=require("fs"),[k,v]=process.argv.slice(1);let s=fs.readFileSync(".env.local","utf8");const re=new RegExp("^"+k+"=.*$","m");s=re.test(s)?s.replace(re,()=>k+"="+v):s+"\n"+k+"="+v+"\n";fs.writeFileSync(".env.local",s,{mode:0o600})' "$1" "$v"
  }
  setkey CRUSTDATA_API_KEY "CRUSTDATA_API_KEY (required)"
  setkey CRUSTDATA_API_KEY_BACKUP "CRUSTDATA_API_KEY_BACKUP (optional failover)"
  setkey OPENAI_API_KEY "OPENAI_API_KEY (required for the AI agent)"
  setkey GOOGLE_CLIENT_ID "GOOGLE_CLIENT_ID (optional, for Gmail/Calendar)"
  setkey GOOGLE_CLIENT_SECRET "GOOGLE_CLIENT_SECRET (optional)"
  setkey GOOGLE_REFRESH_TOKEN "GOOGLE_REFRESH_TOKEN (optional; or sign in from Settings › Connectors)"
  setkey ELEVENLABS_API_KEY "ELEVENLABS_API_KEY (optional, voice)"
fi

say "4/5 Preflight"
npx tsx scripts/preflight.ts || echo "Preflight reported a problem (above). The app still starts; fix the ✗ lines for the full demo."

if [ "$START" -eq 1 ]; then
  say "5/5 Starting Deal Desk on http://localhost:3000  (Ctrl+C to stop)"
  ( sleep 8; (command -v open >/dev/null && open http://localhost:3000/landing) || (command -v xdg-open >/dev/null && xdg-open http://localhost:3000/landing) || true ) >/dev/null 2>&1 &
  exec npm run dev:demo
else
  say "5/5 Done. Start with: npm run dev:demo  → http://localhost:3000"
fi
