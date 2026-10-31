# New screens and states (folded in; no new tabs or sidebar items)

Source of the requirements: `insider/inbound_workflow.md` (roles, RBAC + Chinese walls §5, Slack/Teams §6, tune-it layer + onboarding §7) and the 12-item steer.
Each entry: **intent** · **placement/route** · **components + props** · **API** · **atlas refs** · **side-by-side** (`reference/compare/<id>.jpg`, our full-height shot left, atlas right) · **score**.

Scores are my review of the 1440 render against the atlas reference on: hierarchy, one primary per card, density, wording, states. All ≥ 9.0.

| # | Item | Placement | Ref PNG | Side-by-side | Score |
|---|---|---|---|---|---|
| 1 | Settings hub | `/settings?section=workflow` | settings | settings.jpg (rillet-12, rogo-13) | 9.2 |
| 2 | Onboarding wizard | `/today?first=1&step=1..5` | onboarding-1…5 | onboarding-1/4/5.jpg (devin-01, affinity-07, rillet-12 + clay-01) | 9.0–9.2 |
| 3 | Roles & members + wall groups | `/settings?section=members` | settings-members | settings-members.jpg (rogo-13, affinity-07) | 9.1 |
| 4 | Restricted deal view | `/deals/[id]` on 403 | deal-restricted | deal-restricted.jpg (glean-06) | 9.0 |
| 5 | Deal team: Claim / suggestion / Sourced by | Deal page right rail | deal-team-open, deal-page | deal-team-open.jpg (attio-02) | 9.0 |
| 6 | Access audit | `/settings?section=access` (admin) | settings-access | settings-access.jpg (harmonic-15) | 9.1 |
| 7 | Banking gate checklist | Mandates page, gated mandate | mandates-gated | mandates-gated.jpg (ramp-02) | 9.1 |
| 8 | Chinese-wall badge | everywhere a walled thing shows | deal-restricted, settings-members, command-k-denied | (in the above) | n/a (atom) |
| 9 | Denial in Ask + ⌘K | overlays on any page | ask-denied, command-k-denied | ask-denied.jpg, command-k-denied.jpg (hebbia-03) | 9.0 / 9.1 |
| 10 | Firm brain: outcomes, priors, thesis proposals | `/brain` (new sections under memories) | firm-brain | firm-brain.jpg (attio-02, ramp-02) | 9.2 |
| 11 | Export + BYO LLM keys | `/settings?section=export` | settings-export | settings-export.jpg (harmonic-15) | 9.0 |
| 12 | Valuation priors on IC memo | IC memo, Recommendation block | memo-priors | memo-priors.jpg (ramp-02) | 9.1 |
| + | Hold countdown with undo | Today (toast + queue card) | hold-queue | hold-queue.jpg (rillet-05, rillet-16) | 9.2 |
| + | Slack/Teams approval cards | Slack/Teams; design ref `/preview/slack` | slack-preview | slack-preview.jpg (clay-01) | 9.3 |
| + | Integrations health | `/settings?section=integrations` | settings-integrations | settings-integrations.jpg (affinity-07) | 9.1 |

---

## 1. Settings hub (Workflow)
- **Intent.** The "tune it" layer (§7) on one calm page: everything a partner sets once and an agent obeys. Autosaves; each control says what it changes in plain words.
- **Sections on the page:** Thesis (sectors/stages/geos chips, check-size range, ownership target) · Stages (journey; rename/reorder) · Pass templates (reason + preview + uses) · Autonomy L0–L3 (`AutonomyControl`) + **hold minutes** (`Stepper`) · Owner rule (`Segmented`: *Assign directly* / *Ask first*) · Briefs · Guardrails.
  Autonomy (`AUTONOMY` in components/firm.tsx): L0 Watch (reads and flags, writes nothing) · L1 Draft (default; you send) · L2 Send on approve (sends what you approve after the hold) · L3 Act (moves stages, sends routine passes, still held). Every send waits `holdMinutes` and is undoable. Warm-intro passes are never auto-sent at any level.
