"use client";
/**
 * Account menu (bottom-left of the sidebar, and the top-right avatar): who is operating this desk, where to configure
 * it, the real keyboard shortcuts, how the live data works, and the source. There is no auth in this build, so there is
 * no sign-out. Menu pattern: role="menu", arrow keys / Home / End move, Esc and outside click close and return focus.
 */
import { BookOpen, ExternalLink, Github, Keyboard, Plug, Settings, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent as RKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Avatar, cx, Kbd } from "../ui";
import { Mascot } from "./mascot";
import { ROUTES } from "../../routes";
import type { User } from "../../types";

export const REPO_URL = "https://github.com/saurabh4269/contextcon-ventureos";

/** Modal dialog in a portal (the mobile drawer is transformed, which would trap `position: fixed`). */
export function Dialog({ title, onClose, children, w = 440 }: { title: ReactNode; onClose: () => void; children: ReactNode; w?: number }) {
  const id = useId(), close = useRef<HTMLButtonElement>(null), box = useRef<HTMLDivElement>(null);
  const done = useRef(onClose);
  done.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done.current(); }
      if (e.key === "Tab" && box.current) { // keep focus inside
        const f = [...box.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])")];
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", on, true);
    return () => { window.removeEventListener("keydown", on, true); prev?.focus?.(); };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center p-3">
      <div className="absolute inset-0 bg-zinc-900/25 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={id} style={{ width: w }} className="relative max-h-[calc(100dvh-24px)] max-w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-[0_24px_60px_-20px_rgba(9,9,11,.35)] ring-1 ring-zinc-200">
        <div className="flex items-start gap-3">
          <h2 id={id} className="serif min-w-0 flex-1 text-[21px] leading-tight text-ink">{title}</h2>
          <button ref={close} type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-1 grid size-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-ink"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Only shortcuts that are wired (Page in shell.tsx). */
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const mod = isMac() ? "⌘" : "Ctrl";
  const rows: [ReactNode, string][] = [
    [<><Kbd>{mod}</Kbd><Kbd>K</Kbd></>, "Open or close the assistant"],
    [<><Kbd>{mod}</Kbd><Kbd>J</Kbd></>, "Open or close the assistant"],
    [<Kbd>/</Kbd>, "Search this page, or find companies"],
    [<><Kbd>{mod}</Kbd><Kbd>\</Kbd></>, "Collapse or expand the sidebar"],
    [<Kbd>Esc</Kbd>, "Close menus, dialogs and panels"],
  ];
  return (
    <Dialog title="Keyboard shortcuts" onClose={onClose} w={400}>
      <dl className="mt-4 divide-y divide-zinc-100">
        {rows.map(([k, label], i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 text-[13px]">
            <dt className="flex w-[110px] shrink-0 items-center gap-1">{k}</dt>
            <dd className="text-zinc-600">{label}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

export function HowItWorksDialog({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["Crustdata", "Companies, founders, headcount and funding, fetched live for each deal."],
    ["Gmail and Calendar", "Your founder threads and meetings, once Google is connected."],
    ["ElevenLabs", "The spoken morning brief and the voice assistant."],
    ["Firm memory", "Every research run, note and action, recorded as it happens."],
  ];
  return (
    <Dialog title="How Deal Desk works" onClose={onClose} w={460}>
      <div className="mt-3 flex items-center gap-4">
        <Mascot size={88} mood="happy" />
        <p className="text-[13px] leading-relaxed text-zinc-600">Dex reads live sources and shows you what they say. No demo data: when a source is down, you see that.</p>
      </div>
      <ul className="mt-4 space-y-2.5">
        {rows.map(([k, v]) => (
          <li key={k} className="flex gap-2.5 text-[13px] leading-snug"><span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-rust" /><span><b className="font-medium text-ink">{k}</b> <span className="text-zinc-600">{v}</span></span></li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl bg-rust-50 px-3.5 py-2.5 text-[12.5px] text-rust ring-1 ring-rust-100"><b className="font-semibold">Trust rule:</b> every number cites its source.</div>
    </Dialog>
  );
}

const itemCls = "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] text-zinc-700 outline-none hover:bg-zinc-100 focus-visible:bg-zinc-100 focus-visible:text-ink";

/**
 * The trigger is rendered by the caller via `children(props)` so the sidebar row and the top-bar avatar share one menu.
 * `place`: where the menu opens relative to the trigger.
 */
export function AccountMenu({ user, place = "top-start", children, onNavigate }: {
  user: User;
  place?: "top-start" | "bottom-end";
  onNavigate?: () => void;
  children: (p: { ref: React.RefObject<HTMLButtonElement | null>; open: boolean; toggle: () => void; props: Record<string, string | boolean | undefined> }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<null | "keys" | "how">(null);
  const trigger = useRef<HTMLButtonElement | null>(null), menu = useRef<HTMLDivElement>(null), wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
  const close = (refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const out = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, [open]);

  const onKey = (e: RKeyboardEvent) => {
    const list = items(), i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); list[list.length - 1]?.focus(); }
    else if (e.key === "Tab") setOpen(false);
  };
  const go = () => { setOpen(false); onNavigate?.(); };
  const openDialog = (d: "keys" | "how") => { setOpen(false); setDialog(d); };
  const endDialog = () => { setDialog(null); trigger.current?.focus(); };

  return (
    <div ref={wrap} className="relative">
      {children({ ref: trigger, open, toggle: () => setOpen((o) => !o), props: { "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": open ? id : undefined } })}
      {open && (
        <div ref={menu} id={id} role="menu" aria-label="Account" onKeyDown={onKey}
          className={cx("absolute z-[80] w-[264px] max-w-[calc(100vw-24px)] rounded-xl bg-white p-1.5 shadow-[0_18px_48px_-16px_rgba(9,9,11,.32)] ring-1 ring-zinc-200",
            place === "top-start" ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2")}>
          <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-2.5">
            <Avatar i={user.initials} src={user.avatarUrl} size={36} tone="ink" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13.5px] font-medium text-ink">{user.name}</div>
              <div className="truncate text-[11.5px] text-zinc-500">{user.role ? `${user.role} · Deal Desk` : "Deal Desk"}</div>
            </div>
          </div>
          {user.github && (
            <a role="menuitem" href={`https://github.com/${user.github}`} target="_blank" rel="noreferrer" onClick={go} className={cx(itemCls, "h-7 text-[12px] text-zinc-500")}>
              <Github className="size-3.5" strokeWidth={1.75} />@{user.github}<ExternalLink className="ml-auto size-3 text-zinc-300" />
            </a>
          )}
          <div className="my-1 border-t border-zinc-100" />
          <Link role="menuitem" href={ROUTES.settings()} onClick={go} className={itemCls}><Settings className="size-[15px] text-zinc-500" strokeWidth={1.75} />Settings</Link>
          <Link role="menuitem" href={ROUTES.connectors} onClick={go} className={itemCls}><Plug className="size-[15px] text-zinc-500" strokeWidth={1.75} />Connectors</Link>
          <button role="menuitem" type="button" onClick={() => openDialog("keys")} className={itemCls}><Keyboard className="size-[15px] text-zinc-500" strokeWidth={1.75} />Keyboard shortcuts</button>
          <button role="menuitem" type="button" onClick={() => openDialog("how")} className={itemCls}><BookOpen className="size-[15px] text-zinc-500" strokeWidth={1.75} />How Deal Desk works</button>
          <a role="menuitem" href={REPO_URL} target="_blank" rel="noreferrer" onClick={go} className={itemCls}><Github className="size-[15px] text-zinc-500" strokeWidth={1.75} />Source code on GitHub<ExternalLink className="ml-auto size-3 text-zinc-300" /></a>
          <div className="my-1 border-t border-zinc-100" />
          <div className="flex items-center gap-1.5 px-2.5 pt-1 pb-1.5 text-[11px] text-zinc-400"><span className="size-1.5 rounded-full bg-[#2f9a5c]" />Live data only · outbound in dry-run</div>
        </div>
      )}
      {dialog === "keys" && <ShortcutsDialog onClose={endDialog} />}
      {dialog === "how" && <HowItWorksDialog onClose={endDialog} />}
    </div>
  );
}
