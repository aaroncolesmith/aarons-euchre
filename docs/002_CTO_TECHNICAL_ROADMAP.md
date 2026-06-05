# 002 — CTO Technical Roadmap & Architecture Direction

**Date:** 2026-06-05
**Owner:** CTO / Principal Architect
**Scope:** Full-codebase technical audit + prioritized engineering backlog
**Supersedes:** `001_CTO_ROADMAP.md`, `CTO_TECH_AUDIT_ROADMAP.md` (2026-03-15). Several items those docs marked "Completed" have since regressed or been bypassed in production; this document is the new source of truth.
**Companion doc:** `product_strategy_brief.md` (CPO, growth lens). This document is the **technical** counterpart — it makes the product brief's roadmap *buildable and safe to ship.*

---

## 1. Executive Summary — The Direction

Aaron's Euchre is a genuinely impressive product: a 743-line expert AI engine with personality archetypes, an event-sourced game model, deterministic daily challenges, and a polished UI. The product brief is right that the business risk is audience size. **But there is a technical risk of equal magnitude that the product brief understates: the multiplayer game loop is structurally fragile, and the "server-authoritative" architecture is half-built.** If we pour growth traffic onto the current foundation, the cracks that today affect 6 friends will become churn-driving outages for 600 strangers.

**My direction in one sentence:** *Finish the migration we already started — move the game loop authority fully to the server — then build growth on top of a foundation that can't freeze, can't be cheated, and can't lose a player's stats.*

The core architectural finding is this: we are paying the **cost** of a server-authoritative system (an edge function, a round-trip on every action, a second `games_auth` table) while still depending on the **fragility** of a client-driven one. Today, one human player's browser is elected "host" and is responsible for shuffling the deck, running every bot's turn, advancing every trick, and recovering from freezes — via a web of `useEffect` timers. The entire `heartbeat.ts` / `antiFreezeWatchdog.ts` / `freezeDebugger.ts` / "Freeze Incidents" apparatus exists to paper over the fact that **game progression depends on a specific browser tab staying open and winning a presence election.** That is the root cause behind the freeze screenshots, the freeze commits, and the freeze tab. We don't need a better watchdog; we need to remove the thing the watchdog is watching.

**Three strategic bets, in order:**

1. **Make the server actually authoritative** (finish EUC-006). The deck, the bots, and trick progression must run server-side. This deletes the entire freeze-recovery subsystem and the host-election fragility in one move. It is also a prerequisite for *every* growth feature in the product brief — async "Table Talk" mode, matchmaking, spectator mode, and anti-cheat all require a server that owns the game.
2. **Establish a single source of truth for identity and stats.** Replace the hardcoded name→ID dictionary with real accounts, lock down the database (clients currently write stats directly with the public key), and make the stats pipeline event-derived and idempotent. This is the prerequisite for "Open Registration," the #1 growth item.
3. **Then, and only then, build the growth loops** from the product brief (share, invite links, Euchre IQ) on a foundation that won't embarrass us at scale.

The good news: the hard intellectual work — the event model, the reducers, the AI — is done and high quality. What remains is **finishing the plumbing and closing the trust boundaries.** This is a 1–2 quarter program, and the first phase pays for itself immediately in reduced support load and deleted code.

---

## 2. Architecture Overview (As-Built)

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT (React + Vite, single bundle)                               │
│                                                                     │
│  GameStore.tsx (697 lines) — the orchestrator                       │
│   ├─ useReducer(gameReducerFixed)  ← pure-ish reducer (engine.ts)   │
│   ├─ serverDispatch()  → supabase.functions.invoke('process-action')│
│   ├─ broadcastDispatch() → realtime channel (legacy fallback)       │
│   ├─ useHostElection() → presence-based "who runs the bots"         │
│   ├─ ~10 useEffects: deal animation, bot turns, trick clearing,     │
│   │                   hand finishing, heartbeat freeze recovery,    │
│   │                   stats save, cloud persistence                 │
│   └─ direct upsert of FULL state → `games` table (debounced 1s)     │
│                                                                     │
└───────────────┬─────────────────────────────────┬───────────────────┘
                │ (a) invoke                       │ (c) direct writes
                ▼                                   ▼
