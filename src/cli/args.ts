// `dealdesk` argument parsing (pure, tested in args.test.ts).
export type Command =
  | { cmd: "ask"; request: string }
  | { cmd: "research"; domain: string }
  | { cmd: "decisions"; domain: string; review: boolean }
  | { cmd: "workflow"; domain: string; until?: string }
  | { cmd: "review-list"; status: "open" | "all"; run?: string }
  | { cmd: "review-approve"; id: string; confirm: boolean; note?: string }
  | { cmd: "deal-start"; domain: string; name?: string }
  | { cmd: "deal-list" }
  | { cmd: "deal-show"; id: string }
  | { cmd: "deal-act"; id: string; action: string; step?: string; text?: string; verdict?: string; note?: string; confirm: boolean }
  | { cmd: "doctor" }
  | { cmd: "help" };
export type Parsed = { ok: true; command: Command; json: boolean } | { ok: false; message: string };

export const USAGE = `dealdesk — Deal Desk from the terminal (talks to the app at DEALDESK_URL, default http://localhost:3240)

  dealdesk ask "<request>"            research agent: plain-English request → cited shortlist
  dealdesk research <domain>          cited company profile
  dealdesk decisions <domain>         fit score, verdict, valuation, memo fields  [--no-review]
  dealdesk workflow <domain>          research → decisions → review → outreach   [--until <step>]
  dealdesk review list                open review items                           [--all] [--run <id>]
  dealdesk review approve <id>        dry run unless --confirm and DEALDESK_ALLOW_APPROVE=1  [--note <text>]
  dealdesk deal start <domain>        ten-step deal workflow (/workflow)           [--name <company>]
  dealdesk deal list                  deals in the workflow, stage, step that waits
  dealdesk deal show <id>             one deal's steps, facts and citations
  dealdesk deal act <id> <action>     transcript --text <t> | skip_transcript | override_screen | decide --verdict invest|pass
                                      | regenerate_memo | resume | approve --step dataroom|schedule (dry run unless --confirm
                                      and DEALDESK_ALLOW_APPROVE=1; the server sends only in live mode to allowlisted recipients)
  dealdesk doctor                     connector health (scripts/doctor.mjs)

  --json   print the raw result (data + sources) as JSON`;

export function parseArgs(argv: string[]): Parsed {
  const flags = new Map<string, string | true>();
  const pos: string[] = [];
  const valued = new Set(["--until", "--run", "--note", "--name", "--text", "--verdict", "--step"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") flags.set("--help", true);
    else if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const k = eq < 0 ? a : a.slice(0, eq);
      const v = eq < 0 ? undefined : a.slice(eq + 1);
      if (valued.has(k)) { const val = v ?? argv[++i]; if (val === undefined) return { ok: false, message: `${k} needs a value` }; flags.set(k, val); }
      else flags.set(k, true);
    } else pos.push(a);
  }
  const json = flags.has("--json");
  const str = (k: string) => (typeof flags.get(k) === "string" ? (flags.get(k) as string) : undefined);
  const [cmd, ...rest] = pos;
  if (!cmd || flags.has("--help") || cmd === "help") return { ok: true, json, command: { cmd: "help" } };
  const need = (what: string) => ({ ok: false as const, message: `dealdesk ${cmd}: missing ${what}` });
  switch (cmd) {
    case "ask": return rest.join(" ").trim() ? { ok: true, json, command: { cmd: "ask", request: rest.join(" ").trim() } } : need('"<request>"');
    case "research": return rest[0] ? { ok: true, json, command: { cmd: "research", domain: rest[0] } } : need("<domain>");
    case "decisions": return rest[0] ? { ok: true, json, command: { cmd: "decisions", domain: rest[0], review: !flags.has("--no-review") } } : need("<domain>");
    case "workflow": return rest[0] ? { ok: true, json, command: { cmd: "workflow", domain: rest[0], until: str("--until") } } : need("<domain>");
    case "review":
      if (rest[0] === "list") return { ok: true, json, command: { cmd: "review-list", status: flags.has("--all") ? "all" : "open", run: str("--run") } };
      if (rest[0] === "approve") return rest[1] ? { ok: true, json, command: { cmd: "review-approve", id: rest[1], confirm: flags.has("--confirm"), note: str("--note") } } : need("<id>");
      return { ok: false, message: "dealdesk review: use `review list` or `review approve <id>`" };
    case "deal":
      if (rest[0] === "start") return rest[1] ? { ok: true, json, command: { cmd: "deal-start", domain: rest[1], name: str("--name") } } : need("<domain>");
      if (rest[0] === "list") return { ok: true, json, command: { cmd: "deal-list" } };
      if (rest[0] === "show") return rest[1] ? { ok: true, json, command: { cmd: "deal-show", id: rest[1] } } : need("<id>");
      if (rest[0] === "act") return rest[1] && rest[2] ? { ok: true, json, command: { cmd: "deal-act", id: rest[1], action: rest[2], step: str("--step"), text: str("--text"), verdict: str("--verdict"), note: str("--note"), confirm: flags.has("--confirm") } } : need("<id> <action>");
      return { ok: false, message: "dealdesk deal: use `deal start <domain>`, `deal list`, `deal show <id>` or `deal act <id> <action>`" };
    case "doctor": return { ok: true, json, command: { cmd: "doctor" } };
    default: return { ok: false, message: `unknown command "${cmd}"\n\n${USAGE}` };
  }
}