- **Props.** `SettingsScreen { data: SettingsData; section: "workflow"; onPatchConfig(patch: Partial<FirmConfig>) → void|Promise; onToggleBrief; onToggleGuardrail }`.
- **API.** `GET/PATCH /api/firm/config` (✓).
- **Atlas.** rillet-12 (AI settings guardrails), rogo-13 (agent permissions: allow/ask/block).

## 2. Onboarding wizard
- **Intent.** 5 steps, ~3 minutes, and the agent visibly starts working on the right while you type (inbox scan → Crustdata match → warm intros → first brief time). Value before setup ends.
- **Steps:** 1 Firm (name, website, mode, check size) · 2 Mail & calendar (Google / Microsoft; Continue is secondary until connected) · 3 Thesis (pre-filled from the website, source shown) · 4 Team (invites suggested from mail with *why*; role per invite) · 5 Approvals (Slack/Teams, autonomy + hold, live preview of the exact approval card).
- **Props.** `OnboardingScreen { data: OnboardingData; slackPreview?: SlackMessage; onStep; onChange(patch); onNext; onBack; onFinish(data); onConnect("google"|"microsoft"|"slack"|"teams"); busy?; error? }`.
- **API.** `POST /api/firm/onboarding` (✓) on Finish; OAuth starts @assumed.
- **Deviation.** Research order starts with mail; we start with firm basics (needed to pre-fill the thesis). One-line swap via `steps`.
- **Atlas.** devin-01 (home + agent working), affinity-07 (admin setup), rillet-12, clay-01 (approval card).

## 3. Roles & members, with wall groups
- **Intent.** "Roles set the ceiling; deal membership sets access" (§5). One table: person, role (select, admin only), walls they're inside, status. Below: wall groups with codename, size, **approver**, Manage. Right rail: what each role can do in one line each, plus "Walls apply everywhere: pipeline, ⌘K, Ask, Slack and MCP".
- **Props.** `SettingsData.members: FirmMember[]`, `wallGroups: WallGroup[]`, `roles: {id,label,summary}[]`, `isAdmin`; callbacks `onInvite`, `onChangeRole(memberId, role)`, `onManageWall(wallId)`, `onNewWall`.
- **API.** `firm_members` (✓); routes @assumed (see PORTING §4).
- **Atlas.** rogo-13, affinity-07.

## 4. Restricted deal view
- **Intent.** A walled deal exists (pipeline counts stay right) but outsiders see only the **codename**, a striped logo, masked fields, *why* they can't see it, who approves, and one primary: **Request access** → becomes "Requested · Compliance will reply in Slack" + Withdraw. Ask and search skip it for them.
- **Props.** `RestrictedDealScreen { data: RestrictedDeal; channel?: string; mode?; onRequestAccess(codename) → void|Promise; onWithdraw }`.
- **API.** `GET /api/deals/[id]` → 403 `{restricted, codename, reason}` (✓); request @assumed.
- **Atlas.** glean-06 (agent table → masked rows pattern).

## 5. Deal team panel: Claim, owner suggestion, Sourced by
- **Intent.** Default "suggest + one-tap claim" (§0.6). If no lead: suggestion card (who, why: coverage/calendar/load, confidence) with one primary **Claim** and a secondary *Assign Priya* (`ownerRule=assign_directly`) or *Ask Priya* (`ask_first`). **Sourced by** is locked credit from email headers; the agent never rewrites it. Claim is optimistic with Undo.
- **Props.** `DealTeamPanel { team: DealTeam; me?; onClaim() → void|Promise; onAssign(userId); onUndoClaim }`, also via `DealScreen`.
- **API.** `POST /api/deals/[id]/claim` (✓), `GET /api/deals/[id]/owner-suggestion` (✓), assign @assumed.
- **Atlas.** attio-02 (proposed update you accept).

