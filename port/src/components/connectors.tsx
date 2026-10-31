"use client";
/**
 * v4 · Settings > Connectors. Status tabs with counts, search, category chips, a compact featured card (Crustdata) and a
 * grid of connector cards, plus a Manage sheet (scopes, endpoints, agents, sync, activity, disconnect). Everything comes
 * from ConnectorsData; Connect / Reconnect open the existing JIT ConnectModal. State changes are local until the
 * callbacks resolve. Motion: grid re-layout on filter, card hover lift, pulsing dot while syncing, sheet slide;
 * all of it is off under reduced motion.
 */
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  AlertTriangle, ArrowUpRight, BadgeCheck, CalendarClock, FileText, Inbox, Landmark, Loader2, Lock, Plus, Reply, RotateCw, Scale, Search, Settings2, Unplug, X,
  Mail, ScanText, DatabaseZap, Split, Hash, FolderOpen, Users, ChartNoAxesColumn, MessageSquareText,
} from "lucide-react";
import type { ConnectAsk, Connector, ConnectorAgent, ConnectorCategoryId, ConnectorScope, ConnectorStatus, ConnectorsData, FlowIcon } from "../types";
import { ConnectModal, type ConnectState } from "./connect";
import { ToolLogo, TOOL_LOGO_BASE, TOOL_NAME } from "./tools";
import { useReducedMotion, Pulse } from "./motion";
import { EmptyState } from "./states";
import { cx, IconBtn, Toggle } from "./ui";

export type ConnectorTab = "all" | ConnectorStatus;
export interface ConnectorsView {
  tab?: ConnectorTab; q?: string; category?: ConnectorCategoryId;
  /** connector id whose connect modal starts open */ connect?: string;
  /** connector id whose Manage sheet starts open */ manage?: string;
}
export interface ConnectorsPageProps {
  data: ConnectorsData;
  initial?: ConnectorsView;
  /** Resolve when the tool is authorised; reject to return the modal to its ask. */
  onConnect?: (connectorId: string) => void | Promise<void>;
  onManage?: (connectorId: string) => void;
  /** Resolve when a manual sync finishes. */
  onSync?: (connectorId: string) => void | Promise<void>;
  onScope?: (connectorId: string, scopeId: string, on: boolean) => void;
  onDisconnect?: (connectorId: string) => void | Promise<void>;
}

const TABS: { id: ConnectorTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "connected", label: "Connected" },
  { id: "attention", label: "Needs attention" },
  { id: "available", label: "Available" },
];
const ORDER: Record<ConnectorStatus, number> = { attention: 0, connected: 1, available: 2 };
const EASE = [0.22, 1, 0.36, 1] as const;
/** Same chrome as Today's cards (todaysummary CARD): 20px radius, hairline border, soft layered shadow. */
const CARD = "rounded-[20px] border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(9,9,11,.03),0_12px_32px_-18px_rgba(9,9,11,.10)]";
const LIFT = "motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200 hover:border-zinc-300/80 hover:shadow-[0_18px_36px_-18px_rgba(9,9,11,.2),0_2px_4px_rgba(9,9,11,.04)] motion-safe:hover:-translate-y-0.5";
const AMBER = "bg-[#c98a1b]";
/** Agent glyphs: the flow-step icon set (flowcanvas), so an agent looks the same here as on its canvas. */
const AGENT_ICON: Record<FlowIcon, typeof Mail> = {
  mail: Mail, extract: ScanText, enrich: DatabaseZap, decision: Split, slack: Hash, reply: Reply, calendar: CalendarClock, files: FolderOpen,
  claims: Scale, bank: Landmark, team: Users, value: ChartNoAxesColumn, memo: FileText, brief: MessageSquareText, inbox: Inbox,
};

const nameOf = (c: Connector) => c.title ?? TOOL_NAME[c.tool];
const scopesOf = (c: Connector): ConnectorScope[] => c.scopes ?? [{ id: "default", label: c.scope, detail: "Everything this connector was granted", access: "read", on: true }];

