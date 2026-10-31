# Deal Desk: demo film brief

This brief covers why the Deal Desk film exists, the story it tells, what we borrow from our main reference, and a production process anyone can repeat to rebuild it, extend it or make a new cut. It is about intent and method, not one team's tooling.

Short version: **a voiced vision opening that earns the "why", then a wordless, upbeat story of one deal that shows the "how", ending happy.**

---

## 1. Why the film exists

| Question | Answer |
|---|---|
| What is it for? | It makes people *feel* why funding speed matters, then shows how Deal Desk delivers a decision rather than a research tool. |
| Who watches it? | Partners and associates at VC firms, deal teams at banks, judges and investors, and people landing on the site. |
| Where does it live? | The featured section of the landing page, near the top. Cut-downs go to social and event screens. |
| What should a viewer remember? | "Capital moves progress. Deal Desk moves capital faster, with every number cited." |
| What is it *not*? | It is not a feature tour, a UI walkthrough or a tutorial. It is not the hackathon submission video either; that is a separate live-product recording (§11). |

**Tone:** aspirational, then fun. The opening is a documentary. The demo is a short, upbeat story that never intimidates. Someone who has never used a VC tool should still follow it.

---

## 2. Vision and narrative thesis

The opening must make one causal chain explicit. Each link is spoken, so the viewer never has to infer it:

1. **Ideas are cheap.** Every leap needed someone to back a builder.
2. **Capital turned belief into progress**, at every stage: steam, steel, flight, electricity, the computer, the Moon.
3. **Progress is how a civilisation climbs the Kardashev scale**, by harnessing more of the energy around it.
4. **We stand at about 0.7.** We are not yet masters of one planet.
5. **To climb faster, we have to fund the future faster**, starting with the people who fund it.
6. **Deal Desk is our first step.**

Why this matters: an earlier cut jumped from "all of it was funded" straight to the Kardashev scale. Viewers couldn't see why funding led to the scale. Link 3 is the bridge, and the money has to be *visible* on screen (share certificates, ledgers, a trading floor) rather than only implied.

The site line that echoes the film is: *"We make funding the future faster, starting with the people who fund it."*

---

## 3. The reference: a16z, "It's Time To Build"

Reference: https://youtu.be/M9VKnPMs6Rw (about 1:45). We studied it frame by frame with scene-cut detection and a transcript.

### What we measured
| Property | Measured value |
|---|---|
| Duration | 105.6 s |
| Shots | 89 (88 cuts) |
| Mean / median shot | 1.19 s / 0.83 s |
| Shortest / longest shot | 0.17 s / 10.0 s |
| Opening shot | a 6.5 s hold, then a burst of 0.2–0.33 s cuts |
| Narrator words | about 30, in 6 short lines |
| Who carries the middle | real archival soundbites (founders, keynotes, the Apollo liftoff call) |

### What we borrow
- **Rhythm.** Bursts of 0.2–0.5 s cuts on the beat, with long holds of 6–10 s on the big lines. Speed builds excitement and the holds land the meaning.
- **Picture.** Real archival photos and film, all in one look: warm, slightly crushed contrast, grain, a soft vignette, a little gate weave and flicker on old film.
- **Voice.** One calm, low, unhurried documentary narrator. Never a trailer shout. The music carries the energy and the voice carries the weight.
- **Shape.** A quiet open, then more and more archival footage building to a crescendo of launches, bells and trading floors, then a cut to black, then a short last line over near silence, then the wordmark.
- **One real soundbite.** A public-domain line ("We have a liftoff…", Apollo 11) under the launch burst.

### What we don't borrow
- **None of their footage, music or voice.** The reference recording is for style only and never appears in any render.
- **No imitation or clone of their narrator.** We use a stock documentary-style voice.
- **Not their thesis.** Theirs is "technology is our birthright". Ours is "capital turns ideas into progress".
- **Not their sign-off wording.** We avoid echoing "We owe the past and the future".
- **Not their length of archival speech.** We give our narrator more lines, because our causal chain has to be spoken out loud.
- **Not their 4:3 pillarbox.** We stay 16:9 but keep the same grade.

---

