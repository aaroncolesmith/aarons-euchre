# CTO Handoffs: Master Backlog for Engineering Agent

Date: 2026-03-11
Owner: CTO / Principal Architect
Scope: Aaron's Euchre (React + TypeScript + Supabase)

## How to Use This Document
- Each task is written as a handoff with goal, scope, and acceptance criteria.
- Work top-down by priority unless blocked.
- When a task touches Supabase, include the SQL migration and update app code.

---

## P0: Immediate Fixes (Stability, Data Integrity, Trust)

### P0-1: Replace Hard Delete with Soft Delete for Games
Goal: Prevent permanent data loss by using `deleted_at` instead of delete.
Scope:
- Update `deleteActiveGame` to update `deleted_at` instead of `.delete()`.
- Ensure any game listings filter on `deleted_at IS NULL`.
- Confirm local storage cleanup remains intact.
Acceptance Criteria:
- Deleting a game removes it from UI but retains row in Supabase with `deleted_at` set.
- No Supabase hard deletes are used for games in app code.
Files:
- `src/store/GameStore.tsx`
- `src/utils/cloudGames.ts`

### P0-2: Fix Daily Challenge Persistence Collision
Goal: Stop cross-user overwrites in `games` table for daily challenge.
Scope:
- Do not persist daily challenge to `games` OR
- Change `tableCode` (and Supabase primary key) to be per-user, e.g. `DAILY-YYYY-MM-DD-<user>`.
- Ensure daily games still resume locally per-user.
Acceptance Criteria:
- Two users can play the same day without overwriting each other’s state.
- The daily experience still appears as “one shared seed” per day.
Files:
- `src/store/reducers/lobbyReducer.ts`
- `src/store/GameStore.tsx`
- `src/components/Lobby/LandingPage.tsx`

### P0-3: Gate Game State Persistence to the Host + Throttle
Goal: Reduce write amplification and avoid stale overwrites.
Scope:
- Only the elected host writes to Supabase.
- Add throttling/debounce (500ms–2000ms) or checkpoint writes (end of trick/hand).
Acceptance Criteria:
- In multiplayer, only the host writes snapshots.
- State writes drop significantly with no sync regressions.
Files:
- `src/store/GameStore.tsx`
- `src/utils/presence.ts`

### P0-4: Wire Heartbeat Freeze Recovery
Goal: Automatically recover from stuck states.
Scope:
- Add a periodic check in `GameStore` using `detectFreeze` and `applyRecovery`.
- Log incidents using `logFreezeToCloud`.
Acceptance Criteria:
- Freeze recovery triggers in simulated stuck states.
- Incidents are logged to Supabase.
Files:
- `src/store/GameStore.tsx`
- `src/utils/heartbeat.ts`

### P0-5: Fix Stats Reporting (Currently All Zero)
Goal: Correctly show real player stats in the UI.
Scope:
- Investigate data path: `player_stats` contents vs. client merge logic.
- Verify `saveMultiplePlayerStats` is called at game over and data is persisted.
- Add visibility logging for stats fetch failures.
- Patch any mismatched localStorage key usage.
Acceptance Criteria:
- Stats populate with non-zero data for known users.
- Stats match actual game outcomes across sessions.
Files:
- `src/store/GameStore.tsx`
- `src/utils/supabaseStats.ts`
- `src/components/common/StatsModal.tsx`

### P0-6: Fix Stats Modal Navigation on Trump Analytics
Goal: Prevent tab navigation from disappearing when inside Trump analytics.
Scope:
- Rework `StatsModal` layout so tabs are sticky or always visible.
- Ensure the Trump analytics view does not cover the tab bar.
Acceptance Criteria:
- Tabs remain visible and usable in all stats subviews.
- Mobile layout still functions without clipping.
Files:
- `src/components/common/StatsModal.tsx`
- `src/components/Stats/TrumpCallsTable.tsx`

### P0-7: Enforce “One Play Per Day” for Hand of the Day
Goal: Prevent replaying the daily challenge more than once per user per day.
Scope:
- Add client-side block (local storage guard).
- Add server-side enforcement using a `daily_scores` or `daily_sessions` table.
- If a user has already completed today, the button shows status + leaderboard.
Acceptance Criteria:
- User cannot replay today’s daily after completion.
- Server-side check prevents bypass via localStorage reset.
Files:
- `src/components/Lobby/LandingPage.tsx`
- `src/store/reducers/lobbyReducer.ts`
- `src/utils/supabaseStats.ts` (or new module)
- `supabase_migrations/*`

