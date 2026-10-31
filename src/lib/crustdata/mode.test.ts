import { describe, expect, it } from "vitest";
import { CrustdataConfigError, resolveCrustdataMode } from "./mode";

describe("Crustdata mode", () => {
  it("requires API key or DEALDESK_FIXTURES=1", () => {
    const prevFix = process.env.DEALDESK_FIXTURES;
    const prevKey = process.env.CRUSTDATA_API_KEY;
    const prevForce = process.env.CRUSTDATA_FORCE_FIXTURE;
    delete process.env.DEALDESK_FIXTURES;
    delete process.env.CRUSTDATA_API_KEY;
    delete process.env.CRUSTDATA_FORCE_FIXTURE;
    delete process.env.DEALDESK_FORCE_FIXTURE;
    expect(() => resolveCrustdataMode()).toThrow(CrustdataConfigError);
    process.env.DEALDESK_FIXTURES = "1";
    expect(resolveCrustdataMode()).toBe("fixture");
    process.env.CRUSTDATA_API_KEY = "test-key";
    expect(resolveCrustdataMode()).toBe("live");
    if (prevFix !== undefined) process.env.DEALDESK_FIXTURES = prevFix;
    else delete process.env.DEALDESK_FIXTURES;
    if (prevKey !== undefined) process.env.CRUSTDATA_API_KEY = prevKey;
    else delete process.env.CRUSTDATA_API_KEY;
    if (prevForce !== undefined) process.env.CRUSTDATA_FORCE_FIXTURE = prevForce;
    else delete process.env.CRUSTDATA_FORCE_FIXTURE;
  });
});