## 4. Structure and timings (landing film, about 2:00)

| Part | Time | Audio | Picture |
|---|---|---|---|
| Vision cold open | 0:00–0:49 | narrator + one archival soundbite + a solemn music bed | real archival, graded, with a Kardashev bar |
| Energy switch | about 0:49 | the music changes hard to upbeat (about 124 bpm) | the wordmark blooms into warm product white |
| Story demo | 0:49–1:55 | **no voiceover**: music plus short captions | cropped, stylised product moments on coloured stages |
| Credits | 1:55–1:59 | music tail | CC BY attributions, voice/music credits |

**Rules:**
- Set a hard runtime cap and assert it in code, so a cut can't creep longer.
- Anything added to one act has to come out of the same act.
- Snap key moments (a click, a claim, a vote, a reply) to musical downbeats.

---

## 5. Cold open script (current best)

Read it deep, slow and calm. A pause is part of the read. One-word lines are read slightly slower.

| t (s) | Line | Picture | On screen |
|---|---|---|---|
| 0.8 | Ideas are cheap. | 1870s–1900s inventor labs | — |
| 2.8 | Every leap we have ever made happened the same way. | Edison and Tesla labs | — |
| 7.2 | Someone put capital behind a builder. | slow push on a 1606 VOC share → an 1880s share certificate | archive tag + "FUNDED" stamp |
| 10.6 | Steam. | railway share flash → steam locomotive | leap word + stamp |
| 11.9 | Steel. | steel mill | " |
| 13.0 | Flight. | Wright flyer, 1903 | " |
| 14.0 | Electricity. | telephone-company stock flash → Coney Island lights, 1905 | " |
| 15.3 | The computer. | ENIAC | " |
| 16.5 | The Moon. | Saturn V → archival "We have a liftoff…" | " |
| 21.3 | Capital is the engine that turns belief into progress. | stock exchange floor, the opening bell | — |
| 24.8 | And progress is how a civilisation climbs the Kardashev scale, by harnessing more of the energy around it. | Earth at night from orbit | the Kardashev bar (0 → I / II / III) draws in |
| 32.4 | Today, we stand at zero point seven. | long hold on orbit | the bar fills to 0.70 *as the words land* |
| 36.4 | To climb faster, we have to fund the future faster. | a garage start-up, a keynote, typing, a rocket test, a booster landing | — |
| 41.9 | Starting with the people who fund it. | handshake, a start-up stage | — |
| 44.9 | Deal Desk is our first step. | black → serif wordmark with a sienna rule (title fades in at 44.6, just before the line) | the line as text |

**TTS tips:** spell numbers out ("zero point seven"). If a product name is mis-read, send it phonetically. Generate each line as its own file, then place it from measured line timings so picture always follows voice. Keep each line clear of booms and kick blocks: duck the bed under it and check every line with speech-to-text on the final mix.

---

## 6. Story demo: the journey and its captions

**No voiceover.** The music is upbeat and fun. Captions are short, one idea each, and set in kinetic type. Each moment is a **cropped, zoomed slice** of the real product sitting in a floating rounded frame on a coloured stage. We never show a full screen.

| # | Caption | Moment shown | Agent at work |
|---|---|---|---|
| 1 | Monday. / The inbox never sleeps. | a flood of pitch cards (generic, with no counts) | Intake |
| 2 | One founder stands out. | the pitch card + fit ring | Screener |
| 3 | Deal Desk already read everything. / Every claim, checked live. | the signal graph lighting up its sources (Crustdata company, people and web data) | Researcher |
| 4 | The deck said 40%. The data says 22%. | the claim-vs-verified card | Researcher |
| 5 | A fit score. A memo. Every number cited. | the memo recommendation + source chips | Memo writer |
| 6 | Ask it anything. | the assistant voice orb + a real question from the app | Assistant |
| 7 | IC: three votes, one call. | the IC vote card + three ticks | IC |
| 8 | Not ready yet? It keeps watching. / The firm never forgets. | the Track/watchlist panel → firm memory | Memory, Track |
| 9 | Deal closed. | a signature stroke + an "Invest" stamp | — |
| 10 | Day one: their data is already in place. | portfolio company page, pre-filled from the deal | Portfolio watcher |
| 11 | Back to building. → Deal Desk / Fund the future faster. | confetti → wordmark | — |

