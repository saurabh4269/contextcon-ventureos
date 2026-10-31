# Deal Desk: UI design brief

This brief is for any engineer or coding agent working on the Deal Desk UI. It covers the feeling the product should have, the references behind it, the design tokens, the main patterns, the intent for each screen, and a process you can follow by yourself to reach the bar.

---

## 1. Purpose and feeling

Deal Desk is an agentic operating system for VC and banking deal teams. Agents do the triage, diligence, founder scheduling, IC prep and portfolio watching. The people using it are partners and associates who **review and decide**. They don't configure bots.

The feeling to aim for:

- **A calm chief of staff.** Open any screen and know within 10 seconds what changed, what needs you, and what was already done for you.
- **Quiet premium.** Warm off-white canvas, ink type, one rust accent, serif headlines, hairline borders and soft elevation. No neon, no purple, no gradients-for-their-own-sake.
- **Visual first, minimal text.** Show a number, a pill, a sparkline or a graph before you show a paragraph. Use VC and banking vocabulary (fit, thesis, round, pre-money, IC, memo, data room), not SaaS jargon.
- **Agents that feel alive.** Work in progress is visible and moving: a travelling dot, a shimmering current step, checks that settle. Finished work is still and quiet.
- **Trust before polish.** Every number has a source you can open. When data is missing, the UI says so. It never fills the gap with a plausible fake.
- **Autonomous by default.** Agents act, then hold for a short window with **Undo**. Don't build approval queues or "waiting for your OK" screens.

---

## 2. References

References are **inspiration, not spec**. For each one, decide what to take, what to change and what to drop for Deal Desk's users, then tune the content to VC work. Dribbble resolves a shot from its numeric ID, so `dribbble.com/shots/<id>` opens the full shot.

### 2a. Product UI (Dribbble)

