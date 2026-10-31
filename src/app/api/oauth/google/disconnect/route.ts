// POST /api/oauth/google/disconnect → removes the locally stored sign-in (.dealdesk/google-token.json).
// A GOOGLE_REFRESH_TOKEN in the environment is not touched (remove it from .env.local to fully disconnect).
import { NextResponse } from "next/server";
import { clearGoogleTokenCache } from "@/lib/google/oauth";
import { deleteStoredToken } from "@/lib/google/token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const removed = deleteStoredToken();
  clearGoogleTokenCache();
  const envToken = Boolean(process.env.GOOGLE_REFRESH_TOKEN?.trim());
  return NextResponse.json({ status: "ok", removed, message: removed ? (envToken ? "Signed-in token removed; GOOGLE_REFRESH_TOKEN from .env.local is still in use." : "Google disconnected.") : envToken ? "Google is connected through GOOGLE_REFRESH_TOKEN in .env.local; remove it there to disconnect." : "Nothing to disconnect." });
}
