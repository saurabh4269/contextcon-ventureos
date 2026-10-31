"use client";
/**
 * Integration marks: real brand icons. Gmail, Google Calendar, Google Drive, Zoom and Notion are Simple Icons (CC0,
 * cdn.simpleicons.org); Slack comes from simple-icons@13; Crustdata is its own favicon. Files live in public/logos/tools/
 * (mirrored in port/src/assets/logos/tools/). v4 adds the connector set; sources in public/logos/SOURCES.md. The data room has no
 * brand, so it keeps a neutral glyph; any other tool without a file falls back to its initial.
 */
import type { ToolId } from "../types";
import { cx } from "./ui";

export const TOOL_NAME: Record<ToolId, string> = {
  gmail: "Gmail", calendar: "Google Calendar", slack: "Slack", drive: "Google Drive", crustdata: "Crustdata", dataroom: "Data room",
  googlemeet: "Google Meet", fireflies: "Fireflies", agentmail: "AgentMail", anthropic: "Anthropic", openai: "OpenAI",
  affinity: "Affinity", attio: "Attio", hubspot: "HubSpot", salesforce: "Salesforce", dealcloud: "DealCloud", carta: "Carta", pitchbook: "PitchBook",
  crunchbase: "Crunchbase", harmonic: "Harmonic", docsend: "DocSend", notion: "Notion", dropbox: "Dropbox", outlook: "Microsoft Outlook",
  teams: "Microsoft Teams", zoom: "Zoom", otter: "Otter", granola: "Granola", gong: "Gong", linkedin: "LinkedIn", clay: "Clay", airtable: "Airtable",
  excel: "Excel", docusign: "DocuSign", angellist: "AngelList", visible: "Visible.vc", plaid: "Plaid", quickbooks: "QuickBooks",
};
export const TOOL_LOGO_BASE = "/logos/tools/";
export const TOOL_LOGO_FILE: Partial<Record<ToolId, string>> = {
  gmail: "gmail.svg", calendar: "calendar.svg", slack: "slack.svg", drive: "drive.svg", crustdata: "crustdata.png",
  googlemeet: "googlemeet.svg", fireflies: "fireflies.png", agentmail: "agentmail.png", anthropic: "anthropic.svg", openai: "openai.svg",
  affinity: "affinity.png", attio: "attio.png", hubspot: "hubspot.svg", salesforce: "salesforce.svg", dealcloud: "dealcloud.png", carta: "carta.png",
  pitchbook: "pitchbook.png", crunchbase: "crunchbase.svg", harmonic: "harmonic.png", docsend: "docsend.png", notion: "notion.svg", dropbox: "dropbox.svg",
  outlook: "microsoftoutlook.svg", teams: "microsoftteams.svg", zoom: "zoom.svg", otter: "otter.png", granola: "granola.svg", gong: "gong.svg",
  linkedin: "linkedin.svg", clay: "clay.png", airtable: "airtable.svg", excel: "microsoftexcel.svg", docusign: "docusign.svg", angellist: "angellist.svg",
  visible: "visible.png", plaid: "plaid.png", quickbooks: "quickbooks.svg",
};
/** Favicons that already carry their own filled square: shown full-bleed in the tile instead of inset. */
export const TOOL_LOGO_BLEED: Partial<Record<ToolId, true>> = { agentmail: true };
/** Wide wordmark icons read small at the default inset; scale them up inside the tile. */
const TOOL_LOGO_SCALE: Partial<Record<ToolId, number>> = { zoom: 0.8, otter: 0.66 };

function DataRoomGlyph({ px }: { px: number }) {
  return <svg viewBox="4 4 24 24" width={px} height={px} aria-hidden><g fill="none" stroke="#3f3f46" strokeWidth="1.8" strokeLinejoin="round"><path d="M6 11a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" /><rect x="13" y="15" width="6" height="5" rx="1" /><path d="M14.5 15v-1.5a1.5 1.5 0 0 1 3 0V15" /></g></svg>;
}

/** Fallback when a brand has no icon file yet: its initial, never a drawn logo. */
function Monogram({ id, px }: { id: ToolId; px: number }) {
  return <span aria-hidden style={{ width: px, height: px, fontSize: px * 0.62 }} className="inline-flex items-center justify-center font-semibold leading-none text-zinc-600">{TOOL_NAME[id].charAt(0)}</span>;
}

function Mark({ id, px }: { id: ToolId; px: number }) {
  const f = TOOL_LOGO_FILE[id];
  if (!f) return id === "dataroom" ? <DataRoomGlyph px={px} /> : <Monogram id={id} px={px} />;
  return <img src={TOOL_LOGO_BASE + f} alt="" aria-hidden width={px} height={px} style={{ width: px, height: px }} className="block" />;
}

/** A tool's mark on a white tile. `bare` drops the tile, for inline use in lists. */
export function ToolLogo({ id, size = 28, bare, className }: { id: ToolId; size?: number; bare?: boolean; className?: string }) {
  if (bare) return <span title={TOOL_NAME[id]} className={cx("inline-flex shrink-0", className)}><Mark id={id} px={size} /></span>;
  const bleed = TOOL_LOGO_BLEED[id];
  return <span title={TOOL_NAME[id]} style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }} className={cx("inline-flex shrink-0 items-center justify-center overflow-hidden border border-zinc-200 bg-white shadow-[0_1px_1px_rgba(9,9,11,.05)]", className)}><Mark id={id} px={bleed ? size : Math.round(size * (TOOL_LOGO_SCALE[id] ?? 0.56))} /></span>;
}

/** Deal Desk's own mark (the sidebar tile). */
export function DeskMark({ size = 28 }: { size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), fontSize: size * 0.5 }} className="inline-flex shrink-0 items-center justify-center bg-ink font-serif text-white">D</span>;
}
