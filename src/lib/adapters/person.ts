// /api/live/person result → port PersonData. Header, details and career come from Crustdata /person/enrich.
// Relationship, stage, meetings and emails need CRM/Gmail/Calendar, which this build doesn't connect, so those read
// "not in pipeline" / empty tabs (the screen's own empty states) instead of invented activity.
import type { PersonData, PersonEvent, SourceRef } from "@port/types";
import type { LiveEmployment, LivePerson } from "@/lib/live/types";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
const ym = (d?: string) => (d ? new Date(`${d.slice(0, 7)}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : undefined);
const span = (e: LiveEmployment) => [ym(e.start), e.end ? ym(e.end) : "now"].filter(Boolean).join(" – ");

export function toLivePerson(p: LivePerson, opts: { retrievedAt?: string | null; linkedinUrl: string; domain?: string }): PersonData {
  const src = (field: string): SourceRef => ({ kind: "crust", label: field, provider: "crustdata", ...(opts.retrievedAt ? { asOf: `retrieved ${opts.retrievedAt.slice(0, 10)}` } : {}) });
  const cur = (opts.domain ? p.current.find((e) => e.companyDomain === opts.domain) : undefined) ?? p.current[0];
  const slug = opts.linkedinUrl.replace(/\/$/, "").split("/").pop()!;
  const career: PersonEvent[] = [...p.current, ...p.past].map((e, i) => ({
    id: `job${i}`,
    kind: "signal",
    when: span(e) || "date unknown",
    by: { agent: "Crustdata" },
    text: [{ t: e.end ? "Was " : "Is " }, { t: e.title ?? "at", b: !!e.title }, { t: " at " }, { t: e.company, b: true }],
    source: src(`experience.employment_details.${e.end ? "past" : "current"}[]`),
  }));
  const education: PersonEvent[] = p.schools.map((s, i) => ({
    id: `edu${i}`,
    kind: "signal",
    when: [s.start, s.end].filter(Boolean).join(" – ") || "dates unknown",
    by: { agent: "Crustdata" },
    text: [{ t: "Studied " }, ...(s.field ? [{ t: s.field, b: true }, { t: " at " }] : [{ t: "at " }]), { t: s.school, b: true }],
    source: src("education.schools[]"),
  }));
  const prev = p.past[0];
  return {
    id: slug,
    person: { id: p.id != null ? String(p.id) : slug, initials: initials(p.name), name: p.name, title: p.title ?? cur?.title, email: "Not available (contact enrich not run)", ...(p.location ? { location: p.location } : {}), linkedin: opts.linkedinUrl },
    company: cur ? { id: cur.companyDomain ?? cur.company, name: cur.company, initial: cur.company[0]!.toUpperCase(), ...(cur.companyDomain ? { domain: cur.companyDomain } : {}) } : { id: "none", name: "No current company indexed", initial: "—" },
    relationship: { label: "No relationship yet" },
    stage: { label: "Not in pipeline" },
    lastTouched: "Never",
    details: [
      { k: "LinkedIn", v: opts.linkedinUrl.replace(/^https:\/\/www\./, "") },
      ...(p.location ? [{ k: "Location", v: p.location }] : []),
      ...(cur?.start ? [{ k: "In role since", v: ym(cur.start)! }] : []),
      ...(prev ? [{ k: "Previously", v: `${prev.company}${prev.title ? ` · ${prev.title}` : ""}` }] : []),
      ...(p.schools[0] ? [{ k: "Education", v: p.schools[0].school }] : []),
    ],
    team: [{ role: "Research", agent: "Live research · Crustdata" }],
    insights: {
      status: { label: "Crustdata profile", tone: "ok" },
      summary: `${p.name}${p.title ? `, ${p.title}` : ""}${cur ? ` at ${cur.company}` : ""}. ${p.headline ?? ""}`.trim(),
      points: [
        ...p.past.slice(0, 3).map((e) => `${e.title ? `${e.title} at ` : ""}${e.company}${e.start ? ` (${span(e)})` : ""}`),
        ...(p.schools[0] ? [`${p.schools[0].degree ? `${p.schools[0].degree}, ` : ""}${p.schools[0].school}`] : []),
      ],
      sources: [src("/person/enrich")],
      updated: opts.retrievedAt ? `From Crustdata · retrieved ${opts.retrievedAt.slice(0, 16).replace("T", " ")}Z` : "From Crustdata",
    },
    queue: { label: "Live profile", index: 1, total: 1 },
    groups: [
      ...(career.length ? [{ id: "career", label: "Career · Crustdata", events: career }] : []),
      ...(education.length ? [{ id: "edu", label: "Education · Crustdata", events: education }] : []),
    ],
    nestedPreview: 3,
    email: { subject: "", body: "", by: "Gmail is not connected" },
  };
}
