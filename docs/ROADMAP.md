# Aaron's Euchre — Engineering Roadmap

**Last updated:** June 10, 2026
**Source docs merged:** `001_CTO_ROADMAP.md`, `002_CTO_TECHNICAL_ROADMAP.md`, `CTO_TECH_AUDIT_ROADMAP.md`, `CTO_HANDOFFS.md`, legacy `ROADMAP.md`, `product_strategy_brief.md` (March 2026)
**Superseded by:** `PRODUCT_STRATEGY_2026H2.md` (June 2026, CPO)

---

## North Star

> Stop building a euchre platform for an audience that hasn't arrived. Build a five-minute daily ritual so good that five specific people refuse to break their streak — then let them pull the audience in.

The product's technical moat (named bot AI, deterministic seeding, event sourcing, server-authoritative game loop) is real and complete. What's missing is a retention loop worth protecting. Every roadmap item below serves that goal, or is explicitly gated behind it being proven.

---

## Current State — June 10, 2026

### Usage (production data)

| Month | Games | Active Humans |
|---|---|---|
| Jan 2026 | 9 | 3 |
| Feb 2026 | 3 | 2 |
| Mar 2026 | 21 | 3 |
| Apr 2026 | **0** | **0** |
| May 2026 | 2 | 1 |
| Jun 2026 | 1 | 1 |

Daily Challenge completions all-time: **15** (12 Aaron, 2 Mimi, 1 Micah). Last non-Aaron activity: March 2026.

### Deployment gap (blocks everything)

`main` is **8 commits ahead of `origin/main`** — the entire T-wave was built in a June 5 session and never pushed. Vercel deploys from GitHub, so no user has run any of this code. The deployed Edge Function (`process-action`) is from **March 11** and does not match local source. The deployed frontend is still v1.79 with the hardcoded whitelist, no invite links, and no share button.

**First action is not a feature: resolve the T-wave.**

### What the T-wave changed (committed locally, not deployed)

| Commit | Work |
|---|---|
| T-01 / T-03 | Remove hand-leaking full-state client upsert; centralize app version |
| T-02 | RLS lockdown on `games`, `daily_challenge_scores`, `player_stats` |
| T-10 / T-11 | Server-side dealing + server bot cascade (the keystone architectural change) |
| T-14 | Delete freeze-recovery subsystem (`heartbeat.ts`, `antiFreezeWatchdog.ts`, freeze tab) |
| T-20 | Open registration — remove hardcoded user whitelist |
| T-21 | Event-derived idempotent stats — eliminate client-side stat writes |
| T-22 / T-23 | Bounded leaderboard fetch + localStorage pruning |
| T-33 | Invite links + shareable Daily Challenge score |

### Known issues as of June 10

- **Bot decision logging is dead.** `saveBotDecision` has zero callers since T-10/T-11 moved bots server-side. The `bot_decisions` table has been frozen since March 10. The Bot Audit tab reads a stale table in both the deployed version and the T-wave.
- **RLS on `games` not confirmed applied** to production. The T-wave migration exists locally; it may not be in the deployed DB. Enabling RLS without the right policies will break the live app — this must ship as one unit with the T-wave code.
- **`player_stats_backup_20260319` tables** still present in production — stale, should be dropped.
- **227 FIZZYFEST events** in `play_events` from an unrelated app sharing the Supabase project.
- **Version strings are inconsistent**: `App.tsx` says v1.79, `GameStore.tsx` logs 1.76, the edge function logs 1.69.
- **Commentary tab is empty** ("Semantic analysis engine v1.0 offline") — a broken promise.

---

## Phase 0 — Deploy the T-Wave (Do This First)

*Nothing in the roadmap below can be sequenced until the deployed and local architectures match.*

| Step | Action |
|---|---|
| 0a | Review the 8 T-wave commits end-to-end; test against a real game (create table, play with bots, verify Daily Challenge, verify stats update, verify leaderboard) |
| 0b | Deploy as a **coordinated unit**: `git push` → Vercel (frontend) + `supabase functions deploy process-action` (Edge Function) + apply `20260605_rls_close_trust_boundaries.sql` in Supabase SQL editor |
| 0c | Confirm `games` rows during a live hand no longer contain `players[].hand` (the T-01 hand-leak fix) |
| 0d | Confirm anon key cannot write to `player_stats` (the T-02 RLS fix) |

**If end-to-end testing reveals blockers:** revert to origin/main, fix on a branch, re-test before pushing. Do not ship a broken architecture upgrade to the live app.

