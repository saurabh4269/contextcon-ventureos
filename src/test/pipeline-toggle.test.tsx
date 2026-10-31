// The Table / Board toggle must not offer a Board link that leads back to the same table.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Toggle2 } from "@port/screens/pipeline";

describe("pipeline layout toggle", () => {
  it("links to the board when there is one", () => {
    const html = renderToStaticMarkup(<Toggle2 board={false} />);
    expect(html).toContain('href="/pipeline?board=1"');
  });
  it("keeps the Board option but inert, with the reason, when live data has no board", () => {
    const html = renderToStaticMarkup(<Toggle2 board={false} boardOff="Board view is not available" />);
    expect(html).not.toContain("board=1");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('title="Board view is not available"');
  });
});
