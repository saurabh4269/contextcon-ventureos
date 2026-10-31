import { describe, expect, it } from "vitest";
import { safeDecode } from "./decode";

describe("safeDecode", () => {
  it("decodes once-encoded ids", () => expect(safeDecode("e2b%2Edev")).toBe("e2b.dev"));
  it("does not throw on a stray percent sign (was a 500)", () => expect(safeDecode("%E0%")).toBe("%E0%"));
});