---

## Phase 1 — Hygiene Week (immediately after T-wave deploys)

*Small, bounded tasks that close active holes and reduce the noise floor before building anything new. All items are 1–2 hours each.*

| # | Task | Why |
|---|---|---|
| H-1 | **Repair bot decision logging** — move `saveBotDecision` calls into the `process-action` Edge Function's bot cascade loop (T-11 is where bots now run). Every server-side bot decision should write `bot_decisions` with hand context, reasoning, and personality traits. | The `bot_decisions` table schema already supports this. Without it, the bot improvement loop (Phase 2) has no data. |
| H-2 | **Drop backup tables** — `DROP TABLE public.player_stats_backup_20260319; DROP TABLE public.player_stats_backup_20260319_regular_only;` | Stale, unprotected, polluting analytics. |
| H-3 | **Isolate FIZZYFEST events** — add a `source` column or filter to exclude the 227 non-euchre events from `play_events`; or move them to a separate table. | They corrupt any aggregate query on the event stream. |
| H-4 | **Add `app_open` event logging** — log a `play_events` entry (type: `APP_OPEN`) on app mount, or a minimal separate table, so DAU is measurable. | We currently have zero product analytics. You cannot improve what you don't measure. |
| H-5 | **Version string sync** — confirm the T-03 Vite `define` approach is working so `package.json` is the single source and all in-app strings match. Run `npm version patch` and verify the footer, `GameStore` log, and edge function all report the same string. | Three inconsistent version strings make telemetry unreadable. |
| H-6 | **Docs consolidation** — archive stale docs per §4.4 of `PRODUCT_STRATEGY_2026H2.md`; target: 6 living docs in `docs/` (ARCHITECTURE, BOT_AI, PRODUCT_STRATEGY_2026H2, ROADMAP, STYLE_GUIDE, TESTING). | 26 files, half describing deleted systems. Developer tax every time someone tries to understand the codebase. |

---

## Phase 2 — Retention Core (weeks 1–4 post-T-wave)

*Goal: 5 people with an active 7-day streak. Do not start Phase 3 until this is demonstrated.*

The strategy pivot: Hand of the Day is the product. Multiplayer tables, the stats suite, and leagues become supporting cast, not the front door.

### R-1 · Numbered universal hands

**What:** Replace date-based seeding (`createDailyRNG(dateString)`) with number-based seeding (`createDailyRNG('hand-' + n)`). Today's date maps to today's hand number (days since a fixed launch epoch). Hand #23 is the same cards for every player, forever.

**Why:** Adds the archive and catch-up mechanic essentially for free. The RNG and dealing are already deterministic. The 6 AM PT rollover stays — it just maps date → number now.

**Implementation sketch:**
- Add `HAND_EPOCH = '2026-01-01'` constant to `dailyUtils.ts`
- `getTodayHandNumber(): number` computes days since epoch
- `getHandSeed(n: number): string` returns `'hand-' + n`
- `dailyUtils.ts` exposes both `getTodayHandNumber()` and `getHandSeed(n)` for archive use
- All existing `createDailyRNG(dateString)` callers become `createDailyRNG(getHandSeed(getTodayHandNumber()))`

### R-2 · Archive ("Catch-up")

**What:** Any past hand is playable at any time. Past hands are accessible via a scrollable list of Hand #1 through today. Only today's hand contributes to the daily leaderboard; archive plays contribute to completion count and can earn streaks.

**Why:** New users get N hands of content on day one instead of one. Miss a day? Play it later. The "run out of content" problem — which killed the current Daily Challenge (one play per day, then nothing) — is eliminated.

**Implementation sketch:**
- `LandingPage.tsx` or a dedicated `ArchiveView.tsx` lists past hands with completion status
- Archive hand play uses the same `GameState` with `isDaily: true` and the appropriate `handSeed`
- Supabase stores archive completions in `daily_challenge_scores` with `hand_number` column (add via migration)
- The leaderboard query filters to today's hand number for ranked play

### R-3 · Streaks

**What:** A daily completion streak, displayed prominently on the landing page. "🔥 7-day streak" with the longest-ever streak as a secondary stat.

**Why:** The cheapest retention mechanic in existence. Wordle without the streak counter is just a word puzzle. The streak creates something to protect.

