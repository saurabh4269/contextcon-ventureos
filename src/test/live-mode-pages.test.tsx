// DEALDESK_DATA_MODE=live: a screen with no live source renders its unavailable state, never port/src/fixtures.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { DataModeProvider } from "@/components/datamode";
import type { DataMode } from "@/lib/datamode";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const params = <T extends object>(v: T) => Object.assign(Promise.resolve(v), { status: "fulfilled" as const, value: v });
const render = (el: ReactElement, mode: DataMode) => renderToStaticMarkup(<DataModeProvider mode={mode}>{el}</DataModeProvider>);
const FIXTURE_WORDS = /Helio|Halyard|Cobalt|NexaFlow|Keel|Maya Kapoor|Priya Shah/;

describe("live mode shows no fixtures on screens without a source", () => {
  const cases: [string, () => Promise<{ default: (p: { searchParams: Promise<never> }) => ReactElement }>, string][] = [
    ["/agents", () => import("@/app/agents/page") as never, "agents"],
    ["/mandates", () => import("@/app/mandates/page") as never, "mandates"],
    ["/slack", () => import("@/app/slack/page") as never, "slack"],
    ["/slack?state=vote", () => import("@/app/slack/page") as never, "slack"],
  ];
  for (const [route, load, screen] of cases) {
    it(`${route} renders the unavailable state`, async () => {
      const Page = (await load()).default;
      const html = render(<Page searchParams={params(route.includes("vote") ? { state: "vote" } : {}) as never} />, "live");
      expect(html).toContain(`data-screen="${screen}"`);
      expect(html).not.toMatch(FIXTURE_WORDS);
    });
  }
  it("/preview/slack renders the unavailable state", async () => {
    const Page = (await import("@/app/preview/slack/page")).default;
    const html = render(<Page />, "live");
    expect(html).toContain('data-screen="slack"');
    expect(html).not.toMatch(FIXTURE_WORDS);
  });
  it("the badge never says Demo data in live mode", () => {
    const html = render(<div />, "live");
    expect(html).not.toContain("Demo data");
    expect(html).toContain("Live · no data source for this screen");
  });
});