| # | Reference | What we take |
|---|---|---|
| 1 | [Agentic AI experience](https://dribbble.com/shots/27777412) | Overall agent design language for Home/Today: an orb Ask card, a calm work list, and a live step rail. |
| 2 | [AI Agent Platform Web App Design](https://dribbble.com/shots/27612659) | Layout and density for the agent home. Close copying of the layout is fine, as long as the content is re-tuned. |
| 3 | [AI Agent Platform Web App Design (2)](https://dribbble.com/shots/27611874) | Companion screens for the same set: card chrome and spacing rhythm. |
| 4 | [Recruitment Dashboard, Talent Management SaaS](https://dribbble.com/shots/26408608) | Today summary: one hero number, a single chart card, and a work list with filter pills. |
| 5 | [AI Voice Agent Dashboard](https://dribbble.com/shots/27707751) | Full-page assistant and its first-run state. |
| 6 | [AI Agent Assistant, AI Workflow Builder SaaS Dashboard](https://dribbble.com/shots/27706027) | Assistant as a modal or docked panel, plus the orb. |
| 7 | [AI Voice Agent Software](https://dribbble.com/shots/27783051) | Stat cards (icon chip, delta pill, "from last 7 days") and a table with status pills. Used for Pipeline. |
| 8 | [AI Voice Agent Software Design](https://dribbble.com/shots/27781143) | Pill-bars for sector and stage mix, used instead of donuts. |
| 9 | [Callora, AI Voice Agent Dashboard Composer](https://dribbble.com/shots/27690060) | Flow canvas and chart style: nodes, dashed connectors, and an inspector. Used for Agent flow and for charts generally. |
| 10 | [AI Voice Agent](https://dribbble.com/shots/27778536) | A settings modal floating over a blurred canvas. |
| 11 | [AI Voice Agent Dashboard](https://dribbble.com/shots/27772889) | Agents list: a trigger column and integration logos per agent. |
| 12 | [AI Agents Builder SaaS Dashboard](https://dribbble.com/shots/27668890) | Agents list density and status chips. |
| 13 | [Activity Tab for a Hiring Platform](https://dribbble.com/shots/24827568) | Person/founder timeline: every email, meeting and note in one place, grouped "This week / History". |
| 14 | [Schedule Interview modal, hiring app](https://dribbble.com/shots/26596242) | Meeting modal, fully prefilled: slot chips, duration, attendees and agenda. |
| 15 | [Scheduling, better-slots card](https://dribbble.com/shots/27447901) | An "AI found better slots" card that appears only when there is a conflict. |
| 16 | [Integration modal](https://dribbble.com/shots/26588149) | Just-in-time connect modal: our mark joined to the tool logo by a dotted line, with Allow / Not now. |
| 17 | [AI Agent Integration Page (Agento)](https://dribbble.com/shots/26523922) | Connectors page: filters with counts, a card grid with real logos, "Used by" agent chips, and "Last synced". |
| 18 | [AI Job Agent Features Landing Page (Lowker)](https://dribbble.com/shots/26826115) | Landing hero: an assistant card rising out of a glow, with question chips joined to answer chips by curved lines. Also the product-fragment feature cards. |
| 19 | [Orbid, Legal Services Platform](https://dribbble.com/shots/27804005) | Landing atmosphere: a warm sienna, amber and cream orb behind ribbed glass, a condensed serif headline with an italic accent word, a floating pill nav, and a dark pill CTA. |

**Earlier analytics references,** used for chart and dashboard craft:

| Reference | What we take |
|---|---|
| [Data visualization UI (tag)](https://dribbble.com/tags/data-visualization-ui) | Chart vocabulary: real axes, delta pills, and restrained colour. |
| [Social Media Analytics Dashboard](https://dribbble.com/shots/27174110-Social-Media-Analytics-Dashboard-SaaS-UI-UX-Design) | KPI card rhythm and trend lines. |
| [CashFlix Personal Finance Dashboard](https://dribbble.com/shots/27279494-CashFlix-Personal-Finance-Dashboard-UI-for-Fintech-Web-App) | Money formatting, balance-style hero numbers, and calm fintech density. |
| [Conversational AI Analytics Dashboard](https://dribbble.com/shots/27610659-Conversational-AI-Analytics-Dashboard-UI-Design) | An ask box that sits next to charts, with answers turning into visuals. |
| [E-commerce Analytics Dashboard](https://dribbble.com/shots/26969985-E-commerce-Analytics-Dashboard-UI) | Table and filter density for large lists. |
| [Sleek Landing Page for CoreShift](https://dribbble.com/shots/25869450-Sleek-Landing-Page-for-CoreShift) | Landing motion: slow, layered reveals and scroll-paced sections. |

### 2b. Other references

| Reference | What we take |
|---|---|
| [Legora aOS](https://legora.com/product/aos) | How clearly and visually a landing page can show the **product architecture and the set of agents** as one connected, layered system. See the "Architecture & agents section" pattern in section 4. |
| a16z, "It's Time To Build" (film) | Tone for the vision opening of the film and landing: real archival imagery, a confident and calm voice, and the idea that every leap in progress was funded. |
| Thinking-text shimmer (Linear, Claude, Gemini) | The running step's label shimmers like "thinking" text. Finished steps stop moving. |
| Voice-agent orb | A breathing glass sphere that reacts to audio. It is the assistant's presence on Home, and it shrinks to a floating sparkle button on every other screen. |

---

## 3. Design system tokens

These are taken from the live code (Tailwind v4 `@theme` plus CSS variables). Use the tokens themselves, not near-copies of them.

**Colour**

| Token | Value | Use |
|---|---|---|
| page | `#f8f8f7` plus a 2.5% fractal-noise grain | App background |
| canvas | `#fafafa` | Secondary surfaces |
| ink | `#09090b` | Text, primary buttons, chart ink |
| ink-2 | `#3f3f46` | Secondary chart ink |
| muted text | `#71717a` | Labels, eyebrows |
| axis / faint | `#a1a1aa` | Chart ticks |
| border | `#e4e4e7` | Inputs, dividers |
| hairline | `#ececee` | Card edges, grid |
| rust (accent) | `#9c440f` · 50 `#fbf3ee` · 100 `#f5e3d7` | The one accent: active state, fit highlights, citations |
| sienna (light) | `#c2652b` | Glows, running rings, second chart series |
| ok | `#3d6b4f` · 50 `#eff5f0` · 100 `#d9e8dd` | Good, healthy, passed |
| warn | `#8a5b12` · 50 `#fbf5e8` · 100 `#f0e2bf` | Needs attention, conflicts |

- Never use purple or blue as an accent.
- Third-party brand colours appear only inside their own logos.
- There is a **mono** variant: the same layout with ink in place of rust and sans in place of serif. It is useful for a "serious" print or bank mode.

**Type**
- Headlines and big numerals use **Newsreader** (a variable serif with optical sizing). Letter-spacing is −0.012em for headlines and −0.02em for numerals. Accent one word in *italic* (for example, "Your firm's *AI* deal team").
- UI text uses **Geist Sans** at 14/13/12 for the body, with `ss01` and `cv11` enabled.
- Code, endpoints, IDs and citations use **Geist Mono**.
- Numbers always use tabular figures (`tabular-nums`).
- Eyebrows are 10.5px, uppercase, tracked +0.09em, weight 550, muted. They can carry an optional small ink square mark.

**Shape and elevation**
- Card: white, no border, radius 14px, elevation e1 plus a 1px inner top highlight.
- Raised card: radius 16px, elevation e2. Popovers and tooltips use e3.
  - e1: `0 0 0 1px rgba(9,9,11,.055), 0 1px 1px rgba(9,9,11,.03), 0 2px 4px -2px rgba(9,9,11,.05)`
  - e2: `… 0 8px 24px -12px rgba(9,9,11,.14)`
  - e3: `… 0 24px 48px -20px rgba(9,9,11,.28)`
- Well (an inset area inside a card): radius 12px, a light vertical gradient, and an inset hairline.
- Pills and chips are fully rounded. The landing film frame uses a 28px radius.
- Spacing is on a 4px grid. Card padding is 16–24px, and the gap between sections is 24–32px.
- Backgrounds for canvases and empty areas use a dot grid (1px dots every 14–20px).

**Charts**
- Use Recharts/shadcn charts with a 1.25px stroke, grid lines in `#eeeef0` and 10.5px axis ticks.
- Tooltips are frosted white (`backdrop-blur 8px`) with e3 elevation.
- Show at most **one decision-useful chart per screen**. Label the axes and add a delta pill. Don't use donuts.

---

## 4. Key components and patterns

- **Shell.** A grouped left sidebar with few items. The top bar holds the page title and an "Ask" pill (⌘K). Open the assistant as a docked right panel (360px) on any page.
- **Company row.** Logo (or a monogram coloured from a hash of the name) → name → **fit pill** → sector → stage → owner → next step → inline decision. Hovering the fit pill names the top two signals behind the score.
- **Fit pill.** A number from 0 to 100 with a colour band: ok, neutral or warn. It is never just colour. The number is always shown.
- **Source chip.** A mono chip showing the source name, the field and how fresh it is, for example `Crustdata · headcount · 2h ago`. Clicking it opens the raw data point. A citation marker `[n]` in text flashes its chip.
- **Live step rail.** A vertical list of agent steps:
  - done = a quiet check
  - running = shimmering label plus a sienna ring
  - waiting = muted
  - A glowing dot travels down the connector.
- **Hold-and-undo action row.** "Reply to founder · sends in 4:12" shows a draining ring and an **Undo** button. After it sends, it settles to "Sent · view".
- **Signal graph.** The company sits at the centre, with signal nodes around it: headcount growth, hiring by function, founder background, web traffic, funding and job posts. Each node shows a sparkline or value plus a source chip. Edges carry a travelling dot into a **Fit** node, which lists the +/− contribution of each signal. The graph assembles node by node while research runs.
- **Conflict callout.** When two sources disagree, show **both values side by side** with their sources and a "which to trust" note. Never quietly pick one.
- **Unavailable state.** "Not available from source" (or "Connect X to see this") goes in the slot where the value would be, in muted ink, with a retry or connect action. Never show a zero or a guess.
- **Just-in-time connect modal.** Shown only when a step needs a tool that isn't connected yet. Choosing "Not now" leaves the step waiting, with a "Connect Calendar" chip.
- **Assistant orb.** A CSS-only glass sphere in sienna, amber and cream. It breathes slowly at rest (7s), and its ribbons speed up when thinking (about 2–3s). On Home it is large and voiced, with captions and mute. Everywhere else it is a small sparkle button at the bottom right. Clicking it speaks right away, with context from the current screen. It moves left when the dock is open.
- **Pill-bars.** Horizontal stacked bars for mix (sector, stage). Use them instead of donuts.
- **Architecture & agents section** (from Legora).
  - Show the system as one connected, layered diagram rather than a feature list.
  - The layers from bottom to top are: Data & connectors (Crustdata, mail, calendar, docs) → Memory & context (the firm's live memory) → Agent harness (routing, guardrails, hold/undo) → **the set of agents** (Inbound triage, Diligence, Meeting booker, IC prep, Portfolio watch, Founder follow-up) → Surfaces (Today, Deal, IC memo, Slack, voice).
  - Selecting a layer or agent highlights it and shows a one-line job plus the tools it uses.
  - Draw it as data, in the house style: cards, hairlines and a travelling dot that moves information upward.
  - Use it on the landing page and mirror it in the README.

---

## 5. Motion

- Easing is `cubic-bezier(.22,1,.36,1)` for entrances. Entrances run 250–400ms with fades of a few pixels (3px), not big slides.
- Thinking shimmer: 1.6–1.9s linear loop, ink with a sienna sweep.
- Travelling dot on connectors: about 1.1–1.6s per hop. Dashed connectors animate `stroke-dashoffset` (0.9s).
- Running node ring: a 1.6s sienna pulse. Skeleton lines: a 1.8s sweep in warm grey.
- Orb: 7s breathe at rest, faster while thinking, and driven by audio amplitude while speaking.
- Landing: slow Ken Burns on archival images (18–24s). Scroll-linked fills run **once** when they come into view.
- **Respect `prefers-reduced-motion` everywhere.** Freeze to the final state, and keep a `?still=1` URL flag for screenshots.
- Motion signals state. If nothing is happening, nothing moves.

---

## 6. Screens and their intent

- **Home / Today.**
  - "Good morning, *name*" with one hero number (for example, new inbound this week).
  - An Ask card in a soft sienna wash, with a voice greeting on first open.
  - A work list with stage filter pills (All / New / Screening / Diligence / IC).
  - The agents' live step rail, the next meetings (linked to prep briefs), and at most one chart.
  - Goal: know in 10 seconds what changed and what needs you.
- **Pipeline.** Stat cards with deltas, pill-bars for stage and sector mix, and a table (stage, fit, owner, next step, inline decision). Show icons only on row hover.
- **Deal page.** The header has the logo, round, stage, fit and owner. The **signal graph** is the hero. Then claims checked against the data room, conflicts shown openly, and the activity timeline.
- **Diligence (signal graph).** Plays the research live: each data call appears as it returns, with endpoint and latency in mono. The fit forms at the end, with its contributions listed.
- **IC memo.** Reads like a paper document. Use serif headings, and give every figure an inline citation that opens its source. Include conditions and risks, the vote and decision, and "Print / save as PDF" that prints only the paper.
- **Person / founder.** Header with relationship pill and "last touched". Tabs with counts (Activity, Emails, Meetings, Notes, Files). A timeline with agent actions marked ("AI drafted", "Escalated"). A side panel with details, the deal team and AI insights.
- **Meeting modal.** Prefilled by the agent: a company card, three free slots plus "Other time", 30/45/60 minutes, a Meet link, attendees and an editable agenda. Show "better slots" only on conflict. No calendar grid.
- **Agents and agent flow.** A list showing triggers, tools and status. The flow is a read-mostly canvas (Trigger → Extract → Enrich → Decide → Act) with node settings in a side sheet and guardrails as plain rules. During a live run the dot travels and the current node shimmers.
- **Memory (firm brain).** A live, append-only feed of what the firm learned and decided: who, what, when, and from which event. Filter it by deal or person. It is empty until something happens, and never seeded.
- **Portfolio.** Companies being watched, with signals that changed since the last check and a "why it matters" line. Alerts are linked to their sources.
- **Connectors (under Settings).** Filters (Connected / Needs attention / Suggested), categories, and logo cards with "Used by" agent chips and "Last synced". Buttons are Connect, Manage, or Reconnect (in warn colour).
- **Landing.** In order:
  1. Orbid-style glow hero, with the Lowker assistant card rising from it.
  2. The film, in a dark 16:9 frame.
  3. A vision band: archival "it was all funded" images plus a Kardashev progress line.
  4. "Every score traced to its source" with the live signal graph.
  5. A scroll-driven "day with Deal Desk" timeline.
  6. The **architecture and agents** section.
  7. Trust: connectors, hold-and-undo, and citations.
  8. One closing CTA.

  It must work at 1920, 1440, 1280 and 390 wide.
- **Drop everywhere.** Donuts, marketplaces, leaderboards, ratings, upgrade banners, purple, and decorative charts that don't help a decision.

---

## 7. Trust and data rules for the UI

1. **No fake numbers.** Every figure is computed from real data or comes from a cited source. Don't hard-code values in components, and don't use demo fallbacks in production.
2. **Show the source.** Any number that drives a decision carries a source chip with its freshness, and clicking it reaches the raw data.
3. **Make missing visible.** For loading, empty, error, unavailable and not-connected states, design each one deliberately and label it honestly. A failed call shows the failure and a retry. Never show silent zeros.
4. **Show conflicts openly.** Show disagreeing values side by side with their sources.
5. **Money and time.**
   - Show currency with an ISO code, and give any converted value its FX rate and date.
   - Parse and display Indian units (lakh/crore) correctly when the source uses them.
   - Store time in UTC and render it in the user's time zone with a label.
6. **Act, hold, undo.** Make the hold window and Undo visible on any outbound action.
7. **Keep logos and names honest.** Use real tool logos for integrations. Use generated monograms for companies without a logo. Don't imply a connector is live when it isn't.

---

## 8. Process for the agent

Follow this loop for each screen. It reaches the bar without any special tooling.

1. **Collect.** Open every reference for the screen and look at all of its frames, not only the hero image. Save stills locally.
2. **Extract.** For each reference, write three lines: *take / change / drop*, with the reasons for Deal Desk's users. Note layout, density, type scale, chart style and motion.
3. **Direction.** Sketch one or two directions in code, or as a quick static mock, and pick one. Screens without their own reference should copy the house style (Today) and borrow from the closest reference: flow and charts from #9, tables from #4, timelines from #13.
4. **Build.** Build from the tokens and shared components in sections 3 and 4. Wire the screen to real data paths, and design the loading, empty, error and unavailable states from the start.
5. **Screenshot.** Capture at 1440×900, 1280×800 and 390×844, with `?still=1` for stable frames. Also capture each data state.
6. **Self-score.** Put each screenshot next to its reference and the Today screen. Score these out of 10: layout, spacing, type, colour, polish, data honesty, motion, match to the reference, and consistency with Today. Write down the nits.
7. **Iterate.** Fix the nits and re-shoot. Repeat until every score is **9 or higher**. Then move on to the next screen.
8. **Cross-check.** Click through all screens end to end. The same company, number, person and time must agree everywhere.

---

## 9. Definition of done

- [ ] Every score is 9 or higher against the reference and the Today screen, at 1440, 1280 and 390.
- [ ] Type-check and production build are clean. No console errors or warnings, and no hydration mismatches.
- [ ] No horizontal scroll at any width. No layout shift: images have fixed sizes or aspect boxes, and below-the-fold media load lazily.
- [ ] No dead buttons, `href="#"`, lorem ipsum, placeholder text or broken images.
- [ ] Loading, empty, error and unavailable states exist and are honest, with nothing hard-coded or seeded.
- [ ] Every decision number has a working source chip, and conflicts are shown openly.
- [ ] Accessibility:
  - visible keyboard focus
  - `aria-label` on icon-only buttons
  - tooltips on the collapsed sidebar
  - AA contrast for text
  - colour is never the only signal (fit pills show the number)
  - captions for any voice
  - reduced motion respected
- [ ] Currency, units and time zones are labelled correctly.
