# build_os: An Agentic Operating System for Private-Market Investors

> *A Chief of Staff for every fund that works around the clock, never forgets, shows its sources, and gets smarter with every deal.*

---

## 1. The Challenge (Hackathon Brief)

**Goal:** Build autonomous AI agents that turn professional services into fully automated software, running on agent-native data infrastructure. Today these services are handled by teams of human professionals across hiring, investing, research, and compliance. The brief rewards root-cause understanding of complex domain workflows, precise agentic execution, and reliable verification. Simple prompt wrappers don't score.

**Challenge question:** How effectively can you design, build, and deploy autonomous AI agents that take a real-world professional service workflow, one traditionally handled by entire firms, and execute it end-to-end with high precision, verifiable reasoning, and zero human intervention under strict time constraints?

**Themes:**
- **Hiring:** Recruiters and staffing agencies paid on outcomes. They find candidates who fit and verify their career history.
- **Investing:** Venture funds and banks analysing startups, parsing data rooms, and pricing deals from historical data points. ← *our track*
- **Research and markets:** Extracting answers from thousands of pages with verified source citations, and forecasting market metrics.
- **Insurance:** Underwriting businesses, auditing policy coverage, and processing claim damages from unstructured evidence.
- **Trust and compliance:** Telling genuine businesses from shell companies, setting credit limits, and running fraud analysis.
- **Buying and paying:** Automated procurement, turning purchase requests into orders, and robust invoice processing.
- **Agents that spend:** Managing budgets, buying datasets or compute, and running authorised transactions on their own.
- **Supply chain:** Managing shipments across borders, tracking inventory and bills of materials, and handling legacy web portals.
- **Revenue:** Inbound lead routing, automated outbound outreach, and predictive forecasting.
- **Infrastructure for agents:** Building missing developer building blocks such as long-term memory, rule checkers, CRM bindings, or cryptographic execution trails.

**Requirements and stack:**
- **Data:** The solution must integrate and build on Crustdata's canonical identity graph for people and company data.
- **Modes of interaction:** It can be a single agent, a system of agents, an MCP server, or a CLI.
- **API:** `https://api.crustdata.com`. Endpoints: Person Search, Person Enrich, Company Search, Company Identify, Company Enrich, Job Search, Web Search and Fetch, and Watcher.
- **Headers:** `authorization: Bearer YOUR_API_KEY` and `x-api-version: 2025-11-01`
- **Agent integration:** MCP servers are supported for agentic pipelines.

**Judging criteria:**
- **End-to-end execution:** Does the agent take a request all the way to finished work without human intervention?
- **Data integrity and verification:** How well does the solution use Crustdata's canonical graph and keep a verifiable citation for every claim?
- **Robustness and edge cases:** How well does the agent handle messy real-world data, unformatted inputs, and unexpected tool responses?

---

## 2. Vision and Intent

This is a startup product we will launch soon, not just a hackathon entry. Investing has the biggest prize, so we are going after the bigger vision: **an autonomous investment firm in software**, not "an analyst agent". The aim is a complete OS for investing that lets a small fund run like a big one.

**What we're building:** an agentic operating system for private-market investors. It runs the whole life of an investment (**source → diligence → decide → own → exit → learn**), does the repetitive work itself, and learns how the firm decides. It's an OS that **actually does the work**, not one that just answers questions.

### First principles
A VC fund or bank is a machine that turns **information, relationships, and judgement** into capital decisions, then services those decisions for years. Every person there spends their day on five kinds of work:

1. **Gathering:** finding companies, reading decks, pulling data, listening to calls, tracking news.
2. **Processing:** cleaning data, building models and comps, filling templates, reconciling numbers, updating the CRM.
3. **Communicating:** emails, intros, follow-ups, scheduling, founder updates, LP letters, IC decks, client pitch books.
4. **Remembering:** who said what, why a deal was passed on, which founder came back, what the partner's thesis is.
5. **Judging:** is this a good bet, what's the price, what are the risks, who do I trust.

Only the fifth is what they're paid for, and most estimates say it takes a small fraction of the week. **The OS should take over the first four completely and make the fifth sharper.** The honest scope is a firm's whole operating layer, with humans doing only judgement and relationships.

### Scope: investing *and* portfolio management
For a fund, portfolio management isn't separate from investing. It's the second half of the same loop:
1. **It's where most of the time goes.** VCs spend about 18 hours a week with portfolio companies, more than on sourcing (NBER). Board prep, KPI tracking, chasing monthly updates, LP reporting, and follow-on decisions are all repetitive work.
2. **It closes the learning loop.** Without portfolio data, the OS sees decisions but never outcomes.
3. **It's sticky and recurring.** Deal flow is spiky, but portfolio monitoring runs every day for 5 to 10 years and is very hard to rip out.

**Where we draw the line:** portfolio intelligence for **private-market investors** (VC, PE, family offices). That covers monitoring, KPIs, risk alerts, board prep, follow-ons, and LP reporting. **We exclude public-market portfolio management** (trading, rebalancing), at least early on. That's a different buyer and data stack, and it would put us up against Bloomberg and BlackRock's Aladdin.