┌──────────────────────────────┐   ┌──────────────────────────────────┐
│ Edge fn: process-action      │   │ Supabase Postgres                 │
│  - loads games_auth.full_state│  │  games_auth (service-role only) ✓ │
│  - gameReducerFixed(s, action)│  │  games (public snapshot)        ✗ │
│  - logs play_events           │   │  play_events                     │
│  - refresh_player_stats RPC   │   │  player_stats   ← client writes ✗ │
│  - upserts games_auth + games │   │  daily_challenge_scores ← client ✗│
│  - broadcasts authoritative   │   │  app_logs / freeze_incidents      │
└──────────────┬───────────────┘   └──────────────────────────────────┘
               │ (b) realtime broadcast
               ▼
        all subscribed clients dispatch(action)

✓ = trust boundary enforced    ✗ = trust boundary OPEN (see §3)
```

**The three write paths (a/b/c) are the central problem.** They are not layered; they race. The same logical state is written by the edge function (authoritative), by realtime action broadcasts (legacy), and by the host client's direct full-state upsert. Idempotency (`actionId`) and version checks (`stateVersion`) mitigate but do not eliminate divergence, and path (c) actively *undoes* the security work done in path (a).

**What's genuinely good and must be protected:**
- `rules.ts` — the AI engine. Expert-level, the product's moat.
- The event-sourced model (`play_events` + reducer replay in `rehydrateGame`). Correct instinct, correctly enables replay/audit/recovery.
- Idempotency + versioning primitives in `gameReducerFixed`. The right bones.
- Playwright e2e harness exists (rare for a project this size).

---

## 3. Technical Audit — Findings

Severity: **P0** = correctness / security / data-loss, fix now · **P1** = scalability / resilience · **P2** = maintainability / velocity.

### P0 — Correctness, Security, Data Integrity

**P0-1 · The deal is not server-authoritative; the anti-cheat claim is false.**
The deck is shuffled and dealt on the *host client* and passed into the action payload (`GameStore.tsx:504-513`, `:527-539`). The server reducer accepts `action.payload.hands` verbatim and only re-deals if the payload is structurally malformed (`matchReducer.ts:6-21`). **Implication:** a modified client can deal itself both bowers every hand, and Daily Challenge "determinism" is enforced only by client honesty — two players can submit different hands for the same date. This nullifies the stated purpose of EUC-006.

**P0-2 · The host client writes full, unsanitized game state (every player's hand) into the public `games` table.**
`GameStore.tsx:271-294` debounces a `supabase.from('games').upsert({ state })` of the *entire* local state, including `players[].hand`. The edge function deliberately strips hands via `sanitizeState()` before writing `games` (`engine.ts:69-84`, used at `process-action/index.ts:133`). Path (c) overwrites that sanitized snapshot with full hands. **Implication:** opponents' cards are readable by anyone who can read the `games` row. The optimistic-UI/anti-cheat design is silently defeated.

**P0-3 · Clients write to `player_stats` and `daily_challenge_scores` directly with the anon key.**
`supabaseStats.ts:232/260/291/481`. Only `games_auth` carries a `service_role`-only RLS policy (`20260311_event_stream_optimization.sql:64`); `daily_challenge_scores` is "Anyone can insert" (`create_daily_challenge_table.sql:34`); no RLS policy ships for `player_stats` or `games`. **Implication:** anyone with the public anon key (shipped in the bundle) can overwrite any player's career stats or any leaderboard score. The retention engine sits on unprotected data.

**P0-4 · The "single authoritative stats pipeline" (marked Completed in the prior roadmap) is bypassed in production.**
Commit `cc40394` ("Bypass broken regular game server sync") plus `GameStore.tsx:360-413` show regular-game stats are now recomputed *client-side* from `player.stats` and written via `saveMultiplePlayerStats`, gated on `isHost`. Stats merge via `Math.max` per-field (`supabaseStats.ts:88+`). **Implication:** `Math.max` merging is lossy and non-additive — two devices finishing games concurrently can drop increments or double-count; a single corrupted local cache poisons the cloud via `max`. We have neither the old client path nor the intended server path working cleanly; we have a fragile hybrid.

**P0-5 · `process-action` authorizes by API key, not by user — and has no turn validation.**
`verify_jwt = true` (`config.toml`) checks only that a valid anon/api key is present; there is no per-user identity (no real auth exists) and the handler never verifies it is actually that player's turn or that the action is legal for that seat (`process-action/index.ts`). The SERVER_AUTH_PLAN's "verify turn / verify JWT" step (Phase B) was never implemented. **Implication:** any anon caller can drive any table's state, play out of turn, or act for another seat.

### P1 — Scalability & Resilience

**P1-1 · Game progression depends on a single client's browser + a presence election.**
Bots, dealing, trick-clearing, and hand-finishing all run in host-gated `useEffect` timers (`GameStore.tsx:484-660`). If the host closes the tab or loses election mid-hand, the game stalls — which is precisely why `heartbeat.ts`, `antiFreezeWatchdog.ts`, `cloudFreezeLogger.ts`, `freezeDebugger.ts`, and the "Freeze Incidents" tab exist. The recovery layer is a band-aid; some recovery actions it dispatches (`FORCE_DEAL`, `AUTO_DISCARD`, `FORCE_BOT_PLAY`) aren't even real reducer cases — they're emulated by toggling step-mode (`heartbeat.ts:162-182`). **This is the #1 resilience bottleneck and the root cause of the freeze class of bugs.**

**P1-2 · The edge function's intended bot-cascade loop was never built.**
`process-action/index.ts` processes exactly one action and returns; there is no "while next player is a bot, advance" loop (SERVER_AUTH_PLAN Phase B). So even with server authority wired up, bots still *must* be driven by the client — we pay the round-trip cost without getting the resilience benefit.

**P1-3 · Unbounded growth in hot paths.**
`getAllPlayerStats()` pulls the entire `player_stats` table for the leaderboard (`supabaseStats.ts`); `euchre_active_games` stores full game states (with hands) in localStorage keyed by code, never pruned (`GameStore.tsx:168-175`); `games_auth.full_state` is capped at 200 entries per array but still carries the whole state on every action.

**P1-4 · Reducer purity is assumed but unenforced — and it runs on two runtimes.**
`gameReducerFixed` runs in both the browser and Deno (via the `src/` import map). It calls `Date.now()` for `lastActive` and `timestamp` fields inside reducers (`engine.ts:55`, `matchReducer.ts:44`), so server-applied and client-optimistic states differ by construction, and any accidental `Math.random()`/`Date` use in a reducer would silently break Daily Challenge determinism. Nothing tests or lints for this.

**P1-5 · No production error monitoring or product analytics.**
Freeze logging is a homegrown table; there is no Sentry/equivalent for unhandled exceptions, and (per the product brief) zero product analytics. We are flying blind on both crashes and funnels.

### P2 — Maintainability & Velocity

**P2-1 · Database migrations are not reproducible.**
`supabase_migrations/` (note: not the standard `supabase/migrations/`) contains `…_all_in_one.sql`, `…_v2`, `…_v3`, `…_fix`, `…_safe` variants of the same migration. There is no linear, idempotent migration history; the database cannot be confidently rebuilt from scratch. Schema is effectively undocumented tribal knowledge.

**P2-2 · Version number is hand-maintained in 3+ places and already drifted.**
`.cursorrules` mandates manual bumps in `package.json`, `App.tsx`, and `LandingPage.tsx`. In-code they already disagree: `App.tsx` says `v1.79`, `GameStore.tsx:266` logs `1.76`, `process-action/index.ts:33` logs `1.69`. Telemetry is therefore mislabeled.

**P2-3 · The reducer is invoked from a symlinked `src_link/` into Deno.** Server build couples directly to client source with no shared, versioned package boundary; a client-only import sneaking into a reducer breaks the edge function at deploy time with no compile-time guard.

**P2-4 · `GameStore.tsx` (697 lines) mixes sync, persistence, bot AI scheduling, stats, freeze recovery, and animation in one component** with ~10 interdependent effects. High cognitive load; the effect dependency arrays (e.g. `[state, isHost, broadcastDispatch]` where `broadcastDispatch` is re-created every render) are a latent bug source.

**P2-5 · No unit/golden tests for the engine.** The crown-jewel `rules.ts` and the reducers have only indirect Playwright coverage. A deterministic, isomorphic engine is the single most testable — and most important-to-test — part of the codebase.

---

## 4. The CTO Roadmap (Master Backlog)

Phased so that each phase de-risks the next. Phase 1 is non-negotiable foundation; it deletes more code than it adds and directly reduces support burden.

### Phase 0 — Stop the Bleeding (Week 1)
*Small, high-confidence fixes that close active security/data holes with no architecture change.*

| ID | Task | Files | Acceptance Criteria | Effort |
|----|------|-------|--------------------|--------|
| **T-01** | Remove the host client's full-state upsert to `games`; rely solely on the edge function's sanitized snapshot. | `GameStore.tsx:271-294` | `games` rows never contain non-empty `players[].hand`. Verified by querying a live game mid-hand. | S |
| **T-02** | Add RLS: `player_stats`, `games`, `daily_challenge_scores` become read-only to anon; all writes go through the service role (edge function/RPC). | new migration | Anon key cannot `upsert` `player_stats` (manual test returns RLS error). Leaderboard still reads. | S |
| **T-03** | Single source of truth for app version: read `package.json` version via Vite `define`; delete the 3 hardcoded strings. | `vite.config.ts`, `App.tsx`, `LandingPage.tsx`, `GameStore.tsx`, edge fn | One constant; `.cursorrules` manual-bump rule retired in favor of `npm version`. | S |
| **T-04** | Consolidate migrations into `supabase/migrations/` with a clean linear history; delete dead `_v2/_v3/_fix/_all_in_one` variants; verify `supabase db reset` reproduces prod schema. | `supabase_migrations/` → `supabase/migrations/` | `supabase db reset` on a clean DB yields a schema matching prod. | M |
| **T-05** | Add Sentry (or equivalent) for client + edge function unhandled errors. | `main.tsx`, edge fn | Forced exception appears in dashboard with release = app version. | S |

### Phase 1 — Finish the Authoritative Engine (Weeks 2–6)
*The keystone. Move game-loop authority fully server-side; delete the freeze subsystem.*

| ID | Task | Notes | Acceptance Criteria | Effort |
|----|------|-------|--------------------|--------|
| **T-10** | **Server-side dealing.** `SET_DEALER` no longer accepts client hands; the edge function generates the deck (seeded for Daily) and hands. Clients receive only their own hand via per-player rehydration from `play_events`. | Closes P0-1. `matchReducer.ts:6`, `GameStore.tsx:484-548`, edge fn | A modified client cannot influence its deal; two clients on the same Daily date get byte-identical hands server-side. | L |
| **T-11** | **Server bot cascade.** Implement the Phase-B loop in `process-action`: after applying a human action, while the next player is a bot (and phase is active), compute the bot move with `rules.ts`, append events, advance — until a human's turn or hand end. | Closes P1-2. Reuses `rules.ts` unchanged. | A game of 1 human + 3 bots completes with the human's tab as the *only* client; no host election involved. | L |
| **T-12** | **Server-driven phase transitions.** Move trick-clearing, hand-finishing, and next-deal timers server-side (scheduled continuation or client "tick" that the server validates). | Removes host-gated effects `GameStore.tsx:550-571` | Closing the host tab mid-hand does not stall the game for remaining players. | M |
| **T-13** | **Turn & legality validation in the edge function.** Reject actions from the wrong seat / illegal plays before reducing. | Closes P0-5 | Out-of-turn `PLAY_CARD` returns 4xx and does not mutate state. | M |
| **T-14** | **Delete the freeze subsystem.** Once T-10–T-13 land, remove `heartbeat.ts`, `antiFreezeWatchdog.ts`, `freezeDebugger.ts`, `cloudFreezeLogger.ts`, the "Freeze Incidents" tab, and the host-recovery effect. | Net code deletion | Freeze-incident rate (now monitored in Sentry) trends to ~0; modules removed; e2e suite green. | M |
| **T-15** | **Collapse the three write paths to one.** Realtime becomes broadcast-only (server→clients); `broadcastDispatch` legacy fallback removed; clients hold no authority. | `GameStore.tsx:71-156` | Only `process-action` writes state; clients are read-only subscribers. | M |
| **T-16** | **Golden tests for the engine.** Unit + snapshot tests for `rules.ts` decisions and full-hand reducer replays; a determinism test that asserts a seeded Daily produces identical event streams across runs. | Closes P1-4, P2-5 | CI runs engine tests on every PR; determinism test guards the Daily Challenge. | M |

### Phase 2 — Identity & Stats You Can Trust (Weeks 6–10)
*Prerequisite for "Open Registration," the #1 growth lever in the product brief.*

| ID | Task | Notes | Acceptance Criteria | Effort |
|----|------|-------|--------------------|--------|
| **T-20** | **Real accounts via Supabase Auth.** Replace the hardcoded `USER_ID_MAP` (`identity.ts`) with `auth.users`; stats keyed by stable `user_id`, display name separate. Migrate the 6 existing users. | Unblocks Open Registration | New email/anon user can sign up and play; stats attach to UUID, survive a name change. | L |
| **T-21** | **Event-derived, idempotent stats.** Stats are computed *only* from `play_events` via the server RPC; delete client-side stat writing (`GameStore.tsx:354-482`) and `Math.max` merging. Make the RPC idempotent (recompute, don't increment). | Closes P0-3/P0-4 | Replaying the same game twice yields identical stats; no client path writes `player_stats`. | M |
| **T-22** | **Paginated / cached leaderboard endpoint.** Top-N RPC with server-side caching; clients stop pulling the full table. | Closes P1-3 | Leaderboard query is O(N) bounded; p95 latency flat as `player_stats` grows. | M |
| **T-23** | **localStorage as cache, not store.** Active games keyed by code are pruned on completion; quota guarded. | `GameStore.tsx:168-175` | localStorage footprint bounded; stale games garbage-collected. | S |

### Phase 3 — Strategic Innovation (Weeks 10+)
*Now safe to build, because the engine is authoritative and identity is real. These map directly to the product brief's differentiators.*

| ID | Task | Strategic Value | Dependency |
|----|------|----------------|------------|
| **T-30** | **Async "Table Talk" mode.** Server owns the game (Phase 1), so a turn can wait hours; notify on turn, bot auto-plays on 24h timeout. *The product brief's single highest-DAU bet.* | Unlocks the "play from anywhere" use case; only possible now that the server runs the loop. | T-11, T-12, PWA push |
| **T-31** | **Euchre IQ.** After each play, the server already computes the bot-optimal move (T-11) — diff the human's play against it and persist a per-decision score. Aggregate into a shareable rating. | The defensible metric only we can compute; high retention + shareability. | T-11, T-21 |
| **T-32** | **AI Commentary ("The Booth").** Fill the empty Commentary tab: synthesize the `play_events` stream into per-hand narration (template first, then LLM via a server function — never expose keys client-side). | Turns solo play into a story; fills a broken promise (empty tab). | event stream (exists) |
| **T-33** | **Invite links + shareable Daily score + PWA.** URL routing for table join, share-card generation, PWA manifest + push. *Growth loops from the product brief — cheap once the foundation is sound.* | Virality + mobile install + async notifications. | T-20 |
| **T-34** | **Spectator / replay viewer.** Reconstruct any game from `play_events` (the `rehydrateState` primitive already exists). | Content + passive engagement; trivially enabled by event sourcing. | server authority |
| **T-35** | **Product analytics instrumentation.** Game starts, completions, daily plays, funnel events. *The product brief correctly flags we can't optimize what we don't measure.* | Decision-making infrastructure. | — |

---

## 5. Prioritized "Start Here" Sequence

For leadership: the order below maximizes risk reduction per week. The first five items are a single sprint and eliminate every open P0.

1. **T-01 / T-02** — close the hand-leak and the open stats-write holes. *(days)*
2. **T-04** — make the database reproducible before we touch it further. *(days)*
3. **T-10 / T-11** — server dealing + server bots. **The keystone.** Everything downstream depends on it. *(2–3 wks)*
4. **T-14** — delete the freeze subsystem; bank the resilience win and the code deletion. *(days, after T-11)*
5. **T-20 / T-21** — real accounts + trustworthy stats → **unblocks Open Registration**, the growth team's #1 ask.
6. Hand off Phase 3 to the product/growth track on the now-solid foundation.

---

## 6. Risks, Trade-offs & Open Decisions

- **Edge-function compute & cold starts.** Moving bots/cascade server-side adds invocations and latency. Mitigation: bots already "think" ~1.2s, so a round-trip is within the UX budget; batch the cascade into one invocation. Decision needed: keep Supabase Edge (Deno) or move the engine to a small dedicated service if cold starts hurt.
- **Migration of the 6 existing users to real auth** must be lossless. One-time backfill script keyed off `USER_ID_MAP`.
- **Determinism contract.** Once dealing is server-side, the seeded RNG and `rules.ts` become a frozen contract for Daily Challenge — T-16's determinism test must gate every engine change.
- **Don't over-rebuild.** The reducers, event model, and AI are good. This roadmap finishes and secures them; it does **not** rewrite them. Resist the urge to greenfield.

**Decisions I need from leadership:**
1. Sign-off to prioritize Phase 1 (foundation) ahead of net-new growth features for one quarter. *Recommended: yes — growth on the current foundation will generate support load faster than revenue.*
2. Auth direction: Supabase Auth (recommended, native + free) vs. custom.
3. Budget for Sentry + a product-analytics tool (both low cost, high leverage).

---

*Prepared by CTO / Principal Architect • 2026-06-05 • Build superior, then scale.*