## 6. Access audit (admin only)
- **Intent.** Every denial (web, Ask, ⌘K, Slack, MCP, API) is a row: when, who, which codename, surface, reason. Regulators ask for this (17a-4 / 204-2 recordkeeping). Export CSV is the one action.
- **Props.** `SettingsData.audit: AccessDeniedRow[]`, `onExportAudit`. Non-admins: tab hidden; direct link → "Admins only" empty state.
- **API.** `access_denied_log` (✓); read route @assumed.
- **Atlas.** harmonic-15 (API activity log).

## 7. Banking gate checklist
- **Intent.** A bank can't work a mandate before **Conflicts cleared → Engagement letter signed → KYC done** (§0.8). Gated mandates show a checklist card at the top: each gate with state badge (cleared/pending/blocked/todo), owner, date, and the single next action (Request check / Send EL / Start KYC / Nudge). Materials, buyer list and data room stay locked with "unlocks when conflicts clear". `GateStrip` is the compact version for headers.
- **Props.** `MandatesData.gates?: MandateGate[]`, `onGateAction(gateId)`; `GateChecklist`, `GateStrip`, `GateBadge`.
- **API.** `GET /api/mandates/[id]/gates` @assumed.
- **Atlas.** ramp-02 (policy agent recommendation cards).

## 8. Chinese-wall badge
- **Intent.** One atom so walls read the same everywhere: lock + "Restricted" when you're outside; shield + "Walled" when you're inside. Used on deal header, restricted view, members/walls table, palette and Ask denial, Slack ephemeral card.
- **Props.** `WallBadge { inside?: boolean; size?: "sm"|"xs" }`.

## 9. Denial in Ask (⌘J) and ⌘K
- **Intent.** Wall-aware retrieval filters *before* the model sees anything. When a query hits a walled deal the asker sees, **only to them**: the codename, the reason, Request access. No partial answer, no counts. Logged to access_denied_log; never shown in shared views.
- **Props.** `AskData.answer = { kind: "denied"; denial: AccessDenial }`; `PaletteData.denied?: AccessDenial`; `DenialNote { d; onRequest?; compact? }`; overlays take `onRequestAccess(codename)`.
- **API.** `POST /api/concierge/ask` (✓) returns the denial variant @assumed shape.
- **Atlas.** hebbia-03 (command center ⌘K).

## 10. Firm brain: outcomes, priors, thesis proposals
- **Intent.** Close the loop: decisions → outcomes (invested/passed + what happened) → **priors** (median multiples, hit rates) → **thesis proposals** the agent drafts (e.g. "Check size $2–8M → $3–10M: your last 4 Series B leads needed $9M+ to reach 12% ownership", with evidence). Partners approve or reject; one primary Approve on the first card only, Undo after a decision.
- **Props.** `BrainData.outcomes: Outcome[]`, `priors[]`, `proposals: ThesisProposal[]`; `onDecideProposal(id, "approve"|"reject") → void|Promise`, `onUndoDecision(id)`.
- **API.** `GET /api/firm/thesis-proposals`, `POST /api/firm/thesis-proposals/[id]` (✓); outcomes @assumed.
- **Atlas.** attio-02 (approve a proposed change), ramp-02.

## 11. Settings → Export & keys
- **Intent.** Your data is yours: one button exports the whole firm (deals, memos, brain, audit) as a bundle; shows last export. **BYO LLM keys**: paste once, stored encrypted, shown masked (`sk-…4f2a`) forever after; Remove only.
- **Props.** `SettingsData.export: ExportData`; `onExportBundle() → Promise<{url,size}>`; `onSaveKey(provider, key) → Promise<{masked}>`; `onRemoveKey(id)`.
- **API.** `POST /api/firm/export` (✓); keys @assumed.
- **Atlas.** harmonic-15 (API usage/keys page).

## 12. Valuation priors on the IC memo
- **Intent.** Under the recommendation: our cap against the firm's own past multiples (IQR band, median, the comparable deals named with outcome). Turns "why $133M" into a firm fact. VC basis "Pre-money / ARR"; bank "EV / ARR".
- **Props.** `MemoData.priors?: ValuationPriors`; `PriorsStrip { p; cap; ask?; unit? }`. Absent → hidden.
- **API.** `GET /api/firm/priors` @assumed or included in memo.
- **Atlas.** ramp-02.