**Story rules:**
- Tell it as **one firm's day with one deal**, with agents acting one at a time from start to end. It shows a workflow, not a list of features.
- The **happy ending is required**: the confirmed deal becomes a portfolio company with its data already in place.
- **One focal element per beat.** Push in to 1.7× or more, and fade everything else.
- Agent activity should feel alive: a glowing dot travels to the next step, the running step shimmers, and finished steps settle in with a drawn check.
- **Captions are a story, not marketing.** "Every claim, checked live" is fine. "The #1 AI platform" is not.
- A number shown in a caption must be a real number from the product moment on screen (40% vs 22% comes from the deal shown).

---

## Demo-part style references

The founder picked two Google Workspace launch films as the feel for the story demo: fun, light and easy to follow.

- **A.** "The best of Google AI is now part of Workspace" (Google Workspace, vertical short): https://youtube.com/shorts/f33R-x0n89Y
- **B.** "Introducing Google Vids" (Google Workspace): https://youtu.be/4SCjXcBeW1E

**What we borrow**
- **Bright, airy stages.** White or very pale gradient backgrounds, with product colour carried only by the UI and the icons. On our side that means cream with soft tints and the sienna accent.
- **Oversized UI fragments, not screens.** One control or card fills a third of the frame (B's giant "Play" pill with a hand cursor, its avatar pill). Crop to the one element that matters and scale it 1.7–2.5×.
- **A big, friendly cursor.** About 64–80 px at 1080p, clicking with a quick squash (100% → 88% → 100% over about 200 ms). Use it as the "actor" that moves the story along.
- **Floating icons as a cast.** A shows the tool icons orbiting a centre mark that blooms into the product. We do the same with Gmail, Slack, Calendar and Crustdata marks around the Deal Desk orb, and we never invent our own logos.
- **One idea per beat, cut on the music.** Beats of about 1.5–4 s, a hard cut or a fast push on each downbeat, with no cross-dissolves inside the demo.
- **Short, plain captions.** 2–6 words, bold sans at 84–130 px, words springing in about 100 ms apart, with one highlighted word per line. Upbeat music sits under the captions, and there is no voice.
- **Problem, then product, then the smile.** A relatable mess, then a few quick "it just does it" moments, then a happy payoff and the wordmark.

**What we don't borrow**
- None of their footage, music, icons or brand marks. The references are for feel only and never appear in a render.
- No stock actors or presenter cameos. Our "people" are the founder and the firm, shown through real app moments.
- No invented metrics. Any number on screen comes from the product moment shown.

---

## 7. Visual language and motion

| Element | Cold open | Story demo |
|---|---|---|
| Palette | warm sepia, crushed blacks, one sienna accent | warm white product + soft coloured stages, the same sienna accent |
| Type | serif wordmark, small archive tags | bold sans kinetic captions, at most 2 lines |
| Texture | grain, vignette, flicker and gate weave on old film | clean, with soft shadows on floating frames |
| Motion | slow pushes on stills, hard cuts on beat | spring-eased push-ins, frames glide in, check-path draws |
| Transitions | cuts and cuts to black | one hand-off bloom from the wordmark into product white, then cuts on downbeats |

- **Frame-driven animation only.** Every motion comes from the frame number, never from wall-clock timers, so renders are deterministic.
- Turn off app animations when you crop real components, and change state on purpose by remounting.
- Use real logos for the tools (Gmail, Slack, Calendar, Meet, Crustdata) as nominative "works with" marks only.

---

## 8. Music and voice direction

**Cold open bed.** A low drone and a slow pulse with risers into the launch burst. It drops out on "All of it was funded" or the Kardashev line, so the voice sits in near silence. Then one held note opens up under the last line.

**Energy switch.** A hard cut to an upbeat, fun track (about 120–124 bpm, a key that hands off cleanly) at the wordmark bloom. This contrast is the point: the documentary ends and the story begins.

**Story track.** Light and playful, with a rise through diligence and IC and a warm lift at "Deal closed". There is no voice.

**Voice.**
- A deep, calm male documentary narrator.
- Use a stock voice from a TTS vendor's library, or a hired voice artist.
- Never clone or imitate a real person's voice.
- Check that the vendor plan allows commercial use before publishing.

**Mix.**
- Duck the music about 7 dB under the voice.
- Master to about **-16 LUFS integrated** (web/social).
- Peaks should stay below -1 dBTP.

**Music licensing.** Use one of:
- music you made yourself (no licence question);
- a royalty-free library (Pixabay, YouTube Audio Library, Uppbeat);
- a paid licence (Artlist, Musicbed).

Keep the track's URL, author, licence text and download date next to the file. Avoid tracks that trigger Content ID claims.

---

## 9. Using real apps honestly

Deal Desk's agents work inside the tools a firm already uses:
- the pitch arrives in **Gmail**;
- the claim happens in a **Slack** message;
- the meeting is booked in **Google Calendar / Meet**;
- the research runs on **Crustdata**.

The film should show that, because grasping the workflow at a glance depends on it.

**Honesty rules:**
1. **Label every shot's provenance** in the shot plan as one of:
   - *live recording* of the running product,
   - *rendered product component* (the app's own code, cropped),
   - *recreation* of a third-party UI,
   - *motion graphic*.
2. Prefer live recordings, then rendered components. Use recreations of Gmail, Slack and Meet only when a live capture isn't possible. Never present a recreation as a recording in submissions or claims.
3. **Real in-product text only.** On-screen product text comes from the product. It is never lorem ipsum, and never a number nobody computed.
4. **No fake numbers.** Every figure on screen traces back to the product's own computed output for that deal, with its source. If a number isn't real yet, cut the shot rather than invent one.
5. **Fictional people and firms** are fine in a story, but keep them consistent: one firm name, one founder email domain, and team size, growth and runway that agree across every shot.
6. A feature that isn't built is shown only as a clearly labelled "coming next" card, or not at all.
7. AI-generated imagery may be used for exploration or mood. Check it against the real apps' actual UI before using it, and never use it as a stand-in for real product UI or for real archival history.

---

## 10. Sourcing and licensing archival

- **Allowed:** public domain, CC0, CC BY.
- **Not allowed:** BY-SA, NC, ND, "editorial only", or anything with unknown rights.
- **Where to look:**
  - Wikimedia Commons (read each file's licence metadata);
  - NASA Image and Video Library;
  - Library of Congress;
  - Internet Archive (check each item);
  - public-domain government film;
  - ESO and ESA (often CC BY).
- **Keep a ledger** with one row per asset: file, source page URL, author, licence, clip offset and length, and the date fetched. No asset goes into a render without a row.
- **Attribution.** Every CC BY asset gets a *Title / Author / Licence* credit in the end card and the video description.
- **NASA material** is public domain but must not imply endorsement. Don't show NASA insignia as if it endorses you.
- **Prep the files.** Re-encode clips without audio at 1080p30 or above, and crop burnt-in timecodes and watermarks.
- **Reference recordings** (like the a16z film) stay outside the asset folder and never appear in a render.

---

## 11. Variants

| Variant | Length | Purpose | Contents |
|---|---|---|---|
| **Landing film** | about 2:00 | inspire, then show the workflow | everything above |
| **Live-product submission video** (e.g. a hackathon Loom) | **2:00 or less** | prove the product works end to end | a one-sentence intro; a **request the product has never seen** typed live (e.g. "ten Indian B2B software companies founded since 2023 whose team grew by half"); the real app working through it; **source chips visible** and opened; **one deliberate failure case** handled honestly (an unknown company, a rate limit, a missing field shown as "unavailable"); ends in a cited decision or memo. No cold open, no recreations, no scripted fixtures. |
| **30 s teaser** | 0:30 | social, event loops | a compressed cold open (Ideas are cheap → funded leaps → 0.7 → "Deal Desk is our first step") + 3 quick story beats + the wordmark |
| **Social crops** | per platform | feeds | 1:1 and 9:16, re-framed by camera moves, not by stretching |
| **Event master** | same as the landing film | big screens | 4K, high-bitrate, with a stereo mix |

Before submitting a live-product video, open its link in a private window to make sure it plays for anyone.

---

## 12. Production process (repeatable)

1. **Brief.** Write the purpose, audience, thesis chain, runtime cap and "what it is not". Get sign-off before any pixels are made.
2. **References.** Pick one primary reference and *measure* it:
   - run scene-cut detection to get shot count and mean and median shot length;
   - transcribe it to get the narrator's word count and the share of archival soundbites;
   - note the grade and the shape.
   Write down what you borrow and what you won't.
3. **Script.**
   - Write the cold-open lines so the causal chain is spoken.
   - Write the story as a beat list with one caption per beat.
   - Write 2–3 options, read them aloud and time them at about 2 words a second plus pauses.
4. **Shot plan.** Make one table row per beat: time, line or caption, picture, provenance label (§9), and the agent shown. Fix the runtime budget per part.
5. **Asset sourcing.**
   - Archival goes into the licence ledger (§10).
   - Product moments are captured live or rendered from the app's own components at the current release. Record the source version.
   - Music and voice files are logged with their licences.
6. **Build in code-based video.**
   - Use a framework such as Remotion (React) so the film is versioned, reviewable and re-renderable.
   - Keep a single timing file; change numbers there only.
   - Animation is frame-driven only.
   - Place the voice from its measured line timings.
   - Assert the runtime cap.
7. **Audio.**
   - Generate the voice one line per file.
   - Pre-mix the voice, the soundbite and the music with ducking.
   - Loudness-normalise to about -16 LUFS.
8. **Render.**
   - Draft at 720p.
   - Make the final at 1080p30 (h264 + aac) for web, and a high-quality master for events.
   - Render in chunks if the machine is constrained.
9. **QC** (every render):
   - **Frames.** A 12–20 frame contact sheet at the key beats. Check for empty masks, clipped text, wrong names, watermarks, timecodes and white gaps.
   - **Media probe.** Confirm the codecs, the exact duration (matching the cap) and an audio stream for the whole runtime.
   - **Loudness.** Measure integrated LUFS and true peak.
   - **Transcription check.** Run speech-to-text on the render and diff it against the script. This catches mis-read names and dropped lines.
   - **Consistency grep.** Search the source for stale names, old domains and placeholder strings.
   - **Licence check.** Every asset in the render has a ledger row, and every CC BY asset appears in the credits.
   - **Truth check.** Every on-screen number traces to the product's output (§9).
10. **Feedback rounds.**
    - Share the cut with chapter timestamps, and state openly which shots are recreations and which voice or music is temporary.
    - Collect notes per beat, then update the brief first and the script and shot plan second, and re-render.
    - Newer direction overrides older notes. Keep a dated decision log so the reason for each change survives.

---

## 13. Definition of done

- [ ] The cold open speaks the full causal chain: capital → progress → Kardashev → 0.7 → fund faster → "Deal Desk is our first step".
- [ ] The Kardashev bar lands on 0.70 at the moment "zero point seven" is spoken.
- [ ] The demo part has **no voiceover**, upbeat music, a clear energy switch, and short story captions.
- [ ] The journey runs inbox → standout founder → live research (signal graph) → fit score + cited memo → assistant → IC → track/memory → close → portfolio onboarded, and it ends happy.
- [ ] Every product moment is cropped and focused. No full-screen walkthroughs.
- [ ] Every shot has a provenance label, and nothing recreated is presented as live.
- [ ] Every on-screen number is real and traceable. No placeholder text.
- [ ] Names, emails and metrics are consistent across shots.
- [ ] Every archival asset is PD, CC0 or CC BY with a ledger row, and the CC BY credits are on the end card.
- [ ] The voice and music are cleared for commercial use, with no imitation of a real person's voice.
- [ ] The audio is about -16 LUFS integrated with true peak at or below -1 dBTP, and the audio stream covers the full runtime.
- [ ] The transcription matches the script, and the runtime is at or under the cap.
- [ ] The final 1080p file is embedded on the landing page, and the live-product submission video (if needed) is recorded separately and plays in a private window.