---

## P1: Architectural Enhancements (Scalability, Integrity)

### P1-1: Server-Authoritative Action Processing
Goal: Move game validation and state transitions to a server function.
Scope:
- Implement `process-action` edge function to validate actions.
- Clients broadcast intent; server broadcasts authoritative action/state.
Acceptance Criteria:
- Clients cannot forge invalid actions.
- Multiplayer sync remains deterministic and stable.
Files:
- `supabase/functions/process-action/index.ts`
- `src/store/GameStore.tsx`

### P1-2: State Versioning + Idempotency
Goal: Prevent out-of-order or duplicate actions from corrupting state.
Scope:
- Add `stateVersion` to `GameState` and actions.
- Reject stale or duplicate actions.
Acceptance Criteria:
- Reordered actions do not corrupt state.
- Actions are idempotent when re-applied.
Files:
- `src/types/game.ts`
- `src/store/GameStore.tsx`
- `src/store/reducers/*`

### P1-3: Split Snapshot Storage From Event Stream
Goal: Reduce payload size and improve replay fidelity.
Scope:
- Store minimal snapshots, move per-action details to `play_events`.
- Avoid persisting full hands for security.
Acceptance Criteria:
- Reduced `games` table payloads.
- Event stream supports replay and stats derivation.
Files:
- `src/utils/eventLogger.ts`
- `src/store/GameStore.tsx`
- `supabase_migrations/*`

### P1-4: Stats Derived From Events
Goal: Eliminate client-side stats race conditions.
Scope:
- Add a stats aggregation job or SQL view from `play_events`.
- Replace `saveMultiplePlayerStats` write path.
Acceptance Criteria:
- Leaderboard reflects event stream truth.
- No overwrites on concurrent games.
Files:
- `supabase_migrations/*`
- `src/utils/supabaseStats.ts`

### P1-5: Observability Baseline
Goal: Add visibility into errors and freeze incidents.
Scope:
- Add structured logging and error tracking.
- Centralize freeze incident dashboards.
Acceptance Criteria:
- Freeze and sync errors visible in a dashboard.
Files:
- `src/utils/cloudFreezeLogger.ts`
- `src/utils/logger.ts`

---

## P2: Strategic Innovation (Differentiation, Retention)

### P2-1: Verified Daily Challenge Leaderboard
Goal: Daily challenge scores are verifiable and ranked.
Scope:
- Deterministic seed + event stream proof + server validation.
- Leaderboard with daily/weekly/all-time views.
Acceptance Criteria:
- Score is submitted once, verified, and ranked.
- Daily leaderboard is tamper-resistant.

### P2-2: Replay Engine (“Tape Viewer”)
Goal: Replay any game from event stream.
Scope:
- Build a playback UI using `play_events`.
- Add timeline controls, speed, and trick navigation.
Acceptance Criteria:
- Any completed game can be replayed end-to-end.

### P2-3: Win Probability + Coaching Insights
Goal: Provide strategic insights during play and post-game.
Scope:
- Add Monte Carlo simulation service.
- Surface win odds and suggestions.
Acceptance Criteria:
- Real-time win probability shown without performance regression.

---

## New Issues Reported (Add to Active Sprint)

### N-1: Stats Display All Zero
Symptoms:
- Stats show zero despite real play history.
Notes:
- Verify `player_stats` table has data.
- Ensure `saveMultiplePlayerStats` is called and not failing silently.
- Check local storage key mismatch: `euchre_global_stats_v4` vs `LOCAL_STORAGE_KEY`.

### N-2: Stats Modal Tabs Not Visible in Trump Analytics
Symptoms:
- When entering Trump analytics, the tab bar is no longer visible.
Notes:
- Make tabs sticky or adjust layout to prevent overflow clipping.

### N-3: Hand of the Day Replayable
Symptoms:
- Daily challenge can be played multiple times per day.
Notes:
- Add server-side enforcement + client guard.

---

## Optional Supporting Tasks

### S-1: Test User Consistency
Goal: Align `TEST` vs `Peter-Playwright` guidance to avoid data pollution.
Files:
- `docs/START_HERE.md`
- `tests/README.md`
- `src/store/reducers/systemReducer.ts`

### S-2: Reduce Event Log Growth
Goal: Prevent eventLog from bloating game snapshots.
Scope:
- Cap in-memory eventLog length or move to separate storage.
Files:
- `src/store/reducers/matchReducer.ts`
- `src/store/GameStore.tsx`
