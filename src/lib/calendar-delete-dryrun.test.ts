// DELETE /api/connectors/calendar/events/:id contacts nobody but still changes the user's calendar: in dry-run mode
// (the default) it must not call Google.
import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/connectors/calendar/events/[id]/route";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/memory/store", () => ({ recordMemory: async () => ({ status: "unavailable", reason: "test" }) }));

const call = (id: string) => DELETE(new Request(`http://x/api/connectors/calendar/events/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) });

describe("calendar delete respects OUTBOUND_MODE", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("dry run: answers with the dry-run envelope and never calls Google", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    vi.stubEnv("GOOGLE_CLIENT_ID", "id"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret"); vi.stubEnv("GOOGLE_REFRESH_TOKEN", "token");
    const r = await call("abc123");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ transport: "dry_run", label: expect.stringContaining("not sent"), wouldSend: { eventId: "abc123", sendUpdates: "none" } });
    expect(f).not.toHaveBeenCalled();
  });
  it("still validates the id before anything else", async () => {
    expect((await call("bad id!")).status).toBe(400);
  });
});
