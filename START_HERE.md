# Start here — run Deal Desk on your laptop

Unzip this folder. Do **not** look for extra sidebar items. Click **Today** or **Pipeline**, then click the company row.

## 1. Install Node (once)

You need Node 20 or newer. In a terminal:

```bash
node -v
```

If that fails, or the version is 18 or older:

- macOS: https://nodejs.org (LTS) or `brew install node`
- Windows: https://nodejs.org (LTS) or `winget install OpenJS.NodeJS.LTS`, then close and reopen the terminal
- Ubuntu: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs`

## 2. Put the env file in place

You need **`dealdesk.env`** (the secret bundle you already have). It is **not** inside this zip.

Put it in any one of these places:

- inside this folder, next to `setup.sh`
- your **Downloads** folder
- your **Desktop** folder

Never commit it, paste it into a chat, or upload it.

If you do not have `dealdesk.env`, copy `.env.example` to `.env.local` and fill the keys there. The ones the demo video needs:

- `CRUSTDATA_API_KEY`
- `OPENAI_API_KEY` (only if you will show `/ask`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and either `GOOGLE_REFRESH_TOKEN` or a sign-in from Settings
- `DEMO_RECIPIENT_ALLOWLIST` — your two Gmail addresses, comma-separated
- leave `OUTBOUND_MODE=dry_run` for the shoot (nothing is actually sent)

The Google OAuth redirect is `http://localhost:3000/api/oauth/google/callback`, so the app **must** run on port 3000.

## 3. One command to install and start

In this folder:

**macOS / Linux**

```bash
./setup.sh
```

**Windows (PowerShell)**

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

That installs packages, writes `.env.local`, runs the doctor, and starts **http://localhost:3000**.

Later starts (after the first time):

```bash
npm run dev:demo
```

Open http://localhost:3000/settings?section=connectors

- Gmail and Calendar should say **Connected as …**
- Crustdata should say connected
- If Gmail is not connected: click **Connect**, allow access, come back. If Google says `redirect_uri_mismatch`, you are not on port 3000.

## 4. Warm the cache (5 minutes, before you press record)

In the same browser:

1. Open http://localhost:3000/deal?domain=e2b.dev and wait until numbers appear
2. Open http://localhost:3000/deal?domain=efficieno.ai and wait until it finishes (this is the company you will show)

Repeats after this cost 0 Crustdata credits.

## 5. Send the founder email (so Today / Pipeline have something to click)

From **shiwanimishra418@gmail.com**, Compose:

- **To:** the Gmail that Settings › Connectors shows as connected (Saurabh’s inbox)
- **Subject (copy exactly):** `Efficieno AI (efficieno.ai) — seed pitch`
- **Body:** any short pitch; include `https://efficieno.ai` once
- Click **Send**

The subject **must** contain `efficieno.ai`. If it does not, the row will not become a deal.

Wait a few seconds, then refresh Deal Desk.

## 6. What you click on camera (no address-bar domains)

The left sidebar is unchanged. It still says **Today**, **Pipeline**, **Portfolio**, **Agents**, **Runs**, **Review**, **Firm brain**, **Settings**.

**Path A — Today**

1. In the left sidebar, under **Work**, click **Today** (sun icon, first item)
2. On the page, the left card is titled **Inbound**
3. Click the row whose subject is the Efficieno pitch. The right side of that row says **Open deal**
4. Wait for the deal page to load
5. Click any number to show its Crustdata source
6. At the top right of the deal header, click **IC memo** (there is no “Proceed to diligence” button)

**Path B — Pipeline (same deal, different tab)**

1. In the left sidebar, under **Work**, click **Pipeline** (stacked-layers icon, under Today)
2. Click the Efficieno row in the list
3. Same deal page as above

**On the IC memo**

1. Scroll the memo
2. Click **Find a 30-min slot**, click a time, click **Approve & book …**
3. Click **Review email**, then **Approve & send to …**
4. Dry run: the app shows what it would send. Nothing leaves the laptop

**Optional Ask beat**

1. Sidebar → **Assistant**, or open http://localhost:3000/ask
2. Type a plain-English request and press Enter

## 7. Record settings

- Browser window 1440×900, zoom 100%
- One tab, notifications off
- Loom, ≤ 2 minutes
- Mic permission for localhost if you show voice

## If something is red

| What you see | What to do |
| --- | --- |
| Gmail / Calendar not connected | Settings › Connectors › Gmail › **Connect**. App must be on port 3000 |
| Inbox empty | Send the founder email again; subject must contain `efficieno.ai`; refresh Today |
| Pipeline empty | Same email, or type `efficieno.ai` in **Research a company** on Pipeline (off camera), then the row appears |
| Crustdata error | Re-open a company you already loaded (cache). Or wait 20 seconds and retry |
| `/ask` says model unavailable | Skip it; use `/agent` instead |
| You want a real email to yourself | Set `OUTBOUND_MODE=live` in `.env.local`, keep `DEMO_RECIPIENT_ALLOWLIST` to only your two addresses, restart `npm run dev:demo` |