**Implementation sketch:**
- Derive streak from `daily_challenge_scores` ordered by `hand_number` — consecutive completions = streak
- Store `current_streak` and `longest_streak` on `player_stats` or compute client-side from the scores table
- Landing page shows streak prominently (top of screen, large, animated on extension)
- Edge case: archive plays on skipped days — decide whether they count for streak continuity (recommended: yes, to reward catch-up)

### R-4 · Surface reduction

**What:** Simplify the default experience to: today's hand, your streak, friends' results. Demote the rest.

**Changes:**
- Landing page becomes the Daily entry point, not a create/join screen
- Multiplayer tables accessible via "Play with Friends" button (not the default path)
- Stats suite accessible via a "Stats" tab (not 9 subtabs by default)
- Hide developer tabs entirely behind an admin flag: Bot Audit, State Management, Freeze Incidents (already deleted), Commentary (until built)
- Remove the empty Commentary tab until The Booth (Phase 3) ships

---

## Phase 3 — Differentiators (weeks 4–12)

*Build what competitors cannot replicate. All items depend on Phase 2 retention proof.*

### D-1 · Par Score

**What:** Before publishing Hand #N, simulate it with four bots playing all positions. The resulting score is **par**. Results are expressed relative to par: "Hand #23: −1 under par."

**Why it's a moat:** Raw daily scores are incomparable — some hands are laydowns, some are unwinnable. Par makes every result meaningful and makes the share artifact legible to non-Euchre players (golf semantics are universal). Only possible because the bot engine and deterministic dealing already exist.

**Implementation sketch:**
- Server-side: when hand #N is first requested, run a simulation (`getBotMove` × 4 for all tricks) and store the par score in Supabase alongside the hand seed
- Client displays result as `+N` / `−N` / `E` with golf-style coloring
- Share text: "Hand #23: −2 under par 🎯 (Huber/Max/Molly/Finn dealt the cards)"

### D-2 · The Daily Table (async social comparison)

**What:** After completing Hand #N, see each friend's run on the same cards — trick by trick. "Mimi went alone on this hand and got euchred. You swept it."

**Why it's a moat:** Requires deterministic hands + event sourcing — both already built. Converts the daily from a solitaire exercise into the group-chat moment that Wordle squares created. No real-time coordination needed.

**Implementation sketch:**
- After your hand completes, query `daily_challenge_scores` + `play_events` for Hand #N from all players in your friend group (or all players globally)
- Reconstruct each player's hand from their event stream (already possible via `rehydrateState`)
- Display as a compact trick-by-trick replay: 5 rows, each showing what each player held and played, who won
- No new infrastructure needed — the event log already captures everything

### D-3 · Bot improvement loop

**What:** A repeatable weekly process — not a dashboard — for improving bot quality. Elevation of the internal audit process into a public product personality.

**Steps (after H-1 bot logging is repaired):**
1. **Outcome attribution**: tag each bot decision in `bot_decisions` with hand result when hand resolves. One join — event log has it.
2. **Blunder queue**: a saved query surfacing the week's worst decisions (ordered up with weak hand + got euchred; trumped partner's winning ace).
3. **Flag-while-playing**: a 🚩 button on the game recap that marks a bot decision for review with full context.
4. **Regression scenarios**: every confirmed blunder becomes a unit test in `tests/bot-scenarios/`. `getBotMove` is a pure function — each fix is lockable forever.

**Public-facing product personality** (stretch goal within this phase): each bot maintains a visible record — decision accuracy trend, biggest recent blunder, a changelog. Players' 🚩 flags feed the queue; when a blunder gets fixed, the flagger gets credited. This converts the QA burden into engagement.

### D-4 · Name claim + recovery code

**What:** Two small additions to the existing no-password identity system:
1. **Name uniqueness** — reserve a display name to the first UUID that claims it (server-side check on login, reject duplicates)
2. **Recovery code** — show the user their UUID-derived recovery phrase once on first login; entering it on a new device relinks identity

**Why:** Cross-device support with zero auth infrastructure. Explicitly defer Supabase Auth until ≥20 weekly actives or real abuse.

---

## Phase 4 — Growth & Expansion (12+ weeks)

**Gate:** Do not start any item below until ≥5 people have a 7-day streak.

