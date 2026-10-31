// Local store for the Google refresh token minted by the in-app sign-in (/api/google/auth → /api/google/callback).
// One JSON file, gitignored (.dealdesk/), written with 0600 permissions. Path: DEALDESK_GOOGLE_TOKEN_FILE, default
// <cwd>/.dealdesk/google-token.json; "off" disables the store (the test suite sets this). Values are never logged.
import fs from "node:fs";
import path from "node:path";

export type StoredGoogleToken = { refreshToken: string; email: string | null; scopes: string[]; connectedAt: string };

export function tokenFile(): string | null {
  const p = process.env.DEALDESK_GOOGLE_TOKEN_FILE?.trim();
  if (p === "off") return null;
  return p || path.join(process.cwd(), ".dealdesk", "google-token.json");
}

export function readStoredToken(file = tokenFile()): StoredGoogleToken | null {
  if (!file) return null;
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<StoredGoogleToken>;
    if (typeof j.refreshToken !== "string" || !j.refreshToken) return null;
    return { refreshToken: j.refreshToken, email: typeof j.email === "string" ? j.email : null, scopes: Array.isArray(j.scopes) ? j.scopes.filter((s): s is string => typeof s === "string") : [], connectedAt: typeof j.connectedAt === "string" ? j.connectedAt : "" };
  } catch {
    return null;
  }
}

export function writeStoredToken(t: StoredGoogleToken, file = tokenFile()): void {
  if (!file) throw new Error("Google token store is disabled (DEALDESK_GOOGLE_TOKEN_FILE=off).");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(t, null, 2), { mode: 0o600 });
}

export function deleteStoredToken(file = tokenFile()): boolean {
  if (!file || !fs.existsSync(file)) return false;
  fs.rmSync(file);
  return true;
}