## + Hold countdown with undo
- **Intent.** At autonomy L2, approved sends don't leave immediately: they wait `holdMinutes` (default 5). A **toast** (bottom-right) shows the latest with a draining ring, *Undo* and *Send now*; a **queue card** on Today lists all holding items with time left. After the window the row reads "Sent"; after Undo it reads "Back in drafts". Same actions exist on the Slack card.
- **Props.** `TodayData.outbound: OutboundItem[]`, `TodayScreen.holdMinutes`, `tick` (false freezes for tests); `onUndoSend(id)`, `onSendNow(id)`; atoms `HoldToast`, `OutboundQueue`, `OutboundRow`, `HoldRing`, `useCountdown`.
- **API.** outbound routes @assumed; `secondsLeft` computed server-side from `hold_until`.
- **Atlas.** rillet-05 (activity queue needing approval), rillet-16 (workflow queue).

## + Slack / Teams approval cards
- **Intent.** Block Kit cards, one primary each, thread-based (§6): (s1) *Approve & send* a draft · (s1b) holding with *Undo* / *Send now* · (s2) owner suggestion *Claim it* · (s3) wall-crossing request to compliance *Approve/Deny* · (s4) **ephemeral** denial "Project Falcon is restricted" with *Request access*. Footer always says it's logged.
- **Props.** `SlackMessage`, `SlackCard { m; onAction(messageId, buttonId) }`, `SlackFrame`, `SlackPreviewScreen { channels }`.
- **API.** Slack interactivity → server verifies the clicker's permission; mirror to audit log.
- **Atlas.** clay-01 (Slack approval card).

## Others (in the bundle, smaller)
- **Integrations health** (`/settings?section=integrations`): status per tool (on / fix / off), a single *Fix* where broken, MCP URL + copy. Banking shows Outlook/Excel/PowerPoint/Teams. Atlas: affinity-07.
- **Walled data room** (`DataRoomScreen walled`): files listed for wall members only; badge on header.
- **Non-admin Settings** (`settingsMember` fixture): read-only roles, no Invite, no Access audit.
- **Loading/error** for every screen (`status` prop) – covered by the render test.

## v3 · Helio storyline (seed deal, inbound → IC → Portfolio → brain)

This adds states only. There are no new tabs or sidebar items. Routes, fixtures and props are in PORTING §7.

- **Today inbound fit:** a 2-column card with the founder, the ask, thesis checks (✓/×) and a fit gauge. Primary action: Claim.
- **Deal and memo, seed growth:** the most important chart in the app. It overlays deck-claimed 40% a month against the bank-verified 22% curve, with the gap shaded and both sources cited.
- **Header ask:** `RangeMini` in a fixed viewBox, so "Ask $…" never clips at 1440.
- **Slack:**
  - the claim confirmation is ephemeral, with Undo;
  - the IC vote fills avatar slots and a 3-segment bar, then a "term sheet on hold" line, then a stage move;
  - the milestone shows an ARR run-rate against the memo plan.
- **Pipeline → Portfolio:** the closed card lifts out of Term sheet and drops into a Portfolio dock. The page then fills in 5 steps, a toast appears and offers "Open in Portfolio", and the Portfolio end state carries a "Filled from the deal" badge.
- **Firm brain:**
  - the firm thesis card is always shown;
  - an approved proposal lands in place: the old line is struck, the new one is swept in, then a "Learned from Helio · Jan" chip appears.
- **Not designed:** a founder email template (low priority, still open).

## Still open (from inbound_workflow §8, not designed here)
- Pass-draft + referrer close-out card (DM example 2), per-deal channel toggle, IC dissent UI (the IC vote itself is now in Slack, v3), term-sheet/closing checklist. Good next pass.
