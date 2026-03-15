# CTO Technical Audit & Roadmap

Date: 2026-03-15
Owner: CTO / Principal Architect

## Executive Summary
We need to move to a single authoritative stats pipeline driven by server-side event sourcing. Local storage must be treated as a cache, not a source of truth. The current “0 games played” symptom is most likely caused by missing server-side game creation/updates, which prevents authoritative event logging and stats refresh from running. This blocks the core retention loop (stats stickiness).

## Product Differentiator
The stats system is the primary retention engine. It must be:
1. Authoritative (server-verified)
2. Durable across devices
3. Recoverable from event logs
4. Performant at scale

## Codebase Deep Dive (Architecture & Flow)
### Game State Flow
1. Client state is updated via `gameReducerFixed` with action idempotency and state versioning.
2. `GameStore.tsx` performs optimistic local updates and invokes `process-action` for server authority.
3. Server function (`supabase/functions/process-action/index.ts`) loads state, applies reducer, logs events, updates `games_auth` and sanitized `games`.

### Stats Flow (Current)
1. Daily challenges: client computes and upserts stats at game end (`GameStore.tsx`).
2. Regular games: stats are derived server-side from `play_events` via `refresh_player_stats_from_events()` and stored in `player_stats`.
3. UI: `StatsView.tsx` only fetches Supabase stats (`getAllPlayerStats`), ignoring local cache.

### Suspected Root Cause for “0 Games Played”
1. Regular games never create a `games` row in Supabase, and `process-action` uses `.update()` (not `upsert`).
2. If `process-action` fails, no `EVENT:hand_result` is logged, and stats never refresh.
3. UI ignores local stats cache, so user sees zeros.

## Technical Audit (Findings)
### P0 – Data Correctness / Stickiness Risk
1. **Stats pipeline not authoritative for regular games.**
   - No guaranteed game creation for regular games, so event sourcing and stats refresh never run.
   - Impact: global stats remain empty or stale.
2. **Stats UI ignores local cache.**
   - Local merged stats are computed but not displayed in StatsView.
   - Impact: user sees “0 games” despite local progress.

### P1 – Scalability / Performance
3. **Leaderboard fetch is unbounded.**
   - `getAllPlayerStats()` pulls entire `player_stats` table.
   - Impact: will degrade at scale; higher latency and cost.
4. **Unbounded full-state growth.**
   - `eventLog`, `logs`, `history`, and `trumpCallLogs` grow in `games_auth`.
   - Impact: large payloads, slower server actions.

### P2 – Resilience / Integrity
5. **Dual event logging paths.**
   - Client logs play events directly; server also logs.
   - Impact: potential duplication or divergence without a strict source of truth.
6. **Identity is name-based only.**
   - Names can collide and overwrite stats.
   - Impact: low integrity and low trust.

## CTO Roadmap (Master Backlog)
### Phase 0 – Immediate Fixes (1–2 weeks)
1. **Server-side game creation and upsert** (Completed)
   - Ensure `games`/`games_auth` rows exist on first action.
   - Switch server update path to `upsert`.
   - Outcome: event logs and stats refresh start working immediately.
2. **Stats UI fallback to merged local+cloud** (Completed)
   - Display local aggregated stats if cloud stats are empty or stale.
   - Outcome: removes the “0 games” UX cliff.
3. **Add stats rebuild endpoint** (Completed)
   - Allow manual/ops-triggered rebuild of `player_stats` from `play_events`.
   - Outcome: recoverability and trust.

### Phase 1 – Architectural Enhancements (2–6 weeks)
4. **Single authoritative stats pipeline**
   - Disable direct client event logging for standard games.
   - Use server-generated `EVENT:hand_result` only.
5. **Stable user identity**
   - Introduce `user_id` (Supabase Auth or internal UUID).
   - Store stats by `user_id`, keep display name separately.
6. **Bounded server state**
   - Cap or trim `eventLog`, `logs`, `history`, `trumpCallLogs` before persistence.
7. **Leaderboard pagination & caching**
   - Provide top-N endpoints with pagination and caching.

### Phase 2 – Strategic Innovation (6–12 weeks)
8. **Stats-driven insights**
   - Player strength profile, call aggressiveness, loner success by seat, dealer bias.
9. **Seasons and progression**
   - Seasonal leaderboards, streaks, and badges.
10. **Shareable game recap**
   - Auto-generate recap from event logs to drive retention/virality.

## Next Decisions Needed
1. Confirm identity direction (Supabase Auth vs internal UUID).
2. Decide whether to prioritize stats pipeline over new feature development for the next sprint.
3. Confirm preferred telemetry/observability tools beyond Supabase tables.
