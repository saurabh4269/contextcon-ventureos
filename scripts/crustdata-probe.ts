#!/usr/bin/env tsx
/**
 * Dev probe: run named Crustdata calls through the app's client (file cache in .cache/crustdata, so re-runs are free)
 * and print the response. The API key is read from env by the client and never printed.
 *   tsx scripts/crustdata-probe.ts credits | identify <domain> | enrich <id> | founders <id> | jobs <id> | web <query> | person <url> | comps <json>
 */
import { createCrustdataClient, FileResponseCache } from "../src/lib/crustdata";
import { founderPersonSearchBody, linkedInPersonEnrichBody } from "../src/lib/crustdata/person-queries";
import { jobSearchByCompanyId } from "../src/lib/crustdata/job-queries";

const cache = new FileResponseCache(".cache/crustdata", 7 * 24 * 3600 * 1000);
const client = createCrustdataClient({
  cache,
  onLiveCall: (e) => console.error(`[crustdata] ${e.method} ${e.path} ${e.status} credits=${e.creditsUsed ?? "?"} ${e.latencyMs}ms${e.error ? " " + e.error : ""}`),
});

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  let out: unknown;
  if (cmd === "credits") out = (await client.getAccountCredits()).data;
  else if (cmd === "identify") out = await client.identifyCompany({ domains: [arg!] });
  else if (cmd === "enrich") out = await client.enrichCompanies({ crustdata_company_ids: [Number(arg)] });
  else if (cmd === "founders") out = await client.searchPeople(founderPersonSearchBody(Number(arg), 5, { withExperience: true }));
  else if (cmd === "jobs") out = await client.searchJobs(jobSearchByCompanyId(Number(arg), 25));
  else if (cmd === "web") out = await client.webSearchLive({ query: arg!, human_mode: false, page: 1 });
  else if (cmd === "person") out = await client.enrichPeople(linkedInPersonEnrichBody(arg!));
  else if (cmd === "comps") out = await client.searchCompanies(JSON.parse(arg!));
  else throw new Error(`unknown command ${cmd}`);
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