export function ConnectorsPage({ data, initial, onConnect, onManage, onSync, onScope, onDisconnect }: ConnectorsPageProps) {
  const r = useReducedMotion();
  const [tab, setTab] = useState<ConnectorTab>(initial?.tab ?? "all");
  const [q, setQ] = useState(initial?.q ?? "");
  const [cat, setCat] = useState<ConnectorCategoryId | null>(initial?.category ?? null);
  const [patched, setPatched] = useState<Record<string, Partial<Connector>>>({});
  const [modal, setModal] = useState<{ id: string; state: ConnectState } | null>(initial?.connect ? { id: initial.connect, state: "ask" } : null);
  const [managing, setManaging] = useState<string | null>(initial?.manage ?? null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const items = useMemo(() => data.items.map((c) => ({ ...c, ...patched[c.id] })), [data.items, patched]);
  const catLabel = useMemo(() => Object.fromEntries(data.categories.map((c) => [c.id, c.label])) as Record<ConnectorCategoryId, string>, [data.categories]);
  const agents = useMemo(() => Object.fromEntries(data.agents.map((a) => [a.id, a])) as Record<string, ConnectorAgent>, [data.agents]);
  const patch = useCallback((id: string, x: Partial<Connector>) => setPatched((p) => ({ ...p, [id]: { ...p[id], ...x } })), []);

  const needle = q.trim().toLowerCase();
  const hit = (c: Connector) => !needle || [nameOf(c), TOOL_NAME[c.tool], c.detail ?? "", c.does, catLabel[c.category]].some((s) => s.toLowerCase().includes(needle));
  const inTab = (c: Connector) => tab === "all" || c.status === tab;
  const tabCount = (t: ConnectorTab) => items.filter((c) => (t === "all" || c.status === t) && hit(c) && (!cat || c.category === cat)).length;
  const catCount = (id: ConnectorCategoryId) => items.filter((c) => inTab(c) && hit(c) && c.category === id).length;
  const shown = items.filter((c) => inTab(c) && hit(c) && (!cat || c.category === cat));
  const featured = data.featured ? shown.find((c) => c.id === data.featured!.id) : undefined;
  const grid = shown.filter((c) => c !== featured).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const connected = items.filter((c) => c.status === "connected").length, attention = items.filter((c) => c.status === "attention").length;

  const open = (id: string) => setModal({ id, state: "ask" });
  const manage = (id: string) => { setManaging(id); onManage?.(id); };
  const allow = async () => {
    if (!modal) return;
    const id = modal.id;
    setModal({ id, state: "connecting" });
    try {
      await (onConnect ? onConnect(id) : new Promise((res) => setTimeout(res, 1100)));
      setModal({ id, state: "connected" });
      timer.current = setTimeout(() => { patch(id, { status: "connected", lastSynced: "just now", issue: undefined, syncing: true }); setModal(null); }, 1100);
    } catch { setModal({ id, state: "ask" }); }
  };
  const target = modal ? items.find((c) => c.id === modal.id) : undefined;
  const ask: ConnectAsk | undefined = target && {
    tool: target.tool,
    title: `${target.status === "attention" ? "Reconnect" : "Connect"} ${nameOf(target) === TOOL_NAME[target.tool] ? TOOL_NAME[target.tool] : `${nameOf(target)} · ${TOOL_NAME[target.tool]}`}`,
    why: target.status === "attention" && target.issue ? `${target.issue}. ${target.does}` : target.does,
    allowLabel: target.status === "attention" ? "Reconnect" : `Allow ${TOOL_NAME[target.tool]}`,
    scope: target.scope,
  };
  const sheet = managing ? items.find((c) => c.id === managing && c.status === "connected") : undefined;
  const clear = () => { setQ(""); setCat(null); setTab("all"); };

  if (!data.items.length) return (
    <>
      <Header connected={0} attention={0} total={0} />
      <EmptyState title="No connectors yet" body="When an agent needs a tool, it will ask here first." />
    </>
  );

  return (
    <>
      <Header connected={connected} attention={attention} total={items.length} />

      {/* status tabs + search */}
      <div className="mt-6 flex items-center gap-4">
        <div role="tablist" aria-label="Connector status" className="flex h-10 shrink-0 items-center gap-0.5 rounded-full bg-zinc-100/90 p-1 shadow-[inset_0_0_0_1px_rgba(9,9,11,.04)]">
          {TABS.map((t) => {
            const on = tab === t.id, n = tabCount(t.id);
            return (
              <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.id)} className={cx("relative flex h-8 items-center gap-2 rounded-full px-3.5 text-[13px] motion-safe:transition-colors", on ? "font-medium text-ink" : "text-zinc-500 hover:text-ink")}>
                {on && <motion.span layoutId={r ? undefined : "conn-tab"} transition={{ duration: 0.3, ease: EASE }} className="absolute inset-0 rounded-full bg-white shadow-[0_0_0_1px_rgba(9,9,11,.06),0_1px_2px_rgba(9,9,11,.08)]" />}
                <span className="relative">{t.label}</span>
                <span className={cx("tnum relative min-w-5 rounded-full px-1.5 text-center text-[11px] leading-[18px]", t.id === "attention" && n > 0 ? "bg-warn-50 text-warn ring-1 ring-warn-100" : on ? "bg-zinc-100 text-zinc-700" : "bg-zinc-200/60 text-zinc-500")}>{n}</span>
              </button>
            );
          })}
        </div>
        <label className="ml-auto flex h-10 w-[280px] min-w-[180px] shrink items-center gap-2 rounded-full border border-zinc-200 bg-white pr-2 pl-3.5 shadow-[0_1px_1px_rgba(9,9,11,.04)] focus-within:border-zinc-400">
          <Search className="size-4 shrink-0 text-zinc-400" strokeWidth={1.75} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search connectors" aria-label="Search connectors" className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400" />
          {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="grid size-6 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-ink"><X className="size-3.5" /></button>}
        </label>
      </div>

      {/* category chips: one row; scrolls with fade edges when the column is narrower than the set */}
      <FadeScroll className="mt-3.5">
        {data.categories.map((c) => {
          const on = cat === c.id, n = catCount(c.id);
          return (
            <button key={c.id} type="button" aria-pressed={on} title={on ? "Show all categories" : undefined} onClick={() => setCat(on ? null : c.id)} className={cx("flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px] whitespace-nowrap motion-safe:transition-colors", on ? "border-ink bg-ink text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300", !on && n === 0 && "text-zinc-400")}>
              {c.label}<span className={cx("tnum text-[11px]", on ? "text-white/60" : "text-zinc-400")}>{n}</span>{on && <X aria-hidden className="-mr-0.5 size-3 text-white/70" />}
            </button>
          );
        })}
      </FadeScroll>

      <LayoutGroup>
        <AnimatePresence initial={false} mode="popLayout">
          {featured && data.featured && (
            <motion.div key="featured" layout={!r} initial={r ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={r ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.985 }} transition={{ duration: 0.35, ease: EASE }} className="mt-5">
              <Featured c={featured} f={data.featured} cat={catLabel[featured.category]} agents={agents} onManage={manage} onConnect={open} />
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div layout={!r} className="mt-4 grid grid-cols-2 gap-4 min-[1360px]:grid-cols-3">
          <AnimatePresence initial={false} mode="popLayout">
            {grid.flatMap((c, i) => {
              const head = tab === "all" && c.status === "available" && i > 0 && grid[i - 1].status !== "available";
              const card = (
                <motion.div key={c.id} layout={!r} initial={r ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={r ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97 }} transition={{ duration: 0.3, ease: EASE }} className="h-full">
                  <ConnectorCard c={c} cat={catLabel[c.category]} agents={agents} onConnect={open} onManage={manage} />
                </motion.div>);
              return head ? [
                <motion.div key="available-head" layout={!r} initial={r ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: r ? 0 : 0.2 } }} className="col-span-full mt-4 flex items-center gap-3">
                  <span className="text-[13px] font-medium">Available to connect</span><span className="tnum text-[12px] text-zinc-400">{grid.length - i}</span>
                  <span className="h-px flex-1 bg-zinc-200/80" /><span className="truncate text-[12px] text-zinc-400">Connect asks only for the access shown on each card</span>
                </motion.div>, card] : [card];
            })}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>

      {!shown.length && (
        <div className="mx-auto mt-10 max-w-[420px] text-center" role="status">
          <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-white text-zinc-400 shadow-[var(--dd-e2)]"><Search className="size-5" strokeWidth={1.75} /></span>
          <div className="serif mt-4 text-[22px] leading-tight">{needle ? <>No connectors match “{q.trim()}”</> : "Nothing here"}</div>
          <p className="mt-1.5 text-[13px] text-zinc-500">{needle ? "Try a tool name, or search across every status and category." : "No connectors in this view."}</p>
          <button type="button" onClick={clear} className="mt-5 inline-flex h-8 items-center rounded-full border border-zinc-200 bg-white px-3.5 text-[12.5px] font-medium shadow-[0_1px_1px_rgba(9,9,11,.04)] hover:bg-zinc-50">Clear filters</button>
        </div>
      )}

      <AnimatePresence>
        {sheet && <ManageSheet key={sheet.id} c={sheet} cat={catLabel[sheet.category]} agents={agents} onClose={() => setManaging(null)} patch={patch} onSync={onSync} onScope={onScope} onDisconnect={onDisconnect} />}
      </AnimatePresence>
      {ask && modal && <ConnectModal ask={ask} state={modal.state} onAllow={allow} onLater={() => setModal(null)} onClose={() => setModal(null)} />}
    </>
  );
}

