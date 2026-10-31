// Central display formatting. Every time, date and amount the UI renders goes through here.
//
// Times: stored as UTC ISO strings, rendered in Asia/Kolkata with the zone label "IST".
// Dates without a time (e.g. Crustdata "2024-03-15") are calendar dates: rendered as-is, no zone shift.
// Money: always { amount, currency } with an ISO 4217 code. Formatting never converts or relabels; a conversion would
// need a cited FX rate (source + date), which this build does not have, so amounts are shown in their own currency.

export const DISPLAY_TZ = "Asia/Kolkata";
export const DISPLAY_TZ_LABEL = "IST";
const LOCALE = "en-IN";

export type Money = { amount: number; currency: string };
export const money = (amount: number, currency: string): Money => ({ amount, currency: currency.toUpperCase() });
export const isMoney = (v: unknown): v is Money =>
  !!v && typeof v === "object" && typeof (v as Money).amount === "number" && typeof (v as Money).currency === "string";

const DATE_ONLY = /^\d{4}-\d{2}(-\d{2})?$/;
const parts = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: DISPLAY_TZ, ...opts }).format(new Date(iso));

/** "31 Oct 2026, 17:35 IST" for an instant; "15 Mar 2024" for a calendar date. "—" when missing/invalid. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  if (DATE_ONLY.test(iso)) return fmtDate(iso);
  if (Number.isNaN(Date.parse(iso))) return "—";
  return `${parts(iso, { day: "numeric", month: "short", year: "numeric" })}, ${parts(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} ${DISPLAY_TZ_LABEL}`;
}

/** "17:35 IST" */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return "—";
  return `${parts(iso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} ${DISPLAY_TZ_LABEL}`;
}

/** "15 Mar 2024". Calendar dates (YYYY-MM[-DD]) are not shifted; instants are shown as their IST date. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = DATE_ONLY.exec(iso);
  if (m) {
    const d = new Date(`${iso.length === 7 ? `${iso}-01` : iso}T00:00:00Z`);
    return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...(iso.length === 7 ? {} : { day: "numeric" }), month: "short", year: "numeric" }).format(d);
  }
  if (Number.isNaN(Date.parse(iso))) return "—";
  return parts(iso, { day: "numeric", month: "short", year: "numeric" });
}

/** "Saturday, 31 October" for an instant, as its IST calendar day (Today's date line). */
export function fmtWeekdayDate(iso: string | null | undefined): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return "—";
  return `${parts(iso, { weekday: "long" })}, ${parts(iso, { day: "numeric", month: "long" })}`;
}

/** "Sat" for an instant's IST weekday (chart axis labels). */
export const fmtWeekdayShort = (iso: string) => parts(iso, { weekday: "short" });

/** IST calendar day key "YYYY-MM-DD" of an instant (for grouping by day). */
export const istDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/** Epoch ms of midnight IST that starts an istDay key "YYYY-MM-DD" (IST has no DST). */
export const istDayStart = (day: string) => Date.parse(`${day}T00:00:00+05:30`);

/** "Mar" for a YYYY-MM[-DD] calendar month. */
export function fmtMonth(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "short" }).format(new Date(`${iso.slice(0, 7)}-01T00:00:00Z`));
}

/** "Mar 2024" for a YYYY-MM[-DD] calendar month. */
export function fmtMonthYear(iso: string | null | undefined): string | undefined {
  if (!iso || !/^\d{4}-\d{2}/.test(iso)) return undefined;
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", month: "short", year: "numeric" }).format(new Date(`${iso.slice(0, 7)}-01T00:00:00Z`));
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** "just now" · "5m ago" · "3h ago" · "2d ago" — always paired with an absolute fmtDateTime() in a title/hover. */
export function fmtAgo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return "never";
  const ms = Math.max(0, now.getTime() - Date.parse(iso));
  if (ms < MINUTE) return "just now";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`;
  return `${Math.floor(ms / DAY)}d ago`;
}

/* ── numbers ── */
const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
export const fmtInt = (v: unknown) => num(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
/** Signed percent, rounded to whole points: "+12%", "−3%", "0%". */
export const fmtPct = (v: unknown) => `${num(v) > 0 ? "+" : num(v) < 0 ? "−" : ""}${Math.abs(Math.round(num(v)))}%`;
/** "12.3K", "1.2M" */
export const fmtCompact = (v: unknown) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(num(v));

/** "$25M", "₹3.2B", "€800K" — compact, in the amount's own currency (never converted). */
export function fmtMoney(m: Money | null | undefined, opts: { compact?: boolean } = {}): string {
  if (!isMoney(m)) return "—";
  const compact = opts.compact ?? true;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: m.currency,
      ...(compact ? { notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 } : { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    }).format(m.amount);
  } catch {
    // unknown currency code: show the code rather than guessing a symbol
    return `${m.currency} ${fmtCompact(m.amount)}`;
  }
}

/** "Series A" from "series_a". */
export const fmtLabel = (v: unknown) => String(v).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
