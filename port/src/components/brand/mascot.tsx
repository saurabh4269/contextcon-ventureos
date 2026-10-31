/**
 * Dex, the Deal Desk mascot: a small round rust fox with reading glasses and a tiny ledger.
 * One drawing, two crops: under 48px only the head is drawn (sidebar logo, favicon size); from 48px up the full
 * character (body, ledger, wagging tail) is drawn for empty and loading states.
 * Motion (blink, tail wag, thinking dots) is CSS in globals.css (`.dex-*`) and stops under prefers-reduced-motion.
 */
import { cx } from "../ui";

export type MascotMood = "idle" | "thinking" | "happy" | "sorry";

const RUST = "#9c440f", RUST_D = "#7a340b", CREAM = "#fbf1e4", INK = "#18181b";

/** Head in a 64×64 box (centre ~32,36). `glasses` only where there is room for them. */
function Head({ mood, glasses }: { mood: MascotMood; glasses: boolean }) {
  const droop = mood === "sorry";
  const eyeY = mood === "thinking" ? 33 : mood === "sorry" ? 35.5 : 34.5;
  const eyeDX = mood === "thinking" ? 1.2 : 0;
  return (
    <g>
      {/* ears (droop outward when sorry) */}
      <g transform={droop ? "rotate(-14 18 24)" : undefined}>
        <path d="M11 30 L13 7 L29 19 Z" fill={RUST} stroke={RUST} strokeWidth="3" strokeLinejoin="round" />
        <path d="M15 24 L16 13 L24 19 Z" fill={INK} opacity=".85" strokeLinejoin="round" />
      </g>
      <g transform={droop ? "rotate(14 46 24)" : undefined}>
        <path d="M53 30 L51 7 L35 19 Z" fill={RUST} stroke={RUST} strokeWidth="3" strokeLinejoin="round" />
        <path d="M49 24 L48 13 L40 19 Z" fill={INK} opacity=".85" strokeLinejoin="round" />
      </g>
      {/* head */}
      <ellipse cx="32" cy="36" rx="23" ry="19.5" fill={RUST} />
      {/* cream cheeks + muzzle */}
      <path d="M9.5 37 C17 35.5 25 39 32 46 C39 39 47 35.5 54.5 37 C53 49 44 55.5 32 55.5 C20 55.5 11 49 9.5 37 Z" fill={CREAM} />
      {/* eyes */}
      {mood === "happy" ? (
        <g fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round">
          <path d="M20.5 35 Q24 30.5 27.5 35" /><path d="M36.5 35 Q40 30.5 43.5 35" />
        </g>
      ) : (
        <g className="dex-blink" fill={INK}>
          <ellipse cx={24 + eyeDX} cy={eyeY} rx="2.9" ry="3.3" /><ellipse cx={40 + eyeDX} cy={eyeY} rx="2.9" ry="3.3" />
          <circle cx={25 + eyeDX} cy={eyeY - 1.2} r=".9" fill="#fff" /><circle cx={41 + eyeDX} cy={eyeY - 1.2} r=".9" fill="#fff" />
        </g>
      )}
      {mood === "sorry" && <g stroke={INK} strokeWidth="1.8" strokeLinecap="round"><path d="M19.5 30 L26.5 27.6" /><path d="M44.5 30 L37.5 27.6" /></g>}
      {mood === "thinking" && <path d="M36.5 27.5 L43.5 26.5" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />}
      {/* reading glasses */}
      {glasses && (
        <g fill="none" stroke={INK} strokeWidth="1.5" opacity=".9">
          <circle cx="24" cy="34.5" r="6.4" /><circle cx="40" cy="34.5" r="6.4" /><path d="M30.4 33.8 Q32 32.6 33.6 33.8" />
        </g>
      )}
      {/* nose + mouth */}
      <path d="M29.3 43.6 Q32 41.8 34.7 43.6 Q33.6 46.3 32 46.4 Q30.4 46.3 29.3 43.6 Z" fill={INK} />
      {mood === "happy" ? <path d="M28 48.4 Q32 53.6 36 48.4 Z" fill={INK} />
        : mood === "sorry" ? <path d="M28.6 51 Q32 48 35.4 51" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        : mood === "thinking" ? <path d="M30 49.6 L35 49" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        : <path d="M28.4 48.2 Q30.2 50.4 32 48.4 Q33.8 50.4 35.6 48.2" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />}
      {mood === "happy" && <g fill="#e08a57" opacity=".55"><ellipse cx="16" cy="43" rx="3.4" ry="2.2" /><ellipse cx="48" cy="43" rx="3.4" ry="2.2" /></g>}
    </g>
  );
}