| # | Feature | Dependency |
|---|---|---|
| G-1 | **Weekly tournament** — best cumulative score vs par across the week's 7 hands | Par score (D-1), streaks (R-3) |
| G-2 | **PWA + push notification** — one notification per day: "Hand #87 is live. Mimi already beat par." | Service worker, VAPID keys |
| G-3 | **Multiplayer renaissance** — once daily ritual retains, tables become social escalation ("we both play daily — let's go live"), not the front door | T-wave deployed |
| G-4 | **Product analytics** — game starts, completions, daily plays, funnel events; plug into Supabase or Plausible | H-4 app_open baseline |
| G-5 | **Euchre IQ** — after each play, diff the human's decision against the bot-optimal move; aggregate into a shareable per-player rating | T-11 (server bot cascade, done) |
| G-6 | **AI Commentary ("The Booth")** — fill the Commentary tab: synthesize `play_events` into per-hand narration (templates first, LLM via server function later) | Event stream (exists) |
| G-7 | **Spectator / replay viewer** — reconstruct any game from `play_events` | `rehydrateState` (exists) |
| G-8 | **Matchmaking queue** — find a game with random players at your skill level; ELO/TrueSkill rating | Real auth, server authority |
| G-9 | **Variant support** — Stick the Dealer, Canadian Loner, configurable house rules per table | Stable rule engine |

---

## Technical Debt Backlog

Items from the June 2026 technical audit not addressed by the T-wave. Prioritize P0s before any new feature work.

### P0 — Fix Now

| ID | Finding | Action |
|---|---|---|
| **Ongoing** | RLS on `games` (T-02 migration) must be confirmed applied to production and coordinated with T-wave deploy | Verify in Supabase dashboard; include in Phase 0 checklist |
| **T-12** | Server-driven phase transitions — trick-clearing, hand-finishing, and next-deal timers still client-side after T-10/T-11 | Move timer progression to the server bot cascade loop; or implement a "tick" action the client sends that the server validates |
| **T-13** | No turn or legality validation in the edge function — any anon caller can play out of turn or act for another seat | Add `validateAction(state, action, requesterId)` check in `process-action/index.ts` before reducing |

### P1 — Next Quarter

| ID | Finding | Action |
|---|---|---|
| **T-15** | Three write paths (server, realtime broadcast, client upsert) still race | After T-12 lands, remove `broadcastDispatch` legacy fallback; clients become read-only subscribers |
| **T-16** | No unit or golden tests for `rules.ts` or the reducers | Add `tests/engine/` with scenario tests for `getBotMove` and full-hand reducer replays; add determinism test for Daily Challenge |
| **P1-5** | No error monitoring | Add Sentry (or Vercel monitoring) to `main.tsx` and the edge function |
| **P2-1** | Migration history is not reproducible | Consolidate `supabase_migrations/` into `supabase/migrations/` with a clean linear history; verify `supabase db reset` reproduces prod schema |

### P2 — When Convenient

| ID | Finding | Action |
|---|---|---|
| **P2-4** | `GameStore.tsx` (697 lines) mixes sync, persistence, bot scheduling, stats, and animation in one component | Extract concerns into focused hooks after Phase 2 ships; don't refactor during feature work |

---

## Metrics

The only metrics that matter for the next 90 days:

| Metric | Today | 90-day target |
|---|---|---|
| People with an active 7-day streak | 0 | **5** |
| Daily hand completions / week | ~0–1 | 25 (5 people × 5 days) |
| Archive hands played by a new user in week 1 | n/a | ≥5 |
| Bot decisions logged / week | **0** (pipeline dead) | 100% of server bot moves |
| Confirmed bot blunders → regression tests | 0 | 10 |
| Living docs in `docs/` | 26 (mostly stale) | 6 |

The March 2026 targets (500 registered users, 50 DAU) were stage-inappropriate and are retired.

---

## Execution Sequence (summary)

```
Phase 0: Resolve T-wave → deploy coordinated unit (code + edge fn + RLS migration)
         ↓
Phase 1: Hygiene week (bot logging, drop backups, FIZZYFEST, app_open, version sync, docs)
         ↓
Phase 2: Numbered hands → archive → streaks → surface reduction   [gate: 5 users × 7-day streak]
         ↓
Phase 3: Par score → Daily Table → bot improvement loop → name claim/recovery
         ↓
Phase 4: Growth features (tournament, PWA, multiplayer renaissance, analytics, Euchre IQ, …)
```

**The one rule:** do not start Phase 4 until the Phase 2 gate is met. Growth features amplify a retention loop; they cannot substitute for one.

---

*Prepared by CTO/Engineering • June 10, 2026 • Grounded in production data from `PRODUCT_STRATEGY_2026H2.md` and technical audit from `002_CTO_TECHNICAL_ROADMAP.md`*
