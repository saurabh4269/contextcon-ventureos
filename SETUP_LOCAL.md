# Run Deal Desk on your own computer

## Quick start (Ubuntu / macOS)

1. `tar xzf dealdesk-kit.tar.gz && cd dealdesk-kit/dealdesk` (the kit holds the repo plus `dealdesk.env`)
2. Node 20 or newer: `node -v` (Ubuntu: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`)
3. `./setup.sh ../dealdesk.env` (installs, writes `.env.local`, runs the doctor, starts on http://localhost:3000)
4. Open http://localhost:3000/settings?section=connectors. Gmail and Calendar should read *Connected as you@example.com*
5. To send for real, set `OUTBOUND_MODE=live` in `.env.local`, then run `npm run dev:demo`. Sends go only to your two addresses, and only after an Approve click

Re-check any time with `npm run doctor`.

This guide takes you from a fresh laptop to the full demo, with real Crustdata data, the AI agent, and Gmail and Calendar on
**you@example.com**. It works on Windows (PowerShell), macOS and Linux. It takes about 5 minutes; most of that is `npm ci`.

## What you need

- **Node.js 20 or newer.** On Windows, install it from https://nodejs.org (LTS) or run `winget install OpenJS.NodeJS.LTS`, then reopen PowerShell.
- **This repository**, either cloned or unzipped.
- **`dealdesk.env`**, the env bundle that holds every key the demo needs: Crustdata primary and backup, OpenAI, Google client and refresh token, and ElevenLabs.
  - It is secret. Never commit it, paste it into a chat, or upload it.
  - Put it in the repo folder, or in your Downloads or Desktop folder. The setup script finds it in any of those places.

The Google OAuth client already exists (project `dealdesk-ventureos`). Its registered redirect is
`http://localhost:3000/api/oauth/google/callback`, so **the demo runs on port 3000**. You don't need Google Cloud Console.

## One command

**Windows** (PowerShell, in the repo folder):

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
# or point at the bundle explicitly:
powershell -ExecutionPolicy Bypass -File .\setup.ps1 -EnvFile "$env:USERPROFILE\Downloads\dealdesk.env"
```

**macOS / Linux:**

```bash
./setup.sh                      # or: ./setup.sh ~/Downloads/dealdesk.env
```

The script runs these steps in order:

1. Checks that Node is version 20 or newer.
2. Runs `npm ci`.
3. Copies `dealdesk.env` to `.env.local`.
   - If there is no bundle, it copies `.env.example` and asks for each key with hidden input.
   - If `.env.local` already exists, it is kept. Pass `-ForceEnv` or `--force-env` to replace it.
4. Runs the **preflight**: `npx tsx scripts/preflight.ts`.
   - It checks which keys are set and pings Crustdata (both keys), the model and the app.
   - It prints set or missing for each key, never a value.
5. Starts the app on **http://localhost:3000** with `npm run dev:demo` and opens `/landing`.

Later runs only need `npm run dev:demo`. Pass `-NoStart` or `--no-start` to set up without starting the app.

## Check it is connected

Open **Settings › Connectors** (http://localhost:3000/settings?section=connectors):

- **Gmail** and **Google Calendar** should read *Connected as you@example.com*. The status comes from live API calls, not from the env file.
- **Crustdata** should show as connected. If the primary key runs out of credits (402 or 429 quota), the app switches to
  `CRUSTDATA_API_KEY_BACKUP` on its own. The trace then shows **Backup Crustdata key (primary out of credits)**.

### Optional: reconnect Google

Do this only if Gmail shows an error such as `invalid_grant` (the token expired or was revoked), or if you want to use a different account:

1. Settings › Connectors › Gmail › **Connect**.
2. Google's consent screen opens, with you@example.com pre-selected. Allow Gmail send/modify and Calendar.
3. You return to Settings. The new token is saved to `.dealdesk/google-token.json`, which is gitignored and readable only by you, and it takes precedence over `GOOGLE_REFRESH_TOKEN`.
4. **Disconnect** removes that saved sign-in.

If Google shows `redirect_uri_mismatch`, the app is not on port 3000. Use `npm run dev:demo`.

## Sending for real: the safety rules

- The default is `OUTBOUND_MODE=dry_run`. Approving shows exactly what would be sent, and nothing leaves the app.
- To send for real, set `OUTBOUND_MODE=live` (or `OUTBOUND_LIVE=1`) in `.env.local` and restart. The preflight then shows a ! warning naming the allowlist. Even in live mode:
  - Mail and calendar attendees are limited to `DEMO_RECIPIENT_ALLOWLIST`. The default is `you@example.com,saurabhgupta0342@gmail.com`.
    Any other address is blocked with *"Blocked: x is not on the demo allowlist …"*.
  - Every send or booking needs an explicit **Approve** click. The server mints a single-use approval token for the exact message you previewed. It expires after 10 minutes, and if anything in the message changes, you have to approve again.
  - Calendar events are created with `sendUpdates=none`, so no invitation emails go out.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `node` not found, or the version is too old | Install Node 20 LTS or newer, then reopen the terminal |
| PowerShell says "running scripts is disabled" | Use `powershell -ExecutionPolicy Bypass -File .\setup.ps1` |
| Port 3000 is in use | Close the other app, or on Windows find it with `netstat -ano \| findstr :3000` |
| Preflight shows ✗ for Crustdata | That key is invalid or out of credits. If the backup ping passes, the app uses it automatically |
| Preflight shows ✗ for the model | Check `OPENAI_API_KEY`. `/agent` works without a model, as the deterministic fallback |
| Gmail shows *invalid_grant* | Reconnect Google (see above) |

See `docs/DEMO_RUNBOOK.md` for the click path and fallbacks.
