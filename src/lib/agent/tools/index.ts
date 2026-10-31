// Additional Crustdata tools (one file per tool under src/lib/agent/tools/). Add each ToolDef here; the registry in
// ../tools.ts appends them after the core tools (a name clash keeps the core tool).
import type { ToolDef } from "../contract";
import { identifyCompany } from "./identify-company";
import { companySignals } from "./company-signals";
import { searchJobs } from "./search-jobs";
import { webSearch } from "./web-search";
import { findFounders } from "./find-founders";

export { identifyCompany, companySignals, searchJobs, webSearch, findFounders };

export const EXTRA_TOOLS: ToolDef[] = [identifyCompany, companySignals, findFounders, searchJobs, webSearch];