### Inspiration: two theses that shape the vision
**1. "Own your intelligence"** (a VC's request-for-startups video; firm not yet checked). Open-weight models are now competitive with frontier models. Companies, especially in regulated industries, will want to own models trained on their own data and run them where they choose. Someone has to turn workflows into evals, expertise into training data, and production failures into improvements, and then carry all of that forward to each new base model.
→ *For us:* the moat isn't the model. It's the **loop that makes a firm's own model smarter over time**. This is also partly why JPMorgan and Bridgewater build in-house: they won't send deal data to someone else's servers.

**2. "Make the company queryable"** (YC-style video). The best AI-native companies record every meeting, ticket, and interaction so an AI layer can learn from it. That turns an **open loop** (decide, then maybe check weeks later) into a **closed loop** (monitor, compare to plan, adjust). Building this today takes brutal integration work, and no product connects all that context into one AI layer that can reason across it. "Not another dashboard."
→ *For us:* **"make the fund queryable" is the foundation, and the closed loop is the product.** Funds are a narrower, easier version of the problem: a handful of tools (Gmail/Outlook, calendar, call recorder, Affinity/DealCloud, Drive, Slack/WhatsApp, data rooms) and one domain model of companies, people, deals, and decisions.

Investing is an extremely open loop today. A fund makes a decision and sees the result 5 to 10 years later. It almost never asks "were we right to pass?" or "which signals actually predicted winners?"

---

## 3. Problems and Market Evidence

### 3.1 The real pain is trust and toil, not intelligence
- **Checking the AI's work just moves the work somewhere else.** This is the loudest theme across Reddit, Wall Street Oasis, X, and HN. Ex-Goldman partner Mike Ryan [put it this way](https://x.com/mikeryanbpn/status/2092741494981464270): *"AI can produce an investment memo in minutes. But now you can spend the next 2 hours checking it… That's not automation. That's moving the work."*
- PE users say the *"risk tolerance for these kinds of errors is effectively 0."* They report that Hebbia, Rogo, and Claude start making things up once a data room passes about 10 documents. Rogo gets called *"a glorified google."* On Hebbia: *"for simple things like pulling comps it will give wrong numbers... way below an intern level."* A big-fund associate: *"don't see anything that's actually working… I want to go home earlier."*
- On FinanceBench, GPT-4 with document search failed **81%** of questions. Legal AI makes things up **17–33%** of the time.
- *"Bad extraction is invisible downstream. It doesn't look like an error, it looks like a shorter list."* And: *"100 vs 1000 docs isn't 10x more relationships, it's 100x."*

### 3.2 Time sinks
- VCs work about **55-hour weeks**, mostly on sourcing, networking, and portfolio support ([NBER study of 885 VCs](https://www.nber.org/system/files/working_papers/w22587/w22587.pdf)).
- Small vendor surveys say **20–40%** of partner and associate time goes to logging calls and updating the CRM, and **43%** of deal-flow time goes to data entry.
- Banking analysts still average about **78 hours a week**, and AI hasn't reduced that. Pitch books take **40–60 hours**, mostly formatting and pulling data.

### 3.3 Competitive landscape: "cited answers" is no longer an edge
- In the last eight weeks: [OpenAI launched ChatGPT for Financial Services](https://openai.com/index/introducing-chatgpt-financial-services/) with built-in PitchBook and Crunchbase data and cited answers. [AlphaSense launched SuperAnalyst](https://www.alpha-sense.com/press/alphasense-launches-next-generation-ai-agent-superanalyst/), an always-on agent that ties every number to its source. Datasite partnered with Hebbia so Hebbia can analyse live data rooms. **If we're "an AI analyst with sources," we're competing with OpenAI.**
- **Portfolio tools.** [Standard Metrics](https://standardmetrics.io/) collects data three ways: a founder portal, accounting sync, or documents it parses. A human data team double-checks the numbers. On top sit benchmarks, LP reports, an AI analyst, Slack, and an MCP server. *Its blind spot:* it only knows what founders submit. It has no email, calls, CRM, or outside signals, and it doesn't act. Visible, Cobalt, iLevel, Carta, Allvue, Chronograph, and Vestberry all now ship extraction with source links and MCP. **That's table stakes.**
- **[Cura](https://cura.inc/)** is the most interesting newcomer. It reads the fund's Gmail and meeting notes, asks founders only for what's missing, and watches LinkedIn, X, and news between updates. One VC logs into it more than into Standard Metrics, which validates "start from the fund's inbox."
- **Sourcing:** Harmonic and Specter already crowd this space.
- **The gap nobody fills:** joining relationship data (Affinity), KPI and fund data (Standard Metrics, Carta), and outside signals (Crustdata) into one record, then **acting** on it and tracking outcomes.

### 3.4 Four gaps nobody has filled (all play to Crustdata's strengths)
1. **Checking claims, not summarising them.** *"The whole idea of due diligence is to verify the claims"* (r/venturecapital). Today's tools cite the deck back to you, but none check it against the outside world. Founder says 40 engineers: does the hiring data agree? Muhammad Lila [lists](https://x.com/MuhammadLila/status/2110457231162630649) the classic tricks: run rate passed off as ARR, leads counted as customers, GTV claimed as ARR.
2. **Contradictions and gaps across the whole data room.** Document A conflicts with document B, or something is missing. Every current tool reads files one at a time.
3. **Data with a date on it.** PitchBook gives headcount with no date. One tool [called a company seed-stage](https://x.com/austindanielw/status/2076919510612021358) after it had raised a Series B.
4. **Accuracy you can measure.** From Titan Capital's job post: *"An agent that is correct eighty percent of the time on deal data remains a liability until its accuracy can be measured and bounded."* Khosla is hiring for *"evaluation systems that tell us whether AI-generated research… is actually correct."*

### 3.5 Hiring signals: big firms are building this in-house
- **JPMorgan** ([job description](https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210794094/)) is hiring people to build an investing OS's plumbing: context management, retrieval over investment data, *"orchestration for state management and human oversight"*, evaluation for *"groundedness"*, and MCP to connect AI to firm data and tools. Three sibling asset-management roles add autonomous agents, AI-ready "certified metrics", and entity resolution. JPM also has internal tools for drafting research notes, alerting PMs, and a 30-second banking deck, but its own framing is *"co-pilot, not boss."*
- **Khosla Ventures:** the [Chief of Staff job description](https://jobs.ashbyhq.com/khoslaventures/e08a616d-a7ab-49ba-bba5-63b606be95a4) reads like our feature list. It covers evaluating deals and running diligence, writing investment recommendations and meeting briefs, tracking portfolio performance and board materials, preparing for meetings, and *"ensure follow-through"*, all from 8am to 8pm with round-the-clock availability. Khosla is also hiring engineers to build [*"AI that is always on, reacting to events, alerting the right people, and taking actions autonomously"*](https://jobs.ashbyhq.com/khoslaventures/50477e3a-a415-4c6a-b652-164634d7f43d), a *"durable institutional knowledge base"*, and research-correctness evals. Many replies to Vinod's post said: *"get an AI to be your Chief of Staff."*
- **Also building in-house:** Bain, CRV, Salesforce Ventures, Unusual, Titan, GIC, Millennium, Bridgewater, and a16z, using RAG, MCP, and their own evals.
- **What it means:** they're all building the same five layers: firm memory, always-on monitoring, document drafting, accuracy checks, and approval gates. That **validates the architecture**. It also means nobody can buy what they need yet, and early customers may want building blocks. Big firms won't buy a platform early. **Mid-size VCs, family offices, PE deal teams, and boutique banks will**, because they have partner-built prototypes and maybe one engineer.

### 3.6 Insider details (domain deep dives)

**Pricing: what a deal's "price" really is**
- **Price ≠ value.** Damodaran: venture *"is a pricing, not a value, game."* Partners start from ownership: a 15–20% target and a $2M check means a $10–13M post-money. Then competition moves the number. Only **22%** of VCs use DCF, about half admit to gut decisions, and only **1 in 10** ever looks back at past decisions quantitatively ([NBER](https://www.nber.org/system/files/working_papers/w22587/w22587.pdf)).
- **Headline valuations mislead.** Across 135 unicorns, reported valuations averaged **48% above fair value** once preferences and guarantees were counted. Square's Series E was reported at $6B against a fair value of about $2.2B ([JFE](https://www.sciencedirect.com/science/article/abs/pii/S0304405X19301692)). Gurley: *"Terms are the true Godzilla… A down round is nothing."* FanDuel sold for $465M with $559M of investor preferences, so the founders got nothing.
- **AI rounds now sell at two prices.** A round is announced at $1B while most of the money goes in at $450M. *"Only airlines can get away with this."* Any comps database storing the $1B is wrong.
- **Spreading comps** means pulling filings, computing the last twelve months, removing one-off charges, and aligning fiscal years. That's about 30 minutes per company: *"Now imagine you have to do 15 of them. For tomorrow morning. And it's 9pm."* Even with CapIQ, *"the time consuming task is checking that the templates have pulled numbers correctly"*. Some say *"Cap IQ is crap, hand spread it from the filings."*
- **Private comps barely exist.** For private targets, *"most of the time prices aren't even released"*. In healthcare, *"almost all of our comps are proprietary"*, traded between senior bankers as favours. PitchBook's estimated valuations land within 15% of true value only about **40%** of the time. One founder said Crunchbase overstated their funding by over 200%.
- **Quarterly marks are a mess.** a16z showed one company that could be marked at 38x, 20x, or 16x, all acceptable under accounting rules. Different funds held the same company at $600M and $1.3B. One LP: *"I can't spend unrealized gains."*
- **War story:** in the Rural/Metro sale, RBC quietly lowered the EBITDA figure and the comparable multiples so a lowball bid looked fair. The court held it liable for **$75.8M** ([Delaware ruling](https://courts.delaware.gov/opinions/download.aspx?ID=202340)). Pricing errors end up in court.

**The deal funnel and how deals get decided**
- **Per closed deal:** about 100 companies looked at, 25 management meetings, 8 partner meetings, and 4 full diligences. Each deal takes **83 days**, **118 hours** of diligence, and about 10 reference calls. Only **10%** of deals come from cold inbound ([NBER](https://www.nber.org/system/files/working_papers/w22587/w22587.pdf)).
- A growth associate juggles 40–50 live opportunities. Investors spend **3 min 44 s** on a deck. On hot deals the decision is often made 20 minutes into the first meeting (Lemkin). Pre-term-sheet diligence is *"2 or 3 customer calls"*, and the real checks happen after signing.
- **Deals die on references, and none of it is written down.** *"Probably 90% of the deals I spend a lot of time on die at the references stage"* ([X](https://x.com/i/status/1864384760237445631)). Backchannels happen *before* the first meeting and are *"rarely scheduled in advance, rarely documented."* One VC's war story: from the founder's *own* reference list, the first said *"He should be in jail,"* and the second asked *"Where is he, so I can kill him?!"* Doug Leone asks founders who their *worst* reference would be. Sequoia adjusts customer NPS by nationality. The standard rule is **20 reference calls, 10 off-list**.
- **IC runs on politics, not process.** About **90%** of seed firms use a "champion" rule, which catches 10x outliers **3.7x** more often than requiring everyone to agree ([HBS](https://www.hbs.edu/ris/download.aspx?name=21-131.pdf)). Index bans scores of 5 or 6. Connect Ventures bans partners from discussing a deal for 24 hours after meeting the founder. Sequoia treats a room of unanimous 7s and 8s as *dangerous* and writes a pre-mortem. At Benchmark: *"Nobody knows"* whether one partner can veto. Pre-wiring takes *"about a full day"* a week. A "soft pass" is an associate killing a deal before partners see it, sometimes because *"you just don't have the time."*
- **Our market, in Jack Altman's (Benchmark) words:** *"If we invested in 100 or 200 companies a year, you'd want a CRM and a formal voting process."* That means high-volume firms.
- **Memos and institutional memory barely exist.** Addepar and Stanford surveyed 54 firms. Memos take about **2 months**, are *"arduous and friction-filled"*, and get stored as folders of PowerPoints. Most firms never review memos afterwards or track the deals they passed on. There are **zero peer-reviewed papers on investment memos**. Firms want fields filled in automatically and assumptions tracked over time. Reference memos: Bessemer's Shopify memo (*"Shopify employs one paid search marketer and has no VP of Marketing"*) and Sequoia's YouTube memo (a court exhibit).
- **Banks and PE:** decks reach "v259". CIM writers admit *"we will apply the lipstick as needed"*. PE associates *"discount management projections by at least 10%"* as a reflex. They get *"a flood of CIMs every week"*, spend about an hour on each, and copy-paste between equity, credit, and deal memos. Venture lenders underwrite the *VC behind the company*: its reserves and *"how the VC ranks the company within its own portfolio."* JPMorgan paid **$175M** for Frank, which claimed 4.25M users when about 300K were real. The outside validator only checked that the data fields were filled in.

**Data rooms**
- A $100–500M deal room holds about **6,600 files**, around 300 Q&A questions, and 100+ users. The partner wants proof that every file was reviewed, yet *"there are only ever like 10 useful files,"* and the right ones get uploaded *"2 days before the bid deadline"* (WSO).
- Files appear in the order *"junior bankers and management can prepare first"*. You get "the same 10 versions of board deck", view-only PDFs of models, scans, and Excel files with formulas stripped. *"103 PDF files in the data room that we need in our model by Friday's meeting."*
- The pros' habit: *"When the data room opens, don't read, index."* They build a mirror index ("Doc ID 032, clause 12.3"), date-stamp every pull, and hand the partner a "VDR pack". Some partners still want it printed as a binder.
- **Sell side:** analysts do *"mind-numbing redactions"* and fear giving competitors too much access. In one real case, a folder named after one bidder was opened to all bidders. TransPerfect sued Credit Suisse for up to about $300M over a data-room leak.
- **The worst job is the revenue "cube":** rebuilding revenue by month, customer, and product. It's *"a revenue colonoscopy,"* and *"most of the effort will land on one analyst."* Even *"What's the definition of a customer?"* is debated, and the CRM and general ledger *"will not agree."* A $200K ARR error at 5x is **$1M** of purchase price ([Looking for Leverage](https://www.lookingforleverage.com/p/what-building-the-cube-during-m-a-diligence-entails)).
- **Tie-out kills deals.** The CIM, model, financials, quality-of-earnings report, and Q&A answers must all match: *"Investors don't kill deals because the product is bad. They kill them because the numbers don't match."* *"CIM is full of marketing. QoE is full of truth."* QoE work typically cuts seller EBITDA by **8–18%**.
- **What blows up later:** change-of-control clauses found too late (*"'standard' is a word people use for contracts they have not read"*). In one case, three customers making up 60% of revenue could walk at will. That was found on day 45, and the price dropped about 20%. About **3 in 10** private deals see an indemnity claim, and earnouts pay out about **21¢ on the dollar** ([SRS Acquiom](https://www.srsacquiom.com/our-insights/ma-earnouts-claims-study/)). In the UK, the whole data room can count as disclosed. HP's diligence on Autonomy ($11B) was about six hours of calls, followed by an **$8.8B** writedown.

**The pattern across all three deep dives:** the pain isn't reading. It's **completeness, tie-out, and memory**. Juniors spend their nights proving nothing was missed, making numbers agree across documents, and rebuilding work nobody saved. Current AI fails exactly there, because it skips things silently.

---

## 4. The Product

### 4.1 Positioning
> *"Other tools give you answers with citations. We tell you which claims are true, what's missing, and what changed this week."*

The line between us and OpenAI or AlphaSense: **they answer questions; we finish the job and hand back finished work.** Our promise: *every document was read, here's what didn't tie out and where, and every number traces back to its page*, plus an outside check from Crustdata.

### 4.2 Architecture: four layers
1. **Capture: the queryable firm.** Connects email, calendar, call recordings, the CRM, Drive, WhatsApp and Slack, data rooms, past memos, IC discussions, pass reasons, and board decks, and joins them all to Crustdata's live graph. The result is one living memory of every company, person, conversation, and decision, with a date on everything. It also holds long-term memory of each fund's thesis, past decisions, and why it passed. Without this, every agent starts from zero, which is why today's tools feel generic.
2. **Act: agents that finish the work.** Agents have **real write access ("hands")**. They send emails (as drafts or auto-approved), book meetings, update the CRM, build Excel models and PowerPoint decks in the firm's own templates, fill data-room trackers, post in Slack, and file LP reports. Doing the work means producing the artifact, not describing it. Agents run on **always-on triggers, not chat**: a new deck in the inbox, a meeting in an hour, a portfolio company changing, quarter end. Most of the value is work nobody asked for, delivered before anyone thought of it.
3. **Verify: the trust layer (the kernel).** Every claim is marked **confirmed / contradicted / unverifiable**, with its source page *and* independent outside evidence from Crustdata. The **claim ledger** traces every statement to a Crustdata record or a fetched page, with a timestamp. Every output carries a measured accuracy score, and every action leaves an audit trail. Risky actions wait for approval and safe ones run on their own, with the approval threshold learned per person.
4. **Learn: the closed loop plus an owned model.**
   - Tracks every company the fund **passed on** and flags when one raises or takes off.
   - Compares each portfolio company's plan against live hiring and headcount, and alerts the right partner when they drift.
   - Finds which sourcing channels, theses, and partner instincts actually produce winners, and adjusts screening to match.
   - Checks whether the fund is acting on its stated thesis or drifting from it.
   - Surfaces patterns the firm can't see today: which sources produce its best deals, which founders it keeps passing on who later succeed, which portfolio companies show early warning signs, and which relationships are going cold.
   - Learns each partner's writing style, priorities, and "hard no" list, plus the firm's memo format and pipeline stages, so output looks like the firm's best analyst made it.
   - Turns every approval, edit, rejection, and *"partner rewrote this paragraph"* into training data and evals. Over time, each firm gets **its own fine-tuned model** that writes memos like its partners and screens deals like its thesis.

**The full stack in one breath:** *Capture* (make the fund queryable) → *Act* (agents do the repetitive work) → *Close the loop* (compare outcomes to decisions and adjust) → *Compound* (the firm's own model learns from all of it). Each layer makes the next more valuable.

**Extensibility ("app store"):** funds add their own rules (*"never invest in solo founders"*), scoring models, or data sources. Later, LPs, angels, and founders get their own views of the same OS.

**Under the hood:** one shared memory and truth layer (fund data plus Crustdata); **many small specialised agents rather than one giant one** (Hebbia learned this the hard way); an approval and audit layer; and an eval system. All of that complexity stays invisible to the user.

### 4.3 The agents
1. **Sourcing.** Runs the fund's thesis as live watchers, e.g. *"seed-stage climate startups where an ex-Stripe engineer joined in the last 90 days"* or *"headcount up 40% while still unfunded."* It surfaces companies before they raise, which is the alpha VCs pay for. When a signal fires, it builds the company profile, maps a warm-intro path through the partners' networks, and drafts outreach for one-click approval.
2. **Diligence.** Parses the deck or data room and checks every claim against the graph. Do founder histories match? Is the claimed team size real? Are the named customers hiring and growing? It reads **all** files, including Excel, rebuilds key numbers, flags contradictions and gaps across documents, and produces the diligence tracker and the questions for the founder call.
3. **References and backchannels.** This is the biggest repetitive pain and where Crustdata is strongest. Today it's 8–20 calls per deal, people found by hand, and nothing written down. The agent maps everyone who worked with the founder from the work-history graph (former co-founders, managers, people who left), picks the people the founder *didn't* list, prepares the questions, drafts outreach for approval, and logs every call so the firm remembers it.
4. **Pricing.** Values the deal against comparable historical rounds, adjusting for stage, sector, team strength, and growth signals. It returns **a range with its reasoning**, not a single magic number.
5. **Memo and IC.** Writes the memo with inline citations, filling fields in automatically. It builds the IC deck in the firm's template and runs the comps. A separate **red-team agent** argues the bear case, so the reasoning is verifiable rather than just persuasive.
6. **Portfolio monitor.** Watchers flag key departures, hiring freezes, and competitor raises. The OS updates the monitoring sheet, alerts the right partner, suggests a next step, and the memo updates itself.

### 4.4 What "does the work" looks like
- **An inbound deck arrives.** The OS opens it, pulls every claim, checks each one against Crustdata and the web, emails the founder data-room requests for what's missing, scores the deal against the thesis, and drops a first-pass memo in the CRM before the partner opens their inbox.
- **A data room opens.** It reads everything, rebuilds key numbers, flags contradictions, and produces the diligence tracker and founder-call questions.
- **Sourcing.** A signal fires, and the OS builds a profile, a warm-intro path, and drafted outreach.
- **Portfolio.** An exec leaves or hiring freezes, so the OS updates the monitoring sheet, alerts the partner, and suggests a next step.
- **IC prep.** The OS builds the deck in the firm's template, writes the bear case, and runs comps.

**Full coverage of a real week:**
- **VC:** inbound triage, sourcing alerts, call-prep briefs, call notes going straight to the CRM, founder follow-ups and pass emails, first-pass and full memos, IC decks, reference checks, portfolio monitoring, KPI tracking, board prep, follow-ons, LP updates, fundraising data-room prep, and help for portfolio companies with hiring and intros.
- **Banking (later):** pitch books, comps and precedent transactions, buyer lists, CIM drafting, data-room Q&A management, process trackers, model updates, client meeting prep, and market updates.

**Design principle:** the OS does everything. The human only approves steps that are expensive to get wrong, like sending outreach, changing a valuation, or moving money. Each approval carries its evidence, so it takes seconds instead of two hours.

### 4.5 How Crustdata gives us leverage
The fund's inbox tells us what founders *say*. Crustdata tells us what's *actually happening*.

1. **Backbone: one ID for every company and person.** Company Identify and Person Enrich resolve messy names ("Acme", "acme.ai", "Acme Labs Pvt Ltd") to one canonical record. That's what makes the fund queryable at all, and it's the hardest part to build yourself.
2. **Sourcing.** Watchers plus Person and Company Search turn a thesis into live alerts: senior engineers leaving top companies, unfunded companies with fast headcount growth, founders who match the fund's past winners. Each alert comes with a profile and a warm-intro path from the fund's email graph.
3. **Diligence (claim checking).** Headcount and hiring velocity come from Company Enrich and Job Search, founder histories from Person Enrich, customer-logo existence and growth from the graph, and product claims from Web Search and Fetch. The output is confirmed / contradicted / unverifiable with a dated source. This is our strongest differentiator against "cited answers".
4. **References.** Person Search finds ex-colleagues and former reports, ranked by overlap.
5. **Pricing and comps.** Company Search finds peers by sector, stage, and team size, with growth signals. This is a supporting signal, not a replacement for round data. We can show **the company as it actually was on the day it was priced**, which enables:
   - comps like *"companies with this headcount and hiring pace when they raised their A"*
   - an outside-in revenue check: headcount × about $100–130K revenue per employee flags "$100M ARR" claims built from one month × 12
   - stale-mark alerts (hiring frozen or execs gone since the last round)
   - a record of the fund's own pricing calls against later outcomes
6. **Portfolio intelligence (the big one).** Watchers catch exec departures, hiring freezes, headcount drops, new senior hires, competitors raising or scaling, and job posts that signal a pivot. These are live early warnings between quarterly updates, which Standard Metrics and Visible can't see.
7. **Helping portfolio companies.** Person and Job Search power candidate shortlists, customer intros, and target-account lists.
8. **Closing the loop.** Watchers on every *passed* company track who grew, raised, or died.
9. **Freshness as a feature.** Every datapoint carries an "as of" date and change history: *"headcount 42 as of Oct 28, up from 30 in July"*. This directly answers the stale, undated PitchBook complaint.
10. **For the hackathon:** claim checking plus portfolio watchers exercises nearly every endpoint, with a citation on every claim.

> **Funds can't build an outside-truth layer themselves, and that's what turns us from "AI that summarises your inbox" into "AI that tells you what's really true and what changed."**

---

## 5. User Experience and Design Principles

Success depends on two things: **how well we understand users' workflows and pain points**, and **how good and easy the product is to use and fit into existing work.** A partner has no time, doesn't trust new tools, and already lives in email, calendar, WhatsApp, and Slack.

### 5.1 The core rule: user-first, zero cognitive load
If the partner has to watch the agent, we've given them a new job. Nobody will monitor it. The bar is a **world-class human Chief of Staff**: someone you hand things to and forget about, who only comes to you with what needs *you*, already prepared.

**Every feature must pass one test: does this remove something from the partner's head, or add something to it?** If it adds, it lives behind the scenes or it doesn't ship.

1. **The user never manages the agent; they just get outcomes.** No dashboard, no queue to clear, no settings. The CRM is simply up to date. The follow-up is already in drafts. The call brief is in the calendar invite. The LP letter is ready at quarter close.
2. **Interrupt rarely, and only when it matters.** Silence is the default. Speak up only for what a great Chief of Staff would raise: a founder about to run out of cash, a key exec leaving, a hot deal going cold, a promise about to be missed. One line, in the channel they already use, with the action ready (*"Reply yes to send the check-in"*).
3. **Approval feels like replying, not reviewing.** "Yes", "no", or "make it shorter", in WhatsApp or email. The evidence exists one tap away but is never pushed at them.
4. **Trust comes from being right, not from showing the work.** Accuracy scores, run logs, and "what I skipped" lists exist for *us* and for the fund's ops person or auditor, never as homework for the partner.
5. **It learns by watching, not by asking.** No feedback forms or ratings. Edits, ignored alerts, and rewritten openings all teach it silently. Every expert correction becomes a regression test, so the same mistake never repeats (Sierra).
6. **It speaks their language, not ours.** *"Acme's runway is under 6 months, want me to set up a call with the founder?"*, not *"Agent 3 flagged a burn anomaly with 87% confidence."*

### 5.2 Adoption and setup
- **Setup in under 10 minutes, value the same day.** Sign in with Google or Microsoft, connect the CRM, and you're done. It backfills overnight, and the next morning the partner gets a brief on their own deals. No implementation project, no data cleanup. (Cura; Affinity Ascend.)
- **No new app to open.** It works through email, Slack/Teams, WhatsApp, Outlook, and Excel. Forward a deck and get a memo back. (Billy by GPGPT: *"power users never open it, they email a deck"*; Hebbia went "headless"; Zarna runs natively in Outlook.)
- **Change it in plain English, with no config screens.** *"Never show me solo-founder fintech deals"* or *"Write memos like this one"* becomes a saved, versioned, reversible firm rule or skill. (Legora Skills; Decagon.)
- **Autonomy is earned.** Each action type moves along *suggest → draft → do and tell me → do silently*. Everything starts at "draft", and the OS proposes raising the level after, say, 20 approvals in a row. This happens quietly, not as a settings screen. (Sixfold; Basis.)
- **Plays well with existing tools.** It reads from and writes back to Affinity, DealCloud, Attio, Notion, Standard Metrics, and Carta with approval, so nobody migrates. MCP and a CLI let a fund's own engineer or AI extend it. That answers the "I'll build it myself on Claude Code" crowd: build *on* us instead. (Bridgewater: *"Agents love CLIs"*; Draper Brain.)
- **Templates, not blank slates.** Ready workflows for seed VCs, growth funds, family offices, and PE: inbound triage, quarter-end portfolio review, LP letter, IC memo. (Zapier and Notion templates.)
- **Safe by default.** Permissions are inherited from source systems, deal walls are respected, nothing trains without consent, memory is exportable, and there's a single-tenant option.

### 5.3 Surfaces: three layers (from Shattir's Agent UI board)
Shattir's [Agent UI inspiration board](https://cursor.com/canvas/store-c95c04ed-4216-4f3d-9021-1a6f5c31c891/8bb58cfa-b0af-44ed-9bc3-5f5185f8faec) assumes a user who *watches* the agent (live node graph, trace timeline, replay scrubber). Ours won't, so about half of it fits once we flip that assumption.

**1. Day to day: almost nothing new.** The work lands where users already work.
- **Source chips become footnotes on every number**, using Perplexity-style numbered citations inside their Word/Docs memo, Excel comps sheet, and emails. Hover or click opens the exact data-room page with the line highlighted.
- **The approve card becomes a reply:** *"Draft follow-up to Acme's CFO is ready, reply yes to send."*
- **The "now doing" line appears only when asked.** It's a receipt, not a live feed: *"Read all 1,206 files. 3 things didn't tie out. 2 contracts have change-of-control clauses."*

**2. The one screen we own: the deal page, opened from a link.** One calm page:
- **The answer on top:** memo, comps, or red flags, with every claim cited.
- **A completeness checklist:** *"1,206 of 1,206 docs read, 4 scans OCR'd, 2 view-only models rebuilt."* This kills the silent-skip fear at a glance.
- **A tie-out panel** showing where the CIM, model, QoE, and Q&A answers disagree, side by side.
- **An outside check:** a Crustdata card comparing headcount with claimed revenue and showing who left, with "as of" dates.
- Everything else stays collapsed, opens in one click, and loads fast.

**3. Behind the scenes: the flashy parts.** The React Flow graph, trace timeline, replay scrubber, and Langfuse-style traces serve three audiences, none of them the daily user:
- the **hackathon demo**, where a live graph of agents reading the room, checking Crustdata, and tying out numbers makes "end-to-end execution" obvious in 30 seconds
- the fund's **ops person or auditor**, who asks "show me how you got this number"
- **us**, for debugging and evals

> **Principle: wow for the judge, invisible for the user.** The graph sells the demo. Footnotes, the completeness checklist, and reply-to-approve are what keep a fund using it.

**Stack:** Next.js with shadcn/ui, the Vercel AI SDK, shadcn's Trace and AI Elements components for collapsed steps, and React Flow plus Motion for the demo graph. Add the surfaces users actually live in: an Outlook/Gmail add-in, an Excel/Sheets add-in, and Slack. AG-UI is optional, only if outside agents plug in later. Reuse the existing Venture OS design system (Newsreader headings, Geist body, rust accent) so everything looks like one product.

### 5.4 Small details, fewer tabs, familiar language
- **Readable in one glance.** For example, use a document outline on one side and the document on the other, instead of dumping the entire company review. Apply that thinking to every small detail.
- **Fewer tabs, not more.** Don't multiply tabs and make things confusing. The analyst should never end up spending time understanding or digging into what the agent did. It has to be flipped around the user to make their life 10x better.
- **Learn from products that do a lot but feel simple** (Grokbot, Claude): easy to start, easy to follow, easy to stick with.
- **Language matters as much as visuals.** Labels, tab names, and copy should use everyday or standard industry terms, not invented jargon. Simple technical English is fine where it fits.
  - Terms already in common use are fine to keep (e.g. "firm brain").
  - Replace terms that make no sense with the standard one (e.g. "bank desk" → **"mandate"**).
- **Build around what users already see every day.** We can't expect them to change their behaviour abruptly to fit our platform. Least friction wins.

---

## 6. Go-to-Market and Moat

### 6.1 The wedge: "Chief of Staff for the fund"
The way in is probably **remembering and communicating**, not diligence. The OS captures email, calendar, and meeting notes into the CRM and firm memory. It drafts follow-ups, pass emails, IC prep, and LP updates for one-click approval, and delivers a daily *"here's what I did, here's what needs you"* brief. This is the Khosla Chief of Staff job, the biggest time sink, the easiest yes, and the memory layer every later agent builds on.

**Sequence:** Chief of Staff → checked diligence and thesis-driven sourcing → banking workflows.

### 6.2 How vertical agentic OSes win (lessons to copy)
The winners all follow the same playbook: **start with one frequent, low-stakes job, deliver it with domain experts inside the customer's existing tools, link every output to its source, and let nothing be written without approval.**
- **[Legora](https://legora.com/product/aos)** calls itself an "agentic OS" for law firms. It plans, executes, reviews, and delivers; watches email and documents proactively; encodes firm standards as reusable skills; and works inside Word and Outlook. It's the closest match to our shape.
- **[Harvey](https://www.saastr.com/harvey-puts-a-former-practicing-lawyer-in-every-deployment-about-180-of-them-heres-how-that-model-works/)** puts one of about 180 ex-lawyers into every deployment, pilots on the prospect's own documents, and ships nothing that hasn't passed evals.
- **[Abridge](https://hlth.com/insights/articles/interview-with-shiv-rao-ceo-of-abridge):** *"Documentation was the wedge, not the destination."* Every phrase links back to the audio, and a separate model catches unsupported claims.
- **[Rogo](https://rogo.com/customers/baird-investment-banking)** explains why Baird's in-house attempts failed: scattered data, poor workflow fit, and change management. Rogo fixed it with former bankers on-site and security first.
- **[Sierra](https://sierra.ai/blog/agent-development-life-cycle)** turns every expert correction into a regression test.
- **Sequoia, [*"Services: The New Software"*](https://sequoiacap.com/article/services-the-new-software):** *"A copilot sells the tool. An autopilot sells the work."* Start where work is already outsourced, so buying us is a vendor swap, not a reorg.
- Still to study: Basis, Rillet, EliseAI, and recent YC batches.

### 6.3 Building and delivering
- **Sit on top of existing tools, don't replace them.** Read from and write back to Affinity, DealCloud, Standard Metrics, and Carta with approval. Replace only thin tools and spreadsheets. **Never touch fund accounting or cap tables.**
- **Build first:** connectors (email, calendar, call notes, Drive, CRM, Crustdata); entity resolution of every person and company to Crustdata IDs; a store where every fact carries its source and date; permissions inherited per system; an approval layer; and an eval harness built from partner corrections.
- **Model-agnostic and deployable inside the firm.** Use frontier models for the hardest reasoning, and open-weight models in the firm's own cloud or on-prem for bulk work (extraction, CRM updates, drafting, classification). *"Your data never leaves your walls"* is a sales unlock for banks, PE, and LP-sensitive VCs.
- **Log every agent action, edit, and approval in a clean, structured format from day one**, even before any fine-tuning. That record becomes the most valuable asset.
- **Deliver like Harvey and Rogo:** one or two ex-VC or fund-ops people inside each customer, a security pack on day one, a single-tenant option, no training on customer data, and SOC 2 started early.
- **Onboarding:** in week 1, connect one partner team read-only and backfill. In week 2, run a parallel quarter scored against their spreadsheet. From week 3, turn on drafts with approval.

### 6.4 Customers and pricing
- **First customers:** mid-size and emerging VCs and family offices in India and the US, plus boutique PE and banking deal teams, especially **high-deal-volume firms**. Big banks come later, as buyers of the owned-model and data layer.
- **Buyer:** the fund's CFO, COO, or Chief of Staff. Offer: *"Your quarter-end portfolio review, LP letter draft, and auditor replies, done from your inbox."*
- **Pricing:** sell **finished work, not seats**. Price per memo, per diligence, or per sourced deal, and charge per fund. That's how we replace the junior analyst instead of handing them another tool.

### 6.5 What makes us the obvious choice and the moat
- **Obvious choice:** every number cited and checked against Crustdata, a measured accuracy score on every output, approval gates on risky actions, and MCP/CLI access so a firm's own agents plug in instead of competing with us.
- **The moat:** **the firm's memory, plus its decision history, plus its own model.** Whoever owns the firm's memory graph wins, because every new agent gets better once it's plugged in. A competitor can copy the agents but not years of a firm's judgement. When a better base model ships, we carry the firm's evals and training data forward to it. Switching away means losing the fund's memory and judgement.
- **The hard part isn't the agents.** It's **memory, hands, and trust.**

### 6.6 Pitch lines
- *"Vinod Khosla is hiring a Chief of Staff to work 8 to 8. We built one for every fund, one that works 24/7, never forgets, shows its sources, and learns how your firm decides."* ← **primary**
- *"Every fund runs on spreadsheets, gut feel, and junior analysts. We give it an operating system: verified data in, investment decisions out, with a receipt for every claim."*
- *"Every fund and bank gets its own investing intelligence, a model that learns how their firm decides, runs where they choose, and gets better with every deal."*
- *"Other tools give you answers with citations. We tell you which claims are true, what's missing, and what changed this week."*

---

## 7. Open Questions and Next Steps
- **First demo workflow:** decide what we build and demo first. The candidates are the Chief of Staff wedge (product lead), data-room diligence (sharpest pain, weakest incumbents), and references/backchannels (biggest repetitive pain, strongest Crustdata fit). Sourcing is Crustdata's strongest area but crowded (Harmonic, Specter). Even so, since we're building the full OS, every part should be done properly.
- **Screenshots:** collect the LinkedIn posts of Vinod Khosla and the JPMorgan hiring post.
- **Competitor analysis:** focus only on what they do, how to be 10x better, and how to become the obvious choice. Scan X, Reddit, HN, and other forums.
- **Portfolio tools:** finish deciding whether we plug into, sit on top of, or replace Standard Metrics, Chronograph, Visible, Carta, Cobalt, iLevel, Vestberry, and the newer AI-native tools. *(Current lean: sit on top.)*
- **Vertical-OS research:** finish the study of Basis, Rillet, EliseAI, and recent YC batches, and turn it into a concrete playbook and roadmap.
- **Identify the source** of the "own your intelligence" video (which firm).
- **Research independently.** Don't rely only on the founder's instructions; use our own research to fill domain gaps.
