// Additional Crustdata tools (one file per tool under src/lib/agent/tools/). Add each ToolDef here; the registry in
// ../tools.ts appends them after the core tools (a name clash keeps the core tool).
import type { ToolDef } from "../contract";

export const EXTRA_TOOLS: ToolDef[] = [];
