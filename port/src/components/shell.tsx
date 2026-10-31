"use client";
import { Sun, Layers, Brain, Search, Settings, Sparkles, ArrowUp, X, PieChart, Briefcase, ChevronLeft, Workflow, History, PanelLeftClose, PanelLeftOpen, Menu, NotebookPen } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { AskContext, useAsk } from "./askctx";
import { AssistantDock } from "./assistant";
import Link from "next/link";
import { cx, Kbd, Avatar } from "./ui";
import { Pulse } from "./motion";
import { Mascot } from "./brand/mascot";
import { AccountMenu } from "./brand/account";
import { ROUTES } from "../routes";
import type { AssistantData, Crumb, Mode, Nav, ShellData, Tone2, User } from "../types";

export type { Nav, Mode };

const navHref: Record<Nav, (m: Mode) => string> = {
  today: (m) => ROUTES.today(m), pipeline: () => ROUTES.pipeline, portfolio: () => ROUTES.portfolio,
  mandates: () => ROUTES.mandates, brain: () => ROUTES.brain, settings: () => ROUTES.settings(), agents: () => ROUTES.agents, runs: () => ROUTES.runs, assistant: () => ROUTES.ask(),
};

/* ───────────── v5 · shell UI state: collapsible rail (lg+), off-canvas drawer (below lg) ───────────── */
const RAIL_KEY = "dealdesk:sidebar";
const LG = "(min-width: 1024px)";
/** Opens the firm-memory panel (MemoryDock, mounted in the root layout, listens for it). */
export const MEMORY_TOGGLE = "dealdesk:memory-toggle";

interface ShellUI { collapsed: boolean; toggleCollapsed: () => void; drawer: boolean; setDrawer: (o: boolean) => void; desktop: boolean | null; search: () => void }
const ShellUIContext = createContext<ShellUI | null>(null);
export const useShellUI = () => useContext(ShellUIContext);

