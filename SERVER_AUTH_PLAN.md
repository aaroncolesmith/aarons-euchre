# [EUC-003] Server-Authoritative Game Engine: Implementation Plan

## Overview
Currently, the Euchre game logic (`gameReducer`, `matchReducer`, etc.) runs fully horizontally on the client browser. One human client (the "Host") computes the bots' moves and acts as the implicit authority, broadcasting the resulting actions to other connected clients via Supabase Realtime channels. 

This leads to several issues:
1. **Network Race Conditions:** If two players click a card at the same time, conflicting states can arise.
2. **Droppability:** If the "Host" player disconnects, bots stop playing.
3. **Cheating:** Clients have full access to opponent hands in the state and can dispatch invalid actions.

**Goal:** Move State reduction entirely to the backend using **Supabase Edge Functions**. The clients will become "dumb terminals" that send intents, while the Server computes the output state and broadcasts it.

## Architecture Change

### 1. The Edge Function (`/supabase/functions/process-action`)
A single Deno endpoint that listens for player actions.
- Client calls `supabase.functions.invoke('process-action', { body: action })`
- Edge Function performs:
  1. Load existing `GameState` from the `active_games` Postgres table.
  2. Verify: Is it actually this player's turn? Is the play valid? 
  3. Apply `gameReducer(state, action)` to construct the new state.
  4. Save the new `GameState` back to Postgres.
  5. Broadcast the updated state/action to clients via Realtime Broadcast.
  6. **Bot Automation Loop**: If the *next* player is a bot, the Edge Function will seamlessly compute the bot's move, wait ~1.2s, apply it, and broadcast. It continues doing this inside a `while` loop until it reaches a human's turn or the hand ends.

### 2. Client Adjustments (`src/store/GameStore.tsx`)
- **Remove local Bot processing**: The `useEffect` running Bot decisions goes away.
- **Redirection of Dispatch**: Calling `dispatch({ type: 'PLAY_CARD' })` on the client no longer directly mutates state. Instead, it fires an HTTP request to the Edge Function.
- **Optimistic UI (Optional)**: To make the game feel fast, the client *can* optimistically apply their own card play locally while the server validates it, but we can start with full server-authoritation (spinners or slight delay on click).
- **Listening to Truth**: The client updates its global state *exclusively* from Edge Function realtime broadcasts or Postgres DB inserts.

## Step-by-Step Execution

### Phase A: Function Scaffolding
- [x] Run `npx supabase init` to create the structure.
- [x] Run `npx supabase functions new process-action` to create the Edge Function.
- [ ] Share types and reducers (`src/types/game.ts` and `src/store/reducers/*`) into the Deno path so the Engine runs the exact same code on the backend. (Using Deno's npm specifiers or import maps).

### Phase B: Building the Engine (`index.ts`)
- [ ] Implement the `process-action` handler.
- [ ] Add the Bot cascade `while` loop logic.
- [ ] Add verification/security checks against JWTs.

### Phase C: Client Migration
- [ ] Modify `GameStore.tsx` to stop listening to raw Action broadcasts and instead listen to Full State broadcasts or specific validated Actions.
- [ ] Hijack the local `broadcastDispatch` to wrap the action in `supabase.functions.invoke`.
- [ ] Clean up redundant local syncing logic.

## Deployment Note
Since Edge Functions run in the Supabase cloud, the user (Aaron) will need to run the deployment command manually via the CLI:
`npx supabase functions deploy process-action`
once we are confident in the scaffold.

---
*Ready to begin executing Phase A & Phase B locally?*