/** The mascot. `size` in px. Decorative unless `title` is given. */
export function Mascot({ size = 28, mood = "idle", title, className, animate = true }: { size?: number; mood?: MascotMood; title?: string; className?: string; animate?: boolean }) {
  const full = size >= 48;
  const a11y = title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true as const };
  if (!full) {
    return (
      <svg width={size} height={size} viewBox="7 4 50 54" className={cx("dex shrink-0", !animate && "dex-still", className)} data-mood={mood} {...a11y}>
        <Head mood={mood} glasses={false} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size * (78 / 80)} viewBox="0 0 80 78" className={cx("dex shrink-0", !animate && "dex-still", className)} data-mood={mood} {...a11y}>
      {/* tail (behind) */}
      <g className="dex-tail">
        <path d="M50 66 C64 69 77 58 75 41 C74 34 67 31 64.5 36 C66 48 60 57 48 60 Z" fill={RUST} />
        <path d="M75 41 C74 34 67 31 64.5 36 C65.2 39.5 65.4 42.4 65.2 45 C69.5 45.6 73.8 44.2 75 41 Z" fill={CREAM} />
      </g>
      {/* body */}
      <ellipse cx="38" cy="65" rx="18" ry="11.5" fill={RUST} />
      <ellipse cx="38" cy="67.5" rx="10.5" ry="8" fill={CREAM} />
      {/* ledger with a little rust bookmark, held in two paws */}
      <g transform="rotate(-7 38 66)">
        <rect x="27" y="58.5" width="22" height="15" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
        <path d="M38 58.5 V73.5" stroke={INK} strokeWidth="1.2" />
        <path d="M30 63 H35.5 M30 66.5 H35.5 M40.5 63 H46 M40.5 66.5 H44" stroke="#a1a1aa" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M44 58.5 V63 L45.5 61.8 L47 63 V58.5 Z" fill={RUST} />
        <circle cx="28" cy="70" r="3.2" fill={RUST_D} /><circle cx="48" cy="70" r="3.2" fill={RUST_D} />
      </g>
      <g transform="translate(6 -2)"><Head mood={mood} glasses /></g>
      {mood === "thinking" && (
        <g fill={INK}>
          <circle className="dex-dot" cx="64" cy="10" r="1.8" /><circle className="dex-dot" style={{ animationDelay: ".2s" }} cx="70" cy="7" r="2.2" /><circle className="dex-dot" style={{ animationDelay: ".4s" }} cx="76.5" cy="4" r="2.6" />
        </g>
      )}
      {mood === "sorry" && <path d="M66 22 Q63.5 26 66 27.5 Q68.5 26 66 22 Z" fill="#7fb2d6" />}
    </svg>
  );
}

/** Mascot + "Deal Desk" wordmark (sidebar header). Collapsed shows the mascot only. */
export function Logo({ collapsed = false, size = 26, className }: { collapsed?: boolean; size?: number; className?: string }) {
  return (
    <span className={cx("flex min-w-0 items-center gap-2", className)}>
      <Mascot size={size} title={collapsed ? "Deal Desk" : undefined} />
      {!collapsed && <span className="serif truncate text-[16.5px] leading-none text-ink">Deal Desk</span>}
    </span>
  );
}