function Header({ connected, attention, total }: { connected: number; attention: number; total: number }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="min-w-0">
        <h1 className="serif text-[32px] leading-none">Connectors</h1>
        <p className="mt-2.5 text-[13.5px] text-zinc-500">The tools your agents read from and act in. Each asks only for the access a task needs.</p>
      </div>
      {total > 0 && (
        <div className="flex shrink-0 items-center gap-3 text-[12.5px] text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-ok" /><span className="tnum font-medium text-ink">{connected}</span> of <span className="tnum">{total}</span> connected</span>
          {attention > 0 && <span className="flex items-center gap-1.5"><span className={cx("size-1.5 rounded-full", AMBER)} /><span className="tnum font-medium text-warn">{attention}</span> needs attention</span>}
        </div>
      )}
    </div>
  );
}

/** A horizontal row that scrolls when it overflows, with soft fades on whichever edge has more. */
function FadeScroll({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const measure = useCallback(() => {
    const el = ref.current; if (!el) return;
    setEdge({ l: el.scrollLeft > 2, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);
  useLayoutEffect(() => {
    measure();
    const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  const mask = edge.l && edge.r ? "linear-gradient(90deg,transparent,#000 32px,#000 calc(100% - 48px),transparent)" : edge.r ? "linear-gradient(90deg,#000 calc(100% - 48px),transparent)" : edge.l ? "linear-gradient(90deg,transparent,#000 32px)" : undefined;
  return (
    <div ref={ref} onScroll={measure} aria-label="Categories" role="group" style={{ maskImage: mask, WebkitMaskImage: mask }} className={cx("-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      {children}
    </div>
  );
}

/* ───── agents ───── */
/** The agent mark: a small sienna orb with the agent's flow glyph (the Ask card's orb, at chip size). */
export function AgentOrb({ a, size = 18 }: { a: ConnectorAgent | { icon: FlowIcon }; size?: number }) {
  const I = AGENT_ICON[a.icon];
  return (
    <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#d27a3e,#9c440f_72%)] text-white shadow-[0_2px_5px_-2px_rgba(156,68,15,.6),inset_0_1px_0_rgba(255,255,255,.3)]">
      <I style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.1} />
    </span>
  );
}
function AgentChip({ a }: { a: ConnectorAgent }) {
  return (
    <Link href={a.href} title={`Open ${a.name}`} className="inline-flex h-6 min-w-0 shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white pr-2 pl-[3px] text-[12px] text-zinc-700 motion-safe:transition-colors hover:border-zinc-300 hover:text-ink">
      <AgentOrb a={a} /><span className="truncate">{a.name}</span>
    </Link>
  );
}
const ALL_AGENTS: { icon: FlowIcon } = { icon: "value" };
/** Up to `max` chips while the names fit the card, then "+N". */
function UsedBy({ c, agents, max = 2, budget = 19 }: { c: Connector; agents: Record<string, ConnectorAgent>; max?: number; budget?: number }) {
  if (!c.usedBy) return null;
  if (c.usedBy === "all") return (
    <span className="flex min-w-0 items-center gap-1.5"><span className="shrink-0 text-[12px] text-zinc-400">Used by</span>
      <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-zinc-200 bg-white pr-2 pl-[3px] text-[12px] text-zinc-700"><AgentOrb a={ALL_AGENTS} />Every agent</span>
    </span>
  );
  const list = c.usedBy.map((id) => agents[id]).filter(Boolean);
  const keep: ConnectorAgent[] = [];
  let len = 0;
  for (const a of list) { if (keep.length >= max || (keep.length && len + a.name.length > budget)) break; keep.push(a); len += a.name.length; }
  const more = list.length - keep.length;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-[12px] text-zinc-400">Used by</span>
      {keep.map((a) => <AgentChip key={a.id} a={a} />)}
      {more > 0 && <span title={list.slice(keep.length).map((a) => a.name).join(", ")} className="tnum inline-flex h-6 shrink-0 items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 text-[12px] text-zinc-500">+{more}</span>}
    </span>
  );
}
/** Overlapping orbs, each a link to its agent (featured card). */
function AgentStack({ c, agents }: { c: Connector; agents: Record<string, ConnectorAgent> }) {
  const list = c.usedBy === "all" ? Object.values(agents) : (c.usedBy ?? []).map((id) => agents[id]).filter(Boolean);
  if (!list.length) return null;
  return (
    <span className="flex items-center gap-2">
      <span className="hidden text-[12px] text-zinc-500 min-[1360px]:inline">Used by <span className="tnum font-medium text-ink">{list.length}</span> agents</span>
      <span className="flex -space-x-1.5">{list.map((a) => <Link key={a.id} href={a.href} title={a.name} aria-label={`Open ${a.name}`} className="rounded-full ring-2 ring-[#fbf6f0] motion-safe:transition-transform motion-safe:hover:-translate-y-0.5"><AgentOrb a={a} size={22} /></Link>)}</span>
    </span>
  );
}

/* ───── status + actions ───── */
function StatusLine({ c }: { c: Connector }) {
  if (c.status === "connected") return (
    <span className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[12px] text-zinc-500">
      {c.syncing ? <Pulse className="bg-ok" /> : <span className="size-1.5 shrink-0 rounded-full bg-ok" />}
      <span className="truncate">{c.syncing ? "Syncing · " : `${c.lastLabel ?? "Last synced"} `}<span className="tnum">{c.lastSynced}</span></span>
    </span>
  );
  if (c.status === "attention") return <span className="flex items-center gap-2 whitespace-nowrap text-[12px] text-warn"><span className={cx("size-1.5 rounded-full", AMBER)} /><span>Paused · <span className="tnum">{c.lastSynced}</span></span></span>;
  return <span className="text-[12px] text-zinc-400">Not connected</span>;
}

const BTN = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const BTN_GHOST = "border border-zinc-200 bg-white text-zinc-700 shadow-[0_1px_1px_rgba(9,9,11,.04)] hover:border-zinc-300 hover:text-ink";
function Action({ c, onConnect, onManage }: { c: Connector; onConnect: (id: string) => void; onManage: (id: string) => void }) {
  if (c.status === "connected") return <button type="button" onClick={() => onManage(c.id)} aria-label={`Manage ${nameOf(c)}`} className={cx(BTN, BTN_GHOST)}><Settings2 className="size-3.5 text-zinc-400" />Manage</button>;
  if (c.status === "attention") return <button type="button" onClick={() => onConnect(c.id)} aria-label={`Reconnect ${nameOf(c)}`} className={cx(BTN, "border border-warn-100 bg-warn-50 text-warn hover:bg-[#f7ecd5]")}><RotateCw className="size-3.5" />Reconnect</button>;
  return <button type="button" onClick={() => onConnect(c.id)} aria-label={`Connect ${nameOf(c)}`} className={cx(BTN, "border border-zinc-200 bg-white text-ink shadow-[0_1px_1px_rgba(9,9,11,.04)] hover:border-ink hover:bg-ink hover:text-white")}><Plus className="size-3.5" />Connect</button>;
}

function Badge({ s }: { s: ConnectorStatus }) {
  if (s === "connected") return <BadgeCheck aria-label="Connected" className="size-[22px] shrink-0 fill-ok text-white" strokeWidth={2} />;
  if (s === "attention") return <span aria-label="Needs attention" className="grid size-[22px] shrink-0 place-items-center rounded-full bg-warn-50 text-[#b07614] ring-1 ring-warn-100"><AlertTriangle className="size-3" strokeWidth={2.25} /></span>;
  return null;
}

/* ───── cards ───── */
function ConnectorCard({ c, cat, agents, onConnect, onManage }: { c: Connector; cat: string; agents: Record<string, ConnectorAgent>; onConnect: (id: string) => void; onManage: (id: string) => void }) {
  return (
    <article aria-label={nameOf(c)} className={cx(CARD, LIFT, "group relative flex h-full flex-col p-5", c.status === "attention" && "border-warn-100")}>
      <div className="flex items-center gap-3">
        <ToolLogo id={c.tool} size={40} className="rounded-[11px]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] leading-6 font-semibold tracking-[-0.01em]">{nameOf(c)}</div>
          <div className="truncate text-[12px] text-zinc-500">{c.detail ?? cat}</div>
        </div>
        <Badge s={c.status} />
      </div>
      <p className="mt-3.5 line-clamp-3 flex-1 text-[13.5px] leading-[1.5] text-zinc-600">{c.does}</p>
      <div className="mt-4 flex h-6 items-center">
        {c.status === "available" || (c.status === "connected" && !c.usedBy) ? <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-zinc-500"><Lock className="size-3 shrink-0 text-zinc-400" /><span className="truncate">{c.scope}</span></span>
          : c.status === "attention" && c.issue ? <span className="truncate text-[12px] font-medium text-warn">{c.issue}</span>
          : <UsedBy c={c} agents={agents} />}
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-zinc-100 pt-4">
        <StatusLine c={c} />
        <span className="ml-auto shrink-0"><Action c={c} onConnect={onConnect} onManage={onManage} /></span>
      </div>
    </article>
  );
}

function Featured({ c, f, cat, agents, onConnect, onManage }: { c: Connector; f: NonNullable<ConnectorsData["featured"]>; cat: string; agents: Record<string, ConnectorAgent>; onConnect: (id: string) => void; onManage: (id: string) => void }) {
  return (
    <article aria-label={`${nameOf(c)}, featured`} className="relative overflow-hidden rounded-[20px] border border-[#f1e2d2] bg-[#fbf6f0] px-5 pt-4 pb-4 shadow-[0_1px_2px_rgba(120,60,20,.04),0_16px_36px_-22px_rgba(156,68,15,.26)]">
      {/* the Ask card's warmth, quieter: a sienna orb and an amber wash behind the right half */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 right-[6%] size-[340px] rounded-full bg-[radial-gradient(circle,rgba(206,112,52,.26),rgba(206,112,52,.08)_45%,transparent_70%)] blur-[6px]" />
        <div className="absolute -bottom-40 right-[32%] size-[320px] rounded-full bg-[radial-gradient(circle,rgba(246,196,120,.36),rgba(246,196,120,.1)_48%,transparent_72%)] blur-[2px]" />
        <div className="absolute -top-20 -left-16 size-[260px] rounded-full bg-[radial-gradient(circle,rgba(255,250,242,.95),transparent_65%)]" />
      </div>
      <div className="relative flex items-center gap-3.5">
        {/* Crustdata's own purple stays inside its tile. */}
        <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-white shadow-[0_0_0_1px_rgba(103,80,230,.14),0_2px_6px_-2px_rgba(103,80,230,.18)]">{f.mark ? <img src={TOOL_LOGO_BASE + f.mark} alt="" aria-hidden width={26} height={22} className="block h-[22px] w-[26px]" /> : <ToolLogo id={c.tool} size={26} bare />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[16px] leading-6 font-semibold tracking-[-0.01em]">{nameOf(c)}</span>
            <span className="rounded-full bg-white/80 px-2 text-[11px] leading-5 font-medium text-rust ring-1 ring-rust-100">Featured</span>
            <BadgeCheck aria-label="Connected" className="size-[18px] shrink-0 fill-ok text-white" strokeWidth={2} />
            <span className="hidden truncate text-[12px] text-zinc-500 min-[1360px]:inline">{cat}</span>
          </div>
          <p className="truncate text-[13.5px] text-zinc-600">{f.headline}</p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <AgentStack c={c} agents={agents} />
          <span className="hidden h-5 w-px bg-[#ead8c6] min-[1360px]:block" />
          <StatusLine c={c} />
          <Action c={c} onConnect={onConnect} onManage={onManage} />
        </div>
      </div>
      <div className="relative mt-3.5 grid grid-cols-5 gap-2">
        {f.uses.map((u) => (
          <div key={u.id} title={u.detail} className="flex h-11 min-w-0 flex-col justify-center rounded-xl bg-white/75 px-3 shadow-[inset_0_0_0_1px_rgba(156,68,15,.08)] backdrop-blur-[2px]">
            <div className="truncate text-[12px] font-medium text-ink">{u.label}</div>
            <div className="tnum truncate text-[11.5px] text-rust">{u.stat}</div>
          </div>
        ))}
      </div>
    </article>
  );
}

/* ───── Manage sheet ───── */
function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2"><h3 className="eyebrow">{title}</h3><span className="ml-auto">{right}</span></div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function ManageSheet({ c, cat, agents, onClose, patch, onSync, onScope, onDisconnect }: {
  c: Connector; cat: string; agents: Record<string, ConnectorAgent>; onClose: () => void; patch: (id: string, x: Partial<Connector>) => void;
  onSync?: ConnectorsPageProps["onSync"]; onScope?: ConnectorsPageProps["onScope"]; onDisconnect?: ConnectorsPageProps["onDisconnect"];
}) {
  const r = useReducedMotion();
  const [syncing, setSyncing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const scopes = scopesOf(c);
  const used = c.usedBy === "all" ? Object.values(agents) : (c.usedBy ?? []).map((id) => agents[id]).filter(Boolean);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  const sync = async () => {
    setSyncing(true); patch(c.id, { syncing: true });
    try { await (onSync ? onSync(c.id) : new Promise((res) => setTimeout(res, 1200))); patch(c.id, { syncing: false, lastSynced: "just now", lastLabel: c.lastLabel }); }
    catch { patch(c.id, { syncing: false }); }
    setSyncing(false);
  };
  const toggle = (s: ConnectorScope, on: boolean) => { patch(c.id, { scopes: scopes.map((x) => x.id === s.id ? { ...x, on } : x) }); onScope?.(c.id, s.id, on); };
  const disconnect = async () => {
    setBusy(true);
    try { await onDisconnect?.(c.id); patch(c.id, { status: "available", syncing: false, lastSynced: undefined }); onClose(); }
    catch { setBusy(false); setConfirm(false); }
  };

  return (
    <div className="fixed inset-0 z-50">
      <motion.div className="absolute inset-0 bg-zinc-900/15 backdrop-blur-[3px]" onClick={onClose} initial={r ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: r ? 0 : 0.18 } }} />
      <motion.aside role="dialog" aria-modal aria-label={`Manage ${nameOf(c)}`} initial={r ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={r ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: 24 }} transition={{ duration: 0.28, ease: EASE }}
        className="absolute top-2 right-2 bottom-2 flex w-[440px] flex-col overflow-hidden rounded-[20px] border border-zinc-200/80 bg-white shadow-[0_24px_60px_-12px_rgba(9,9,11,.22),0_2px_6px_rgba(9,9,11,.05)]">
        <header className="border-b border-zinc-100 px-6 pt-5 pb-4">
          <div className="flex items-start gap-3.5">
            <ToolLogo id={c.tool} size={44} className="rounded-[12px]" />
            <div className="min-w-0 flex-1">
              <h2 className="serif text-[22px] leading-tight">{nameOf(c)}</h2>
              <div className="truncate text-[12.5px] text-zinc-500">{c.detail ?? cat}</div>
            </div>
            <IconBtn icon={<X />} label="Close" tone="bare" size="sm" onClick={onClose} />
          </div>
          <div className="mt-4 flex h-10 items-center gap-3 rounded-xl bg-zinc-50 pr-1.5 pl-3 ring-1 ring-zinc-100">
            <BadgeCheck className="size-4 fill-ok text-white" strokeWidth={2} /><span className="text-[12.5px] font-medium">Connected</span>
            <span className="h-3.5 w-px bg-zinc-200" />
            <StatusLine c={c} />
            <button type="button" onClick={sync} disabled={syncing} className={cx(BTN, BTN_GHOST, "ml-auto h-7 px-3 text-[12px] disabled:opacity-80")}>
              {syncing ? <><Loader2 className="size-3.5 motion-safe:animate-spin" />Syncing…</> : <><RotateCw className="size-3.5 text-zinc-400" />Sync now</>}
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <Section title="Access">
            <div className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200/80">
              {scopes.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium">{s.label}<span className={cx("rounded-full px-1.5 text-[10.5px] leading-4 font-medium ring-1", s.access === "write" ? "bg-rust-50 text-rust ring-rust-100" : "bg-zinc-50 text-zinc-500 ring-zinc-200")}>{s.access === "write" ? "Write" : "Read"}</span></div>
                    <div className="truncate text-[12px] text-zinc-500">{s.detail}</div>
                  </div>
                  <Toggle on={s.on} label={s.label} onChange={(v) => toggle(s, v)} />
                </div>
              ))}
            </div>
          </Section>

          {c.api && (
            <Section title="Endpoints" right={<span className="rounded-md bg-zinc-50 px-1.5 font-mono text-[10.5px] leading-5 text-zinc-500 ring-1 ring-zinc-200">{c.api.header}: {c.api.version}</span>}>
              <div className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200/80">
                {c.api.endpoints.map((e) => (
                  <div key={e.id} className="flex items-center gap-2.5 px-3.5 py-2">
                    <span className="w-9 shrink-0 font-mono text-[10px] font-medium text-zinc-400">{e.method}</span>
                    <div className="min-w-0 flex-1"><div className="truncate font-mono text-[12px] text-ink">{e.path}</div><div className="truncate text-[11.5px] text-zinc-500">{e.label}</div></div>
                    <span className="tnum shrink-0 text-[12px] text-zinc-500"><span className="font-medium text-ink">{e.calls}</span> this week</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {used.length > 0 && (
            <Section title="Used by" right={<span className="tnum text-[11.5px] text-zinc-400">{used.length} agents</span>}>
              <div className="grid grid-cols-2 gap-2">
                {used.map((a) => (
                  <Link key={a.id} href={a.href} className="group/ag flex h-10 items-center gap-2.5 rounded-xl px-2.5 ring-1 ring-zinc-200/80 motion-safe:transition-colors hover:bg-zinc-50 hover:ring-zinc-300">
                    <AgentOrb a={a} size={22} /><span className="truncate text-[12.5px] font-medium">{a.name}</span>
                    <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-zinc-300 group-hover/ag:text-ink" />
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {c.activity && c.activity.length > 0 && (
            <Section title="Recent activity">
              <ol className="relative space-y-3 pl-1">
                <span aria-hidden className="absolute top-2 bottom-2 left-[13px] w-px bg-zinc-200" />
                {c.activity.map((e) => { const a = agents[e.agent]; return (
                  <li key={e.id} className="relative flex items-start gap-3">
                    {a ? <span className="relative z-10 rounded-full ring-4 ring-white"><AgentOrb a={a} size={18} /></span> : <span className="relative z-10 size-[18px] rounded-full bg-zinc-200 ring-4 ring-white" />}
                    <div className="min-w-0 flex-1"><div className="text-[12.5px] leading-snug text-zinc-700">{e.text}</div><div className="mt-0.5 text-[11.5px] text-zinc-400">{a?.name}{a && " · "}<span className="tnum">{e.at}</span></div></div>
                  </li>
                ); })}
              </ol>
            </Section>
          )}
        </div>

        <footer className="border-t border-zinc-100 px-6 py-4">
          <AnimatePresence mode="wait" initial={false}>
            {confirm ? (
              <motion.div key="confirm" initial={r ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: r ? 0 : 0.12 } }} className="flex items-center gap-3" role="alertdialog" aria-label={`Disconnect ${nameOf(c)}?`}>
                <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-zinc-600">{used.length ? <>{used.length === 1 ? "1 agent" : `${used.length} agents`} will pause at any step that needs {nameOf(c)}.</> : <>Agents lose access to {nameOf(c)}.</>}</p>
                <button type="button" onClick={() => setConfirm(false)} className={cx(BTN, "h-8 text-zinc-600 hover:bg-zinc-100")}>Cancel</button>
                <button type="button" onClick={disconnect} disabled={busy} className={cx(BTN, "bg-rust text-white hover:bg-[#86390c] disabled:opacity-80")}>{busy ? <Loader2 className="size-3.5 motion-safe:animate-spin" /> : <Unplug className="size-3.5" />}Disconnect</button>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={r ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: r ? 0 : 0.12 } }} className="flex items-center gap-3">
                <span className="text-[12px] text-zinc-400">History stays if you reconnect.</span>
                <button type="button" onClick={() => setConfirm(true)} className={cx(BTN, "ml-auto border border-zinc-200 text-zinc-600 hover:border-rust-100 hover:bg-rust-50 hover:text-rust")}><Unplug className="size-3.5" />Disconnect</button>
              </motion.div>
            )}
          </AnimatePresence>
        </footer>
      </motion.aside>
    </div>
  );
}
