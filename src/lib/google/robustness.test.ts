// Google calls degrade to typed GoogleApiErrors: malformed bodies, unreachable hosts and hung connections never
// surface as raw SyntaxErrors or stuck requests.
import { beforeEach, describe, expect, it } from "vitest";
import { clearGoogleTokenCache, googleJson, GoogleApiError, TOKEN_URL, type GoogleConfig } from "./oauth";

const cfg: GoogleConfig = { clientId: "test-client", clientSecret: "test-secret", refreshToken: "test-refresh" };
const token = () => new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });

describe("googleJson robustness", () => {
  beforeEach(() => clearGoogleTokenCache());

  it("an HTML error page is a typed error, not a SyntaxError", async () => {
    const f = (async (url: string) => (url === TOKEN_URL ? token() : new Response("<html>502 Bad Gateway</html>", { status: 502 }))) as unknown as typeof fetch;
    const e = await googleJson(cfg, "https://www.googleapis.com/calendar/v3/x", {}, f).catch((x) => x);
    expect(e).toBeInstanceOf(GoogleApiError);
    expect(e).toMatchObject({ code: "http", httpStatus: 502, message: "Google API returned a response that is not JSON (502)." });
  });

  it("unreachable / timed-out calls are network errors, and every call carries a timeout signal", async () => {
    const signals: (AbortSignal | null | undefined)[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      signals.push(init?.signal);
      if (url === TOKEN_URL) return token();
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }) as unknown as typeof fetch;
    const e = await googleJson(cfg, "https://gmail.googleapis.com/gmail/v1/users/me/profile", {}, f).catch((x) => x);
    expect(e).toMatchObject({ code: "network" });
    expect(e.message).toMatch(/Google API unreachable: .*timeout/);
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
  });
});
