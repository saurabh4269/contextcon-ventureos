"use client";
import { Sun, Layers, Brain, Search, Settings, Sparkles, ArrowUp, Bell, X, PieChart, Briefcase, ChevronLeft, Workflow, History } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AskContext, useAsk } from "./askctx";
import { AssistantDock } from "./assistant";
import Link from "next/link";
import { cx, Kbd, Avatar } from "./ui";
import { Pulse } from "./motion";
import { ROUTES } from "../routes";
import type { AssistantData, Crumb, Mode, Nav, ShellData, Tone2 } from "../types";

export type { Nav, Mode };

const navHref: Record<Nav, (m: Mode) => string> = {
  today: (m) => ROUTES.today(m), pipeline: () => ROUTES.pipeline, portfolio: () => ROUTES.portfolio,
  mandates: () => ROUTES.mandates, brain: () => ROUTES.brain, settings: () => ROUTES.settings(), agents: () => ROUTES.agents, runs: () => ROUTES.runs, assistant: () => ROUTES.ask(),
};

// Four destinations per mode. Watchlist / Passed / Mine are saved views of Pipeline; People open from search or a deal.
export function Sidebar({ active, mode = "invest", shell, onSearch, onAsk }: { active: Nav; mode?: Mode; shell: ShellData; onSearch?: () => void; onAsk?: () => void }) {
  const b = shell.badges;
  // v3.2: a few labelled groups. Agents get their own home; "N agents working" moved onto that row.
  // v3.2: three labelled groups (Work / Agents / Firm). Settings joins Firm; "N agents working" sits on the Agents row.
  const ask = useAsk();
  const groups: { label?: string; items: { id: Nav; label: string; icon: typeof Sun }[] }[] = [
    { label: "Work", items: [{ id: "today", label: "Today", icon: Sun }, { id: "pipeline", label: "Pipeline", icon: Layers }, mode === "bank" ? { id: "mandates", label: "Mandates", icon: Briefcase } : { id: "portfolio", label: "Portfolio", icon: PieChart }] },
    { label: "Agents", items: [{ id: "agents", label: "Agents", icon: Workflow }, { id: "runs", label: "Runs", icon: History }] },
    { label: "Firm", items: [{ id: "brain", label: "Firm brain", icon: Brain }, { id: "settings", label: "Settings", icon: Settings }] },
  ];
  return (
    <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col border-r border-zinc-200/70 bg-[#f4f4f5]">
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <span className="flex size-7 items-center justify-center rounded-[7px] bg-ink font-serif text-[16px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)]">D</span>
        <span className="serif text-[16px] text-ink">Deal Desk</span>
      </div>
      <div className="mx-3 mt-3 grid grid-cols-2 rounded-lg bg-zinc-200/60 p-0.5 text-[11.5px]">
        {(["invest", "bank"] as const).map((m) => <Link key={m} href={ROUTES.today(m)} aria-current={m === mode ? "page" : undefined} className={cx("rounded-md py-1 text-center", m === mode ? "bg-white font-medium text-ink shadow-sm" : "text-zinc-500 hover:text-ink")}>{m === "invest" ? "Investing" : "Banking"}</Link>)}
      </div>
      <div className="px-3 pt-3">
        <button type="button" onClick={onSearch} className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[12.5px] text-zinc-500 hover:bg-zinc-200/50">
          <Search className="size-3.5" /> Search
          <span className="ml-auto"><Kbd>/</Kbd></span>
        </button>
        <button type="button" onClick={onAsk ?? ask?.toggle} aria-pressed={ask?.open || active === "assistant"} className={cx("flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[12.5px] hover:bg-zinc-200/50", ask?.open || active === "assistant" ? "text-ink" : "text-zinc-500", active === "assistant" && "bg-white shadow-[0_1px_2px_rgba(9,9,11,.06)]")}>
          <Sparkles className="size-3.5" /> Assistant
          <span className="ml-auto"><Kbd>⌘J</Kbd></span>
        </button>
      </div>
      <nav className="mt-1 px-2" aria-label="Main">
        {groups.map((g, gi) => (
          <div key={gi} className={cx("space-y-px", gi > 0 && "mt-4")}>
            {g.label && <div className="px-2.5 pb-1 text-[11px] text-zinc-400">{g.label}</div>}
            {g.items.map((it) => {
              const I = it.icon, on = it.id === active, badge = b[it.id], live = it.id === "agents" && shell.agentsWorking > 0;
              return (
                <Link key={it.id} href={navHref[it.id](mode)} aria-current={on ? "page" : undefined} className={cx("group flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px]", on ? "bg-white font-medium text-ink shadow-[0_1px_2px_rgba(9,9,11,.06)] ring-1 ring-zinc-200/80" : "text-zinc-600 hover:bg-zinc-200/50")}>
                  <I className={cx("size-[15px]", on ? "text-ink" : "text-zinc-500")} strokeWidth={1.75} />
                  {it.label}
                  {live ? <span className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-400 tnum" title={`${shell.agentsWorking} ${shell.agentsWorking === 1 ? "agent" : "agents"} working`}><Pulse />{shell.agentsWorking}</span>
                    : badge && <span className={cx("ml-auto flex items-center gap-1 text-[11px] tnum", badge.alert ? "text-rust" : "text-zinc-400")}>{badge.alert && <span className="size-1.5 rounded-full bg-rust" />}{badge.count}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="mt-auto px-3 pb-3">
        {shell.firm ? (
          <div className="flex items-center gap-2.5 border-t border-zinc-200/80 px-1 pt-3" title={shell.firm.name}>
            <span className="serif grid size-7 shrink-0 place-items-center rounded-lg bg-white text-[14px] text-ink shadow-[0_1px_2px_rgba(9,9,11,.06)] ring-1 ring-zinc-200/80">{shell.firm.initial}</span>
            <span className="min-w-0 leading-tight"><span className="block truncate text-[12.5px] font-medium">{shell.firm.name}</span><span className="block truncate text-[11px] text-zinc-500">{shell.firm.sub}</span></span>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t border-zinc-200/80 px-1 pt-3">
            <Avatar i={shell.user.initials} size={24} tone="ink" />
            <span className="text-[12.5px] font-medium">{shell.user.firstName}</span>
          </div>
        )}
      </div>
    </aside>
  );
}

export function Crumbs({ items }: { items: Crumb[] }) {
  return <>{items.map((c, i) => <span key={i} className="flex items-center gap-1.5">{i > 0 && <span className="text-zinc-300">/</span>}{c.href && i < items.length - 1 ? <Link href={c.href} className="hover:text-ink">{c.label}</Link> : <span className={cx(i === items.length - 1 && "font-medium text-ink")}>{c.label}</span>}</span>)}</>;
}

function AskPill({ ctx, onAsk, wide }: { ctx?: string; onAsk?: () => void; wide?: boolean }) {
  const a = useAsk();
  return (
    <button type="button" onClick={onAsk ?? a?.toggle} aria-pressed={a?.open} aria-label="Ask Deal Desk" className={cx("mx-auto flex h-9 min-w-0 items-center gap-2 rounded-full border bg-white pr-1.5 pl-3.5 text-[13px] shadow-[0_1px_2px_rgba(9,9,11,.04)] transition-colors hover:border-zinc-300", wide ? "w-[420px]" : "w-[300px]", a?.open ? "border-zinc-300 text-ink" : "border-zinc-200 text-zinc-500")}>
      <Sparkles className="size-3.5 text-ink/70" strokeWidth={1.75} />
      <span className="truncate">{ctx && ctx !== "All deals" ? `Ask Deal Desk about ${ctx}` : "Ask Deal Desk"}</span>
      <span className="ml-auto flex items-center gap-1"><Kbd>⌘K</Kbd></span>
    </button>
  );
}

// One input on every screen. It knows where you are (ctx) and answers with sources.
/** v3.2 · the signed-in user, provided by <Page> so every TopBar can show the avatar without prop drilling. */
const MeContext = createContext<{ initials: string; name: string } | undefined>(undefined);

export function TopBar({ crumbs, right, ctx = "All deals", ask = true, bell = true, onAsk, pill = true, lead, me }: { crumbs: Crumb[]; right?: ReactNode; ctx?: string; ask?: boolean; bell?: boolean; onAsk?: () => void; pill?: boolean; /** left slot (e.g. page title + date); replaces the back link */ lead?: ReactNode; /** signed-in user, shown as an avatar after the bell */ me?: { initials: string; name: string } }) {
  const ctxMe = useContext(MeContext);
  me = me ?? ctxMe;
  return (
    <header className="sticky top-0 z-20 flex h-[52px] items-center gap-4 border-b border-zinc-200/70 bg-[#f8f8f7]/85 px-6 backdrop-blur-md">
      <div className="flex w-[300px] min-w-0 items-center gap-1.5 text-[12.5px] text-zinc-500">{/* v3.2: one quiet back link when you are inside something; the page title already names where you are. */}{lead ?? (() => { const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined; return parent?.href ? <Link href={parent.href} className="flex items-center gap-1 hover:text-ink"><ChevronLeft className="size-3.5" />{parent.label}</Link> : null; })()}</div>
      {/* v3.2: persistent "Ask Deal Desk ⌘K" pill on every page; opens the docked assistant. `ask` kept for compatibility. */}
      {pill ? <AskPill ctx={ctx} onAsk={onAsk} wide={ask} /> : <span className="flex-1" />}
      <div className="flex w-[300px] items-center justify-end gap-2">{right}
        <button type="button" aria-label={bell ? "Notifications, unread" : "Notifications"} className="relative grid size-8 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-white hover:text-ink hover:shadow-[0_1px_2px_rgba(9,9,11,.06)]"><Bell className="size-4" strokeWidth={1.75} />{bell && <span className="absolute top-[7px] right-[8px] size-1.5 rounded-full bg-rust ring-2 ring-[#f8f8f7]" />}</button>
        {me && <span title={me.name} className="ml-1"><Avatar i={me.initials} size={28} tone="ink" /></span>}
      </div>
    </header>
  );
}

export function Composer({ placeholder, chips, onAsk, onChip }: { placeholder: string; chips?: string[]; onAsk?: () => void; onChip?: (c: string) => void }) {
  return (
    <div>
      <button type="button" onClick={onAsk} className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(9,9,11,.04),0_10px_30px_-14px_rgba(9,9,11,.16)]">
        <Sparkles className="size-4 text-rust" strokeWidth={1.75} />
        <span className="text-[14px] text-zinc-400">{placeholder}</span>
        <span className="ml-auto flex size-8 items-center justify-center rounded-xl bg-ink text-white"><ArrowUp className="size-4" /></span>
      </button>
      {chips && <div className="mt-2.5 flex flex-wrap gap-1.5">{chips.map((c) => <button type="button" key={c} onClick={() => onChip?.(c)} className="cursor-pointer rounded-full border border-zinc-200 bg-white px-3 py-1 text-[12px] text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50">{c}</button>)}</div>}
    </div>
  );
}

// Slide-in panel for artifacts and agent runs (Claude/ChatGPT-style side panel).
export function SidePanel({ title, sub, children, w = 480, foot, onClose }: { title: ReactNode; sub?: ReactNode; children: ReactNode; w?: number; foot?: ReactNode; onClose?: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-zinc-900/10 backdrop-blur-[1px]" onClick={onClose} />
      <aside role="dialog" aria-modal="true" style={{ width: w }} className="fixed top-2 right-2 bottom-2 z-50 flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_60px_-20px_rgba(9,9,11,.35)]">
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0 flex-1"><div className="serif text-[20px] leading-tight">{title}</div>{sub && <div className="mt-1 text-[12px] text-zinc-500">{sub}</div>}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex items-center gap-1.5 text-zinc-400"><Kbd>Esc</Kbd><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">{children}</div>
        {foot && <div className="border-t border-zinc-100 px-5 py-3">{foot}</div>}
      </aside>
    </>
  );
}

/** Chrome-only dock when the shell brings no assistant content at all. */
const DOCK_BLANK: AssistantData = { title: "Ask Deal Desk", context: "All deals", placeholder: "Ask anything…", messages: [], suggestions: [] };

/** App frame. Fluid width; designed at 1440–1600, min 1280. */
export function Page({ active, children, top, mode, overlay, shell, dock, tone = "warm" }: { active: Nav; children: ReactNode; top: ReactNode; mode?: Mode; overlay?: ReactNode; shell: ShellData; /** v3.2: docked right panel (assistant). */ dock?: ReactNode; /** v3.2: "mono" renders the near-monochrome comparison variant. */ tone?: Tone2 }) {
  const host = useAsk();
  const [localOpen, setLocalOpen] = useState(!!dock);
  const open = host ? host.open : localOpen;
  const setOpen = host ? host.setOpen : setLocalOpen;
  const ctx = host ?? { open, setOpen, toggle: () => setOpen(!open) };
  // ⌘K (pill) and ⌘J (sidebar) both toggle the dock on every page.
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "j")) { e.preventDefault(); setOpen(!open); } };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, [open, setOpen]);
  const content = dock ?? host?.dock ?? <AssistantDock data={shell.assistant ?? shell.assistantByPage?.[active] ?? shell.assistantByPage?.today ?? DOCK_BLANK} />;
  return (
    <MeContext.Provider value={shell.user}>
    <AskContext.Provider value={{ ...ctx, open, setOpen, toggle: () => setOpen(!open) }}>
      <div data-dock={open ? "open" : "closed"} className={cx("group/page flex min-h-screen w-full min-w-[1280px]", tone === "mono" && "mono")}>
        <Sidebar active={active} mode={mode} shell={shell} />
        <main className="@container/main flex min-w-0 flex-1 flex-col">
          {top}
          {children}
        </main>
        {open && <aside aria-label="Assistant" className="sticky top-0 flex h-screen w-[360px] shrink-0 flex-col border-l border-zinc-200/70 bg-white">{content}</aside>}
        {overlay}
      </div>
    </AskContext.Provider>
    </MeContext.Provider>
  );
}
