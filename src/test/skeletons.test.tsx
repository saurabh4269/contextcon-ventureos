// Loading states carry no data: pulse blocks only, announced as busy, one per screen.
import { ResultSkeleton } from "@/live/screen/views";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrainSkeleton, DealSkeleton, MemoSkeleton, PortfolioSkeleton, ReviewSkeleton, SettingsSkeleton } from "@port/components/skeletons";

const cases = { BrainSkeleton, DealSkeleton, MemoSkeleton, PortfolioSkeleton, ReviewSkeleton, SettingsSkeleton } as const;
describe("skeletons", () => {
  for (const [name, C] of Object.entries(cases)) {
    it(`${name} is busy, has pulse blocks and no text`, () => {
      const html = renderToStaticMarkup(<C />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain("animate-pulse");
      expect(html.replace(/<[^>]*>/g, "").trim()).toBe("");
    });
  }
  it("SettingsSkeleton draws one tile per connector in the catalogue", () => {
    const n = (renderToStaticMarkup(<SettingsSkeleton connectors={7} />).match(/h-\[252px\]/g) ?? []).length;
    expect(n).toBe(7);
  });
  it("the pending Ask result reserves the finished result's blocks (summary, three filter cards, table and cards) with no text", () => {
    const html = renderToStaticMarkup(<ResultSkeleton />);
    expect(html).toContain('data-testid="result-placeholder"');
    expect(html).toContain("h-[152.5px]"); // the table card
    expect(html.match(/h-\[164px\]/g)).toHaveLength(2); // the two phone cards
    expect(html.replace(/<[^>]*>/g, "").trim()).toBe("");
  });
});
