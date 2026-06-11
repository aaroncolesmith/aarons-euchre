# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server at http://localhost:5173
npm run build        # tsc + vite build → dist/
npm run lint         # ESLint (max-warnings 0 — must be clean)
npm run test         # Playwright tests (headless, auto-starts dev server)
npm run test:headed  # Playwright with browser visible
npm run test:ui      # Playwright interactive UI mode
npm run test:debug   # Playwright with debugger
```

Run a single test file:
```bash
npx playwright test tests/euchre.spec.ts
npx playwright test tests/euchre.spec.ts --headed
```

## Versioning — REQUIRED on every commit

After every code change, bump the patch version:
```bash
npm version patch --no-git-tag-version
```

Then update `src/version.ts` manually to match (it drives the in-app display):
```ts
export const APP_VERSION = '1.XX';
```

The version is imported by `App.tsx` and shown in the UI footer. Do not skip this step.

## Architecture

**Stack:** React 18 + TypeScript, Vite, Tailwind CSS, Framer Motion, Supabase (Realtime + PostgreSQL), deployed on Vercel.

### State management

All game state lives in a single `useReducer` managed by `GameProvider` (`src/store/GameStore.tsx`). The reducer is split across:

- `src/store/engine.ts` — top-level dispatcher + idempotency/version-check wrapper (`gameReducerFixed`)
- `src/store/reducers/lobbyReducer.ts` — seat management, table creation/join
- `src/store/reducers/matchReducer.ts` — dealing, bidding, card play
- `src/store/reducers/scoringReducer.ts` — trick/hand/game scoring
- `src/store/reducers/systemReducer.ts` — stats, UI overlays, misc

**The reducer must be a pure function.** No random data inside reducers — generate it in `useEffect` and pass it as action payload.

### Multiplayer synchronization

Game-changing actions go through `serverDispatch` (in `GameStore.tsx`), which posts to a Supabase Edge Function acting as the authoritative server. The server writes the new state to the `games` table; all clients receive the update via Supabase Realtime (broadcast on channel `table-{tableCode}`).

**Critical rule:** Use `serverDispatch` for all game actions. Only use raw `dispatch` for local-only actions: `LOGIN`, `LOGOUT`, `LOAD_GLOBAL_STATS`, `CLEAR_HISTORY`.

Host election (`src/utils/presence.ts`) uses Supabase Presence to determine which connected client is "host" (alphabetically first player name). Bots only run on the host to avoid duplicate moves.

### Game phases

```
login → landing → lobby → randomizing_dealer → bidding →
discard (round 1 only) → playing → waiting_for_trick →
scoring → waiting_for_next_deal → bidding (next hand)
```

Daily Challenge games use `tableCode` prefixed `DAILY-` and run fully client-side (no presence channel, local user is always host).

### Event sourcing

Every meaningful game action is appended to `play_events` in Supabase. Player stats (`player_stats` table) are derived from these events — **never write stats client-side directly**. Use `src/utils/eventLogger.ts` to log events and `src/utils/supabaseStats.ts` to read/sync stats.

### Key files

| File | Purpose |
|---|---|
| `src/types/game.ts` | All TypeScript types (`GameState`, `Action`, `Card`, `Player`, etc.) |
| `src/utils/rules.ts` | Euchre rules: card ranking, bot AI (`getBotMove`, `shouldCallTrump`), legal-move enforcement |
| `src/utils/deck.ts` | Deck creation, shuffle, deal |
| `src/utils/identity.ts` | Stable player UUID generation (persisted in localStorage) |
| `src/utils/rng.ts` | Deterministic RNG for Daily Challenge seeds |
| `src/utils/supabaseStats.ts` | Leaderboard read/write; `LOCAL_STORAGE_KEY` for caching |
| `src/lib/supabase.ts` | Supabase client (reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) |

## Styling

The app uses a semantic theme system — always use theme tokens, never raw Tailwind color classes:

| Token | Use |
|---|---|
| `bg-paper` / `bg-paper-dim` | Backgrounds |
| `text-ink` / `text-ink-dim` | Text |
| `brand-primary` / `brand-secondary` | Actions, highlights |
| `font-hand` | Handwriting font ("Architects Daughter") |
| `shadow-sketch-ink` / `shadow-sketch-brand` | Hard-offset sketchy shadows |

To change the color scheme, edit the CSS variables in `src/index.css` `:root`. Never hardcode colors.

## Testing

- Playwright tests live in `tests/`. The dev server starts automatically before tests run.
- **Always use the `TEST` user** for automated tests — never `Aaron` or other real users, to keep production stats clean.
- Tests run only in Chromium by default (`playwright.config.ts`).
- The `archive/tests/` directory contains retired test iterations — do not run those.

## Environment variables

```bash
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]
```

## Database

Supabase tables (apply migrations from `supabase_migrations/` in Supabase SQL Editor):

- `games` — live game state (JSONB blob keyed by table code)
- `play_events` — append-only event log (source of truth for stats)
- `player_stats` — aggregated stats derived from events
- `trump_calls` — trump call history for analytics

Retired/archive migrations are in `archive/archive_migrations_v1/` and `archive/archive_migrations_v2/` — do not re-apply.