/** true/false once mounted; null during SSR and the first client render (no hydration mismatch). */
function useDesktop() {
  const [v, setV] = useState<boolean | null>(null);
  useEffect(() => {
    const m = window.matchMedia(LG), on = () => setV(m.matches);
    on(); m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return v;
}

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

/** Row tooltip, shown only in the collapsed rail (lg+). The visible label stays in the DOM as sr-only text. */
function Tip({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-full z-[80] ml-2.5 hidden -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-white shadow-lg lg:group-hover:block lg:group-focus-visible:block">{children}</span>;
}

// Four destinations per mode. Watchlist / Passed / Mine are saved views of Pipeline; People open from search or a deal.
export function Sidebar({ active, mode = "invest", shell, onSearch, onAsk }: { active: Nav; mode?: Mode; shell: ShellData; onSearch?: () => void; onAsk?: () => void }) {
  const b = shell.badges;
  // v3.2: three labelled groups (Work / Agents / Firm). Settings joins Firm; "N agents working" sits on the Agents row.
  const ask = useAsk();
  const ui = useShellUI();
  const rail = !!ui?.collapsed; // rail styles are all lg:-prefixed, so the mobile drawer always shows labels
  const R = (c: string) => (rail ? c : "");
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (ui?.drawer && ui.desktop === false) closeBtn.current?.focus(); }, [ui?.drawer, ui?.desktop]);
  const closeDrawer = () => ui?.setDrawer(false);
  const groups: { label?: string; items: { id: Nav; label: string; icon: typeof Sun }[] }[] = [
    { label: "Work", items: [{ id: "today", label: "Today", icon: Sun }, { id: "pipeline", label: "Pipeline", icon: Layers }, mode === "bank" ? { id: "mandates", label: "Mandates", icon: Briefcase } : { id: "portfolio", label: "Portfolio", icon: PieChart }] },
    { label: "Agents", items: [{ id: "agents", label: "Agents", icon: Workflow }, { id: "runs", label: "Runs", icon: History }] },
    { label: "Firm", items: [{ id: "brain", label: "Firm brain", icon: Brain }, { id: "settings", label: "Settings", icon: Settings }] },
  ];
  const row = cx("group relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-rust/30", R("lg:justify-center lg:px-0"));
  const label = cx("truncate", R("lg:sr-only"));
  const assistantOn = ask?.open || active === "assistant";
  const user = shell.user;
  return (
    <aside id="dd-sidebar" data-shell-sidebar="" data-rail={rail ? "" : undefined} aria-label="Sidebar"
      inert={ui?.desktop === false && !ui.drawer ? true : undefined}
      className={cx("flex h-dvh flex-col border-r border-zinc-200/70 bg-[#f4f4f5]",
        "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-[70] max-lg:w-[min(288px,86vw)] max-lg:transition-transform max-lg:duration-200",
        ui?.drawer ? "max-lg:translate-x-0 max-lg:shadow-[0_24px_60px_-20px_rgba(9,9,11,.4)]" : "max-lg:-translate-x-full",
        "lg:sticky lg:top-0 lg:shrink-0 lg:transition-[width] lg:duration-200", rail ? "lg:w-[60px]" : "lg:w-[220px]")}>
      <div className={cx("flex items-center gap-2 pt-4 pr-2 pl-4", R("lg:flex-col lg:gap-2 lg:px-0"))}>
        <Link href={navHref.today(mode)} onClick={closeDrawer} aria-label="Deal Desk, go to Today" className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-rust/30">
          <Mascot size={26} />
          <span className={cx("serif truncate text-[16.5px] leading-none text-ink", R("lg:hidden"))}>Deal Desk</span>
        </Link>
        {ui && (
          <button type="button" onClick={ui.toggleCollapsed} aria-label={rail ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={rail} title={`${rail ? "Expand" : "Collapse"} sidebar (⌘\\)`}
            className={cx("hidden size-7 place-items-center rounded-md text-zinc-400 hover:bg-zinc-200/60 hover:text-ink lg:grid", !rail && "ml-auto")}>
            {rail ? <PanelLeftOpen className="size-4" strokeWidth={1.75} /> : <PanelLeftClose className="size-4" strokeWidth={1.75} />}
          </button>
        )}
        {ui && <button ref={closeBtn} type="button" onClick={closeDrawer} aria-label="Close menu" className="ml-auto grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-200/60 hover:text-ink lg:hidden"><X className="size-4" /></button>}
      </div>
      <div className={cx("space-y-px px-3 pt-3", R("lg:px-2"))}>
        <button type="button" onClick={() => { closeDrawer(); (onSearch ?? ui?.search)?.(); }} className={cx(row, "text-zinc-500 hover:bg-zinc-200/50")}>
          <Search className="size-3.5 shrink-0" /><span className={label}>Search</span>
          <span className={cx("ml-auto max-lg:hidden", R("lg:hidden"))}><Kbd>/</Kbd></span>
          <Tip show={rail}>Search <span className="opacity-60">/</span></Tip>
        </button>
        <button type="button" onClick={() => { closeDrawer(); (onAsk ?? ask?.toggle)?.(); }} aria-pressed={assistantOn} className={cx(row, "hover:bg-zinc-200/50", assistantOn ? "text-ink" : "text-zinc-500", active === "assistant" && "bg-white shadow-[0_1px_2px_rgba(9,9,11,.06)]")}>
          <Sparkles className="size-3.5 shrink-0" /><span className={label}>Assistant</span>
          <span className={cx("ml-auto max-lg:hidden", R("lg:hidden"))}><Kbd>⌘J</Kbd></span>
          <Tip show={rail}>Assistant <span className="opacity-60">⌘J</span></Tip>
        </button>
        <button type="button" onClick={() => { closeDrawer(); window.dispatchEvent(new Event(MEMORY_TOGGLE)); }} className={cx(row, "text-zinc-500 hover:bg-zinc-200/50")}>
          <NotebookPen className="size-3.5 shrink-0" /><span className={label}>Memory</span>
          <Tip show={rail}>Firm memory</Tip>
        </button>
      </div>
      <nav className={cx("mt-1 min-h-0 flex-1 px-2 max-lg:overflow-y-auto")} aria-label="Main">
        {groups.map((g, gi) => (
          <div key={gi} className={cx("space-y-px", gi > 0 && "mt-4", R("lg:mt-2.5 lg:border-t lg:border-zinc-200/80 lg:pt-2.5"))}>
            {g.label && <div className={cx("px-2.5 pb-1 text-[11px] text-zinc-400", R("lg:hidden"))}>{g.label}</div>}
            {g.items.map((it) => {
              const I = it.icon, on = it.id === active, badge = b[it.id], live = it.id === "agents" && (shell.agentsWorking ?? 0) > 0;
              const extra = live ? `${shell.agentsWorking} ${shell.agentsWorking === 1 ? "agent" : "agents"} working` : badge ? `${badge.count}` : "";
              return (
                <Link key={it.id} href={navHref[it.id](mode)} onClick={closeDrawer} aria-current={on ? "page" : undefined} className={cx(row, "cursor-pointer", on ? "bg-white font-medium text-ink shadow-[0_1px_2px_rgba(9,9,11,.06)] ring-1 ring-zinc-200/80" : "text-zinc-600 hover:bg-zinc-200/50")}>
                  <I className={cx("size-[15px] shrink-0", on ? "text-ink" : "text-zinc-500")} strokeWidth={1.75} />
                  <span className={label}>{it.label}{rail && extra ? <span className="sr-only">, {extra}</span> : null}</span>
                  {live ? <span className={cx("ml-auto flex items-center gap-1.5 text-[11px] text-zinc-400 tnum", R("lg:hidden"))} title={extra}><Pulse />{shell.agentsWorking}</span>
                    : badge && <span className={cx("ml-auto flex items-center gap-1 text-[11px] tnum", badge.alert ? "text-rust" : "text-zinc-400", R("lg:hidden"))}>{badge.alert && <span className="size-1.5 rounded-full bg-rust" />}{badge.count}</span>}
                  {rail && (live || badge) && <span aria-hidden="true" className={cx("absolute top-1 right-2.5 hidden size-1.5 rounded-full ring-2 ring-[#f4f4f5] lg:block", live ? "bg-[#2f9a5c]" : badge?.alert ? "bg-rust" : "bg-zinc-400")} />}
                  <Tip show={rail}>{it.label}{extra && <span className="ml-1 opacity-60">{extra}</span>}</Tip>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className={cx("px-3 pb-3", R("lg:px-2"))}>
        <div className="border-t border-zinc-200/80 pt-2">
          <AccountMenu user={user} onNavigate={closeDrawer}>
            {({ ref, toggle, open, props }) => (
              <button ref={ref} type="button" onClick={toggle} {...props} aria-label={`Account: ${user.name}`}
                className={cx("group relative flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left outline-none hover:bg-zinc-200/50 focus-visible:ring-2 focus-visible:ring-rust/30", open && "bg-zinc-200/50", R("lg:justify-center lg:px-0"))}>
                <Avatar i={user.initials} src={user.avatarUrl} size={28} tone="ink" />
                <span className={cx("min-w-0 flex-1 leading-tight", R("lg:hidden"))}>
                  <span className="block truncate text-[12.5px] font-medium text-ink">{user.name}</span>
                  <span className="block truncate text-[11px] text-zinc-500">{shell.firm ? shell.firm.name : (user.role ? `${user.role} · Deal Desk` : "Deal Desk")}</span>
                </span>
                <Tip show={rail}>{user.name}</Tip>
              </button>
            )}
          </AccountMenu>
        </div>
      </div>
    </aside>
  );
}

export function Crumbs({ items }: { items: Crumb[] }) {
  return <>{items.map((c, i) => <span key={i} className="flex items-center gap-1.5">{i > 0 && <span className="text-zinc-300">/</span>}{c.href && i < items.length - 1 ? <Link href={c.href} className="hover:text-ink">{c.label}</Link> : <span className={cx(i === items.length - 1 && "font-medium text-ink")}>{c.label}</span>}</span>)}</>;
}

function AskPill({ ctx, onAsk }: { ctx?: string; onAsk?: () => void }) {
  const a = useAsk();
  return (
    <button type="button" onClick={onAsk ?? a?.toggle} aria-pressed={a?.open} aria-label="Ask Deal Desk" className={cx("flex h-9 w-full min-w-0 items-center gap-2 rounded-full border bg-white pr-1.5 pl-3.5 text-[13px] shadow-[0_1px_2px_rgba(9,9,11,.04)] transition-colors hover:border-zinc-300", a?.open ? "border-zinc-300 text-ink" : "border-zinc-200 text-zinc-500")}>
      <Sparkles className="size-3.5 shrink-0 text-ink/70" strokeWidth={1.75} />
      <span className="truncate">{ctx && ctx !== "All deals" ? `Ask Deal Desk about ${ctx}` : "Ask Deal Desk"}</span>
      <span className="ml-auto flex items-center gap-1"><Kbd>⌘K</Kbd></span>
    </button>
  );
}

// One input on every screen. It knows where you are (ctx) and answers with sources.
/** The operator, provided by <Page> so every TopBar can show the avatar without prop drilling. */
const MeContext = createContext<User | undefined>(undefined);

export function TopBar({ crumbs, right, ctx = "All deals", ask = true, bell = false, onAsk, pill = true, lead, me }: { crumbs: Crumb[]; right?: ReactNode; ctx?: string; ask?: boolean; /** red "unread" dot; the bell is only drawn when there is something unread (there is no notification feed) */ bell?: boolean; onAsk?: () => void; pill?: boolean; /** left slot (e.g. page title + date); replaces the back link */ lead?: ReactNode; /** operator, shown as an avatar at the right */ me?: { initials: string; name: string } & Partial<User> }) {
  const ctxMe = useContext(MeContext);
  const user: User | undefined = me ? { id: me.id ?? "me", firstName: me.firstName ?? me.name, ...me } : ctxMe;
  const ui = useShellUI();
  const a = useAsk();
  const back = (() => { const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined; return parent?.href ? <Link href={parent.href} className="flex min-w-0 items-center gap-1 hover:text-ink"><ChevronLeft className="size-3.5 shrink-0" /><span className="truncate">{parent.label}</span></Link> : null; })();
  return (
    <header className="sticky top-0 z-20 flex h-[52px] items-center gap-2 border-b border-zinc-200/70 bg-[#f8f8f7]/85 px-3 backdrop-blur-md sm:gap-4 sm:px-6">
      <div className="flex min-w-0 flex-1 basis-0 items-center gap-1.5 text-[12.5px] text-zinc-500">
        {ui && (
          <button type="button" onClick={() => ui.setDrawer(true)} aria-label="Open menu" aria-expanded={ui.drawer} aria-controls="dd-sidebar" className="-ml-1 grid size-9 shrink-0 place-items-center rounded-lg text-zinc-600 hover:bg-white hover:text-ink lg:hidden">
            <Menu className="size-[18px]" strokeWidth={1.75} />
          </button>
        )}
        {ui && <Link href={ROUTES.today()} aria-label="Deal Desk, go to Today" className="mr-1 shrink-0 lg:hidden"><Mascot size={24} /></Link>}
        {/* v3.2: one quiet back link when you are inside something; the page title already names where you are. */}
        <div className="flex min-w-0 items-center gap-1.5 truncate">{lead ?? back}</div>
      </div>
      {/* v3.2: persistent "Ask Deal Desk ⌘K" pill on every page (md+); phones get an icon button on the right. */}
      {pill && <div className={cx("hidden min-w-0 justify-center md:flex", ask ? "flex-[0_1_420px]" : "flex-[0_1_300px]")}><AskPill ctx={ctx} onAsk={onAsk} /></div>}
      <div className="flex flex-1 basis-0 items-center justify-end gap-1.5 sm:gap-2">{right}
        {pill && (
          <button type="button" onClick={onAsk ?? a?.toggle} aria-pressed={a?.open} aria-label="Ask Deal Desk" className={cx("grid size-9 shrink-0 place-items-center rounded-full border bg-white shadow-[0_1px_2px_rgba(9,9,11,.04)] md:hidden", a?.open ? "border-zinc-300 text-ink" : "border-zinc-200 text-zinc-600")}>
            <Sparkles className="size-4" strokeWidth={1.75} />
          </button>
        )}
        {bell && <span role="img" aria-label="Unread notifications" className="relative grid size-8 place-items-center rounded-full text-zinc-500"><BellDot /></span>}
        {user && (
          <AccountMenu user={user} place="bottom-end">
            {({ ref, toggle, props }) => (
              <button ref={ref} type="button" onClick={toggle} {...props} aria-label={`Account: ${user.name}`} title={user.name} className="ml-0.5 grid shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-rust/40">
                <Avatar i={user.initials} src={user.avatarUrl} size={28} tone="ink" />
              </button>
            )}
          </AccountMenu>
        )}
      </div>
    </header>
  );
}

function BellDot() {
  return <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /><circle cx="18" cy="5" r="3" fill="#9c440f" stroke="#f8f8f7" strokeWidth="2" /></svg>;
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
      <aside role="dialog" aria-modal="true" style={{ width: w }} className="fixed top-2 right-2 bottom-2 z-50 flex max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_60px_-20px_rgba(9,9,11,.35)]">
        <div className="flex items-start gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0 flex-1"><div className="serif text-[20px] leading-tight">{title}</div>{sub && <div className="mt-1 text-[12px] text-zinc-500">{sub}</div>}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex items-center gap-1.5 text-zinc-400"><span className="max-sm:hidden"><Kbd>Esc</Kbd></span><X className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">{children}</div>
        {foot && <div className="border-t border-zinc-100 px-5 py-3">{foot}</div>}
      </aside>
    </>
  );
}

/** Chrome-only dock when the shell brings no assistant content at all. */
const DOCK_BLANK: AssistantData = { title: "Ask Deal Desk", context: "All deals", placeholder: "Ask anything…", messages: [], suggestions: [] };

/**
 * "/" and the sidebar Search row: focus the page's own search box when it has one (e.g. Pipeline); otherwise go to the
 * agent page, which hosts the "find companies" request box.
 */
function useSearch() {
  const router = useContext(AppRouterContext);
  return useCallback(() => {
    const box = document.querySelector<HTMLInputElement>('main input[type="search"], main input[aria-label^="Search" i]');
    if (box) { box.focus(); box.select?.(); return; }
    if (router) router.push("/agent"); else window.location.assign("/agent");
  }, [router]);
}

/** App frame. Fluid: sidebar rail/drawer, docked assistant on lg+, full-screen assistant sheet on phones. */
export function Page({ active, children, top, mode, overlay, shell, dock, tone = "warm" }: { active: Nav; children: ReactNode; top: ReactNode; mode?: Mode; overlay?: ReactNode; shell: ShellData; /** v3.2: docked right panel (assistant). */ dock?: ReactNode; /** v3.2: "mono" renders the near-monochrome comparison variant. */ tone?: Tone2 }) {
  const host = useAsk();
  const [localOpen, setLocalOpen] = useState(!!dock);
  const open = host ? host.open : localOpen;
  const setOpen = host ? host.setOpen : setLocalOpen;
  const ctx = host ?? { open, setOpen, toggle: () => setOpen(!open) };
  const desktop = useDesktop();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const search = useSearch();
  const path = usePathname();

  // Persisted rail choice, read after mount (the server always renders the expanded sidebar).
  useEffect(() => { try { setCollapsed(localStorage.getItem(RAIL_KEY) === "rail"); } catch { /* storage blocked */ } }, []);
  const toggleCollapsed = useCallback(() => setCollapsed((c) => { try { localStorage.setItem(RAIL_KEY, c ? "full" : "rail"); } catch { /* storage blocked */ } return !c; }), []);
  // Phones: a page that brings its own dock does not open it over the content on arrival.
  const settled = useRef(false);
  useEffect(() => { if (desktop === null || settled.current) return; settled.current = true; if (!desktop && open) setOpen(false); }, [desktop, open, setOpen]);
  useEffect(() => { setDrawer(false); }, [path]);
  useEffect(() => { if (desktop) setDrawer(false); }, [desktop]);
  // The floating memory launcher steps aside while the shell is on screen (the sidebar has a Memory row).
  useEffect(() => { document.body.dataset.shell = ""; return () => { delete document.body.dataset.shell; }; }, []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // ⌘K (pill) and ⌘J (sidebar) both toggle the dock on every page.
      if (mod && (e.key === "k" || e.key === "j")) { e.preventDefault(); setOpen(!open); return; }
      // ⌘\ / Ctrl+\ only: "[" and "]" already step through deal tabs.
      if (mod && e.key === "\\") { e.preventDefault(); if (desktop === false) setDrawer((d) => !d); else toggleCollapsed(); return; }
      if (!mod && !e.altKey && e.key === "/" && !typing(e.target)) { e.preventDefault(); search(); return; }
      if (e.key === "Escape" && drawer) { setDrawer(false); return; }
      if (e.key === "Escape" && desktop === false && open && !e.defaultPrevented) setOpen(false);
    };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, [open, setOpen, desktop, toggleCollapsed, search, drawer]);

  const content = dock ?? host?.dock ?? <AssistantDock data={shell.assistant ?? shell.assistantByPage?.[active] ?? shell.assistantByPage?.today ?? DOCK_BLANK} />;
  const ui: ShellUI = { collapsed, toggleCollapsed, drawer, setDrawer, desktop, search };
  return (
    <MeContext.Provider value={shell.user}>
    <ShellUIContext.Provider value={ui}>
    <AskContext.Provider value={{ ...ctx, open, setOpen, toggle: () => setOpen(!open) }}>
      <div data-dock={open ? "open" : "closed"} data-rail={collapsed ? "" : undefined} className={cx("group/page flex min-h-screen w-full", tone === "mono" && "mono")}>
        <Sidebar active={active} mode={mode} shell={shell} />
        {drawer && <div aria-hidden="true" onClick={() => setDrawer(false)} className="fixed inset-0 z-[69] bg-zinc-900/25 backdrop-blur-[1px] lg:hidden" />}
        <main className="@container/main flex min-w-0 flex-1 flex-col">
          {top}
          {children}
        </main>
        {open && (
          <aside aria-label="Assistant" className={cx("flex flex-col bg-white",
            "max-lg:fixed max-lg:inset-0 max-lg:z-[75]", desktop === null && "max-lg:hidden",
            "lg:sticky lg:top-0 lg:h-screen lg:w-[360px] lg:shrink-0 lg:border-l lg:border-zinc-200/70")}>
            {/* phones: full-screen sheet with its own way out (some docks bring no close button) */}
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-100 px-3 lg:hidden [&:has(+div_button[aria-label=Close])]:hidden">
              <Mascot size={22} /><span className="serif text-[15px] text-ink">Ask Deal Desk</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="ml-auto grid size-9 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-ink"><X className="size-[18px]" /></button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{content}</div>
          </aside>
        )}
        {overlay}
      </div>
    </AskContext.Provider>
    </ShellUIContext.Provider>
    </MeContext.Provider>
  );
}
