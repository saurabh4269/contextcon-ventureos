#!/usr/bin/env node
/**
 * Rebuild Crustdata OpenAPI specs (2025-11-01) from the public API-reference Markdown pages.
 *
 * The raw `/openapi-specs/2025-11-01/*.yaml` URLs redirect to a login page (docs/crustdata/AMBIGUITIES.md #1), but
 * every reference page embeds the full spec for its operation in a ````yaml <spec-path> <method> <path> fence.
 * We fetch the pages we use, merge paths + components per spec file, and write docs/crustdata/openapi/<spec>.yaml.
 * Then `npm run crustdata:codegen` turns them into src/lib/crustdata/generated/<spec>.ts.
 */
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const BASE = "https://docs.crustdata.com/api-reference/";
const PAGES = [
  "company-apis/identify-a-company-from-name-domain-id-or-profile-url",
  "company-apis/get-full-company-enrichment",
  "company-apis/search-companies-with-indexed-fields-only",
  "person-apis/search-people-using-filters-and-sorting",
  "person-apis/enrich-person-profiles-from-cached-dataset",
  "job-apis/search-the-indexed-job-dataset",
  "web-apis/web-search",
];
const OUT = path.join(process.cwd(), "docs/crustdata/openapi");

const FENCE = /^(`{3,})yaml(?:[ \t]+(\S+)[ \t]+(\w+)[ \t]+(\S+))?[ \t]*\n([\s\S]*?)^\1[ \t]*$/gm;

function specNameFrom(specPath, doc) {
  if (specPath) return path.basename(specPath, ".yaml");
  // AMBIGUITIES #2: some pages use a bare fence — infer from info.title ("Company API - …").
  const title = String(doc?.info?.title ?? "").toLowerCase();
  for (const n of ["company", "person", "job", "web", "watch"]) if (title.startsWith(n)) return n;
  throw new Error(`Cannot infer spec file for title "${doc?.info?.title}"`);
}

function mergeInto(target, doc) {
  target.openapi ??= doc.openapi;
  target.info ??= doc.info;
  target.servers ??= doc.servers;
  target.security ??= doc.security;
  target.paths = { ...(target.paths ?? {}) };
  for (const [p, ops] of Object.entries(doc.paths ?? {})) target.paths[p] = { ...(target.paths[p] ?? {}), ...ops };
  target.components ??= {};
  for (const [section, entries] of Object.entries(doc.components ?? {})) {
    target.components[section] = { ...(target.components[section] ?? {}), ...entries };
  }
}

async function main() {
  const specs = {};
  for (const page of PAGES) {
    const url = `${BASE}${page}.md`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
    const md = await res.text();
    let found = 0;
    for (const m of md.matchAll(FENCE)) {
      const doc = YAML.parse(m[5]);
      if (!doc?.openapi) continue;
      const name = specNameFrom(m[2], doc);
      specs[name] ??= {};
      mergeInto(specs[name], doc);
      found++;
    }
    if (!found) throw new Error(`No embedded OpenAPI block in ${url}`);
    console.log(`${page}: ${found} block(s)`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, doc] of Object.entries(specs)) {
    const file = path.join(OUT, `${name}.yaml`);
    fs.writeFileSync(file, YAML.stringify(doc, { lineWidth: 0 }));
    console.log(`wrote ${path.relative(process.cwd(), file)} (${Object.keys(doc.paths).join(", ")})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
