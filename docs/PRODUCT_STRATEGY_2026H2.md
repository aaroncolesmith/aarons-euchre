# Product Strategy Brief — 2026 H2

**Date:** June 10, 2026
**Status:** CPO Audit v2 — supersedes `product_strategy_brief.md` (March 2026)
**Codebase:** V1.79 + T-wave (T-01 through T-33)
**Grounding:** This brief is based on production data queried directly from Supabase, not assumptions.

---

## 1. Executive Summary: The Growth Thesis Was Never Tested — And Usage Collapsed Anyway

The March 2026 brief diagnosed the product's biggest risk as **audience size** and prescribed growth machinery: open registration (T-20), invite links + shareable daily scores (T-33). That work was implemented on **June 5, 2026 — but exists only as 8 unpushed local commits.** It was never deployed. The live app (origin/main, v1.79) still has the hardcoded 8-name whitelist, no invite links, and no share button.

Here is what happened to usage while the live product sat fully functional:

| Month | Games | Active Humans | Who |
|---|---|---|---|
| Jan 2026 | 9 | 3 | Aaron, Mimi, Polina |
| Feb 2026 | 3 | 2 | Aaron, Mimi |
| Mar 2026 | 21 | 3 | Aaron, Mimi, Micah ← *T-wave ships* |
| Apr 2026 | **0** | **0** | — |
| May 2026 | 2 | 1 | Aaron |
| Jun 2026 | 1 | 1 | Aaron |

The collapse happened with **no growth features in play and no whitelist standing in the way of the inner circle** — the six people who could already log in simply stopped coming back. The Daily Challenge — our supposed retention engine — has been completed **15 times ever: 12 by Aaron, 2 by Mimi, 1 by Micah**. The last non-Aaron activity was March.

**The corrected diagnosis:** The product's binding constraint is not the locked door — the people with keys don't return. Growth features amplify a retention loop; they cannot substitute for one. Shipping the T-wave as-is would be building a megaphone for a room with no music playing.

**The strategic reset:** Shrink the product to one daily ritual — **Hand of the Day** — and make it excellent, social-by-default, and impossible to "run out of." Retention before acquisition. We don't need 500 users; we need 5 people who play every single day. Everything else (multiplayer tables, stats suite, leagues) becomes supporting cast.

---

## 2. Product Audit

### 2.1 Where value is real (protect these)

| Asset | Evidence | Verdict |
|---|---|---|
| **Bot AI engine** | 6 personality archetypes, tunable traits, 5,252 logged decisions with written reasoning. Pure-function `getBotMove` in `rules.ts` is deterministic and testable. | The moat. No competitor has named, auditable bots. |
| **Deterministic daily hands** | `createDailyRNG(dateString)` already deals identical hands to every player on a given date. | The Wordle mechanic is *already built* — it's just trapped in a date-bound, one-shot format. |
| **Event sourcing** | 4,225 euchre events; stats derived server-side (T-21); authoritative Edge Function server (T-10/T-11). | Enables replays, async comparison, and stat integrity. Quietly the most valuable infrastructure decision made. |
| **Server-authoritative architecture** | All game actions flow through `process-action`; RLS on most tables (T-02). | The hard engineering is done. New modes are cheap now. |

### 2.2 Where interest is leaking (data-confirmed)

