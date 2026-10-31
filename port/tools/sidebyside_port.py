# Usage: python3 scripts/sidebyside_port.py -> port/reference/compare/<id>.jpg  (ours @1440 full | atlas refs)
from PIL import Image, ImageDraw, ImageFont
import os
G="/usr/share/fonts/truetype/sand-box/google/Geist/Geist-VariableFont_wght.ttf"
def F(sz):
    return ImageFont.truetype(G, sz)
A="/workspace/ui-atlas/img/"; R="port/reference/full/"; O="port/reference/compare/"; os.makedirs(O, exist_ok=True)
S = {
 "onboarding-1": (["devin-01"], 9.1, "Firm basics first; the agent starts work in the right column while you type"),
 "onboarding-4": (["affinity-07"], 9.0, "Team invites suggested from mail, role per person, roles explained once"),
 "onboarding-5": (["rillet-12","clay-01"], 9.2, "Autonomy L0–L3 + hold minutes, with the exact Slack card you'll get"),
 "hold-queue": (["rillet-05","rillet-16"], 9.2, "Approved sends wait in a visible queue with a countdown; Undo on every row"),
 "slack-preview": (["clay-01"], 9.3, "Hold approval, owner suggestion, wall request, ephemeral denial; one primary each"),
 "deal-team-open": (["attio-02"], 9.0, "Claim or accept the suggestion; Sourced by is locked credit"),
 "deal-restricted": (["glean-06"], 9.0, "Codename only, why, who approves, one Request access"),
 "command-k-denied": (["hebbia-03"], 9.1, "Walled hit shows the codename privately; nothing else leaks"),
 "ask-denied": (["hebbia-03"], 9.0, "Ask refuses in place, only to you, with a Request access path"),
 "mandates-gated": (["ramp-02"], 9.1, "Conflicts → engagement letter → KYC, each with owner, state and the fix"),
 "settings": (["rillet-12","rogo-13"], 9.2, "Thesis, stages, pass templates, autonomy, hold, owner rule in one page"),
 "settings-integrations": (["affinity-07"], 9.1, "Health at a glance; one Fix where something is broken"),
 "settings-members": (["rogo-13","affinity-07"], 9.1, "Roles and Chinese-wall groups with an approver per wall"),
 "settings-access": (["harmonic-15"], 9.1, "Every denial logged: who, what, where, why; admin only"),
 "settings-export": (["harmonic-15"], 9.0, "Firm bundle export + BYO model keys, masked after save"),
 "firm-brain": (["attio-02","ramp-02"], 9.2, "Outcomes → priors → thesis proposals you approve or reject"),
 "memo-priors": (["ramp-02"], 9.1, "Our cap vs the firm's past multiples, with the comparable deals named"),
}
PW, PAD, HEAD = 1100, 32, 150
for sid, (refs, score, note) in S.items():
    ours = Image.open(R + sid + ".png").convert("RGB")
    ours = ours.resize((PW, int(ours.height * PW / ours.width)))
    rs = [Image.open(A + r + ".jpg").convert("RGB") for r in refs]
    rw = 700; rs = [r.resize((rw, int(r.height * rw / r.width))) for r in rs]
    rh = sum(r.height for r in rs) + 40 * len(rs)
    H = HEAD + max(ours.height, rh) + PAD
    im = Image.new("RGB", (PAD * 3 + PW + rw, H), "white"); d = ImageDraw.Draw(im)
    d.text((PAD, 28), sid, font=F(40), fill="#09090b")
    d.text((PAD, 82), note, font=F(24), fill="#52525b")
    d.text((PAD * 2 + PW + rw, 34), f"{score:.1f}/10", font=F(44), fill="#9c440f", anchor="ra")
    im.paste(ours, (PAD, HEAD)); d.rectangle((PAD - 1, HEAD - 1, PAD + PW, HEAD + ours.height), outline="#d4d4d8")
    y = HEAD
    for name, r in zip(refs, rs):
        d.text((PAD * 2 + PW, y), "atlas · " + name, font=F(20), fill="#71717a"); y += 30
        im.paste(r, (PAD * 2 + PW, y)); y += r.height + 10
    im.save(O + sid + ".jpg", quality=82)
    print("saved", sid)
