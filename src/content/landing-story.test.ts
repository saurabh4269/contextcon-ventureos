import fs from "node:fs";
import path from "node:path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LandingStorySections } from "@/app/landing/story";
import { landingCopy } from "./landing";
import { askHref, landingStory } from "./landing-story";

// vitest compiles .tsx with the classic JSX transform (tsconfig "jsx": "preserve"), which expects a global React.
(globalThis as { React?: typeof React }).React = React;

/** Every string in the story except the quoted user request (which is input, not a claim). */
function claims(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk({ ...landingStory, flow: { ...landingStory.flow, request: "" } });
  return out;
}

describe("landing value story", () => {
  it("states no numbers: no invented customers, prices, savings or counts", () => {
    const withDigits = claims().filter((s) => /\d/.test(s) && !s.startsWith("/"));
    expect(withDigits).toEqual([]);
    expect(landingCopy.hero.sub).not.toMatch(/\d/);
  });

  it("labels pricing as a hypothesis", () => {
    expect(landingStory.value.pricing.badge.toLowerCase()).toContain("hypothesis");
    expect(landingStory.value.pricing.line).toMatch(/not yet tested/i);
  });

  it("walks request → plan → Crustdata → checks → a person for exceptions → finished work", () => {
    expect(landingStory.flow.steps.map((s) => s.id)).toEqual(["request", "plan", "crustdata", "checks", "exceptions", "done"]);
    expect(landingStory.flow.steps.filter((s) => s.person).map((s) => s.id)).toEqual(["exceptions"]);
  });

  it("names only Crustdata endpoints the client really calls", () => {
    const client = fs.readFileSync(path.join(process.cwd(), "src/lib/crustdata/client.ts"), "utf8");
    const endpoints = landingStory.flow.steps.flatMap((s) => s.endpoints ?? []);
    expect(endpoints.length).toBeGreaterThan(0);
    for (const e of endpoints) expect(client, e).toContain(`"${e}"`);
  });

  it("renders both sections, every step, and a link that runs the sample request", () => {
    const html = renderToStaticMarkup(createElement(LandingStorySections, { d: landingStory, still: true }));
    expect(html).toContain('id="value"');
    expect(html).toContain('id="how"');
    for (const s of landingStory.flow.steps) expect(html).toContain(s.title.replace(/’/g, "’"));
    expect(html).toContain(askHref(landingStory.flow.request).replace(/&/g, "&amp;"));
    // the in-page nav points at sections that exist
    for (const n of landingCopy.nav.filter((n) => n.href.startsWith("#"))) expect(html).toContain(`id="${n.href.slice(1)}"`);
  });
});
