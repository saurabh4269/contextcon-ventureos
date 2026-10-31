// Loading states carry no data: pulse blocks only, announced as busy, one per screen.
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
});