| Leak | Evidence | Severity |
|---|---|---|
| **Daily Challenge is a dead end** | One play per day, no archive. Finish in 5 minutes → nothing to do. Miss a day → hand gone forever. New player on day 1 → exactly one hand available. 15 total completions proves it. | 🔴 Fatal to the ritual |
| **Playing alone feels alone** | Daily scores exist in a leaderboard, but there is no moment where you *see* your friend fail on the same cards you swept. The social payload of identical hands is unrealized. | 🔴 Kills the comparison loop |
| **Bot audit pipeline is dead** | `bot_decisions` last insert: **March 10**. The `saveBotDecision` calls were removed from the client around the March server-sync experiment and never restored — it has zero callers on the live branch *and* in the local T-wave (whose server bot cascade doesn't log either). The Bot Audit tab reads a frozen table in both versions. | 🟠 Blocks bot improvement |
| **No streak, no stakes** | Nothing accumulates day over day. Wordle without the streak counter is just a word puzzle. | 🟠 Nothing to protect |
| **Product surface is too wide** | Lobby tables, leagues, 9 stats tabs, trump analytics, hand strength — for an active population of 1. Every surface dilutes the one that matters. | 🟡 Focus tax |
| **Data hygiene** | `play_events` contains 227 `FIZZYFEST*` events from an unrelated app sharing this Supabase project. Backup tables from March still present. | 🟡 Pollutes analytics |

### 2.3 Security finding (must address, independent of strategy)

Supabase advisors flag **RLS disabled** on `public.games` — ironic, since T-02's stated purpose was locking down `games`. Either the migration was never applied to this project or it was reverted. Anyone with the anon key can read/modify every row, which includes opponents' hands. Also unprotected: the two `player_stats_backup_20260319*` tables (stale — should simply be dropped).

```sql
-- Review and apply deliberately (enabling RLS without policies blocks all access;
-- verify the policies in 20260605_rls_close_trust_boundaries.sql are in place first):
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
DROP TABLE public.player_stats_backup_20260319;
DROP TABLE public.player_stats_backup_20260319_regular_only;
```

> **Coordination warning:** the *deployed* client (v1.79) still writes to `games` directly. Enabling RLS on `games` before deploying the server-authoritative T-wave code will break the live app. This must ship as one unit (see §2.4).

### 2.4 Deployment state: the T-wave exists only on this laptop

`main` is **8 commits ahead of origin/main** — the entire T-wave (T-01 → T-33: server-authoritative dealing and bot cascade, RLS lockdown, freeze-subsystem deletion, event-derived stats, open registration, invite links, share scores) was implemented in a June 5 working session and never pushed. Vercel deploys from GitHub, so none of it is live. Meanwhile the `process-action` Edge Function deployed on the backend dates from **March 11** and does not match the local source.

The repo is therefore in a **half-migrated state across three surfaces** (local code ↔ deployed frontend ↔ deployed Edge Function + DB policies), and the first product decision is not a feature at all: **review the T-wave, test it end-to-end, and ship it as a coordinated unit (git push + Edge Function redeploy + RLS migration), or revert it.** Until then, every local architectural assumption — including parts of this brief's roadmap costing — describes code no user has ever run.

---

## 3. Strategic Roadmap

### Phase 1 — Value Validation (now → 4 weeks)
*Prove that one person who tries the product comes back tomorrow.*

| # | Feature | Detail | Effort |
|---|---|---|---|
| 1 | **Numbered universal hands** | Hand of the Day becomes **Hand #N**, seeded by number (`createDailyRNG('hand-' + n)`), not date. Today's date maps to today's number (days since launch epoch). Hand #23 is the same cards for every player, forever. | Small — the RNG and dealing are already deterministic |
| 2 | **The Archive ("Catch-up")** | Any past hand is playable anytime. Only today's hand counts for the daily leaderboard; archive plays count for completion. New users get N hands of content on day one instead of one. | Small–Medium |
| 3 | **Streaks** | Daily completion streak, displayed prominently, with a "longest streak" record. The single cheapest retention mechanic in existence. | Small |
| 4 | **Surface reduction** | Landing page = today's hand, your streak, friends' results. Multiplayer tables and the stats suite move behind a "More" entry. Hide developer tabs entirely (Bot Audit, debug views) behind an admin flag. | Small |

### Phase 2 — Differentiators (4–12 weeks)
*Build what Trickster, Euchre 3D, and VIP Euchre structurally cannot copy.*

| # | Feature | Why it's a moat |
|---|---|---|
| 5 | **Par score** (Opportunity 1, §5) | Every hand gets a bot-derived par. Scores become comparable across hands and players — the foundation of all scoring, streaks, and shares. Requires the bot engine; competitors don't have one worth simulating. |
| 6 | **The Daily Table** (Opportunity 2, §5) | Asynchronous social comparison on identical cards. Requires deterministic hands + event sourcing — both already built. |
| 7 | **Visible bot improvement loop** (Opportunity 3, §5) | Bots that demonstrably get better every week, with public changelogs ("Huber no longer leads trump into a void"). Turns the audit process into product personality. |

### Phase 3 — Expansion (12+ weeks, gated on Phase 1–2 retention)
*Do not start any of this until ≥5 people have a 7-day streak.*

- **Weekly tournament**: best cumulative score vs par across the week's 7 hands.
- **PWA + push notification**: one notification per day — "Hand #87 is live. Mimi already beat par."
- **Multiplayer renaissance**: once the daily ritual retains, tables become the *social escalation* ("we both play daily — let's play live"), not the front door.
- **Variant support / regional rules** — only if an actual community materializes.

---

## 4. The Four Mandates (founder's top-of-mind topics)

### 4.1 Simplicity: Hand of the Day as *the* product ✅ adopted as core thesis

Your instinct is exactly what the data prescribes, with one upgrade: **number the hands, don't date them.** "Game #23 is the same for me and for you" — seeding by hand number rather than calendar date gives you that *plus* an archive, a catch-up mechanic, and infinite content for new users, while today's number still rotates daily. Implementation is nearly free because `rng.ts` is already a seeded PRNG and `dailyUtils.ts` already handles the 6 AM PT rollover (which stays — it just maps date → number now).

### 4.2 User management: do almost nothing, deliberately

T-20 already removed the whitelist; `identity.ts` already issues stable UUIDs persisted in localStorage. The simplest viable model for the current scale:

1. **Name + device identity, no passwords, no email.** You have this today. Keep it.
2. Add only two small things: **name uniqueness** (reserve a name to the first UUID that claims it, server-side check on login) and a **recovery code** (show the user their UUID-derived code once; entering it on a new device relinks their identity). That's cross-device support with zero auth infrastructure.
3. **Explicitly defer Supabase Auth** until there are ≥20 weekly actives or real abuse. Every auth screen you don't build is onboarding friction you don't pay.

### 4.3 Bot decision audit: fix the pipe, then build the loop

**Step 0 — the pipeline is broken and must be repaired first.** Bots run in the `process-action` Edge Function since T-10/T-11, but decision logging still lives in the client (`saveBotDecision` in `supabaseStats.ts` — zero callers). Move the logging into the Edge Function's bot cascade so every server-side bot decision writes `bot_decisions` with hand context, reasoning, and personality traits (the table schema already supports all of it).

Then build the audit *process* — a repeatable weekly loop, not a dashboard:

1. **Outcome attribution**: when a hand resolves, tag each bot decision in that hand with the result (tricks taken vs expected, euchred y/n). One `hand_result` join — the event log already has it.
2. **Blunder queue**: a saved query (or simple admin view) surfacing the week's N worst decisions — e.g. ordered up with hand_strength < threshold and got euchred; trumped partner's winning ace.
3. **Flag-while-playing**: a 🚩 button on the game recap that marks a bot decision for review. You're the QA team; capture suspicion in the moment it occurs, with full context attached.
4. **Regression scenarios**: every confirmed blunder becomes a unit test — `getBotMove` is a pure function, so each fix is lockable forever: *given this hand, this trump, this trick state → never play the ace of off-suit.* A `tests/bot-scenarios/` suite that runs in CI. This is the step that converts auditing from a chore into compounding bot quality.

### 4.4 Documentation audit: 26 files → 6, all in `docs/`

Current state: ~4,100 lines across 26 files in `docs/`, plus strays at root (`product_strategy_brief.md`, `CLAUDE.md` is fine at root by convention, `.cursorrules` duplicates CLAUDE.md's versioning rule). Roughly half the docs describe systems that no longer exist (the freeze-recovery subsystem was deleted in T-14; START_HERE.md still documents the pre-server `broadcastDispatch` architecture and the user whitelist).

Proposed structure:

| Keep (living docs) | Sources merged in |
|---|---|
| `docs/ARCHITECTURE.md` | START_HERE (rewritten), EVENT_SOURCING_ARCHITECTURE, STATS_REBUILDING_ARCHITECTURE, SERVER_AUTH_PLAN |
| `docs/BOT_AI.md` | euchre_brain.md, bot_tactics.md, BOT_PASS_LOGGING |
| `docs/PRODUCT_STRATEGY_2026H2.md` | this file (root `product_strategy_brief.md` → archive) |
| `docs/ROADMAP.md` | ROADMAP, 001/002 CTO roadmaps, CTO_TECH_AUDIT_ROADMAP, CTO_HANDOFFS — collapsed to current state |
| `docs/STYLE_GUIDE.md` | keep as-is |
| `docs/TESTING.md` | TEST_USER_GUIDE, tests_intelligent.md |

Everything else (CRITICAL_BUG_FIX, FIXES_NEEDED, DEBUG_STATS, STATS_RESET_V4, CROSS_DEVICE_DIAGNOSIS, ISSUE_CROSS_DEVICE_GAMES, LOCALSTORAGE_MANAGEMENT_FEATURE, TRUMP_ANALYTICS_*) → `archive/docs/`. Delete `.cursorrules` after confirming CLAUDE.md covers the versioning rule (it does). Rule going forward: **a doc describing a fixed bug or completed migration is archived the day the work merges.**

---

## 5. Three High-Impact Opportunities (not previously discussed)

### 🔥 Opportunity 1: Par Score — every hand has a number to beat

Before publishing Hand #N, simulate it with four bots playing all positions. The resulting score is **par**. Your daily result is expressed relative to it: *"Hand #23: −1 under par."*

Why it matters: raw daily scores are incomparable — some hands are lay-downs, some are unwinnable. Par makes every result meaningful, makes the share artifact legible to non-players (golf semantics are universal), and creates the "this hand is brutal, par is 2" anticipation hook. Only possible because the bot engine and deterministic dealing already exist — this is the single highest leverage-to-effort feature available, and it becomes the scoring foundation for streaks, leaderboards, and tournaments.

### 🔥 Opportunity 2: The Daily Table — async social on identical cards

Everyone who plays Hand #N implicitly sat at the same table. Surface that: after you finish, see each friend's run on the very same cards — "Mimi went alone on this hand and got euchred. You swept it." Trick-by-trick replay of a friend's hand comes nearly free from the event log.

Why it matters: this converts the daily from a solitaire exercise into the group-chat moment that Wordle squares created — *without requiring anyone to be online at the same time*. For a friend-group product whose entire bottleneck is coordinating four schedules, async social comparison is the retention multiplier. It is also the feature that makes the share artifact ("can you beat my −2 on Hand #23?") land somewhere meaningful — the recipient plays the *exact same hand*.

### 🔥 Opportunity 3: The Self-Improving Bot Program — auditing as a public feature

Elevate §4.3 from internal process to product personality. Each bot maintains a visible record: decision accuracy trend, biggest recent blunder, and a changelog — *"v1.83: Huber no longer leads trump when his partner ordered up."* Players' 🚩 flags feed the queue; when a flagged blunder gets fixed, the flagger gets credited in the changelog.

Why it matters: it converts your QA burden into engagement (spotting bot mistakes becomes a game), gives the bots narrative arcs (they're characters who *learn*), and compounds the moat — every week of operation makes the AI measurably better in a way no competitor clone can fast-follow, because they'd need the decision telemetry, the personality system, and the regression harness, not just the rules engine.

---

## 6. Metrics That Matter Now

The March brief's metrics (500 registered users, DAU 50+) were stage-inappropriate. The only questions that matter for the next 90 days:

| Metric | Today | 90-day target |
|---|---|---|
| People with an active 7-day streak | 0 | **5** |
| Daily hand completions / week | ~0–1 | 25 (5 people × 5 days) |
| Archive hands played by a new user in week 1 | n/a | ≥5 |
| Bot decisions logged / week | **0** (pipeline dead) | 100% of server bot moves |
| Confirmed bot blunders converted to regression tests | 0 | 10 |
| Living docs in `docs/` | 26 (mostly stale) | 6 |

One instrumentation note: log an `app_open` event (or reuse `play_events`) so DAU is measurable at all. Today we can only infer activity from game events.

---

## 7. Execution Order

0. **Resolve the T-wave (decision, then a deploy):** review the 8 unpushed commits, test end-to-end, then ship code + Edge Function + RLS migration as one unit — or revert. Nothing else can be sequenced until the deployed and local architectures match (§2.4).
1. **Hygiene week (do first, it's all small):** repair bot-decision logging in the Edge Function · verify/apply RLS on `games` (coordinated with step 0) · drop backup tables · isolate or purge FIZZYFEST events · docs consolidation (§4.4).
2. **Numbered hands + archive + streaks** (§3 Phase 1) — the new core loop.
3. **Par score** — makes the loop meaningful.
4. **The Daily Table** — makes the loop social.
5. **Name claim + recovery code** — only user management needed this year.
6. **Bot blunder queue + scenario tests** — the compounding loop, run weekly thereafter.

> **The one-sentence strategy:** Stop building a euchre platform for an audience that hasn't arrived; build a five-minute daily ritual so good that five specific people refuse to break their streak — then let them pull the audience in.

---

*Prepared by CPO Analysis • June 10, 2026 • Data queried live from production Supabase*
