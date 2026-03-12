# process-action Edge Function

This function provides the first phase of **Server-Authoritative Action Processing**.

## How it works
1. Clients send an "intent" (Action) and their `tableCode` to this function.
2. The function fetches the current `GameState` from the `games` table in Supabase.
3. The function validates/processes the action (Phase 1 implementation confirms receipt and updates `updatedAt`).
4. The function broadcasts an `authoritative_action` message back to all clients via Supabase Realtime.
5. Clients receive this broadcast and update their local stores.

## Deployment
To deploy this function, run the following from your local terminal:
```bash
npx supabase functions deploy process-action --import-map supabase/functions/process-action/import_map.json
```

## Shared Logic
The function uses a symlink (`src_link`) to access the project's shared engine logic in `src/store/engine.ts`. When deploying via the Supabase CLI, ensure the import map is correctly linked.

If you encounter Deno import issues (e.g. missing .ts extensions), you may need to bundle the logic using `esbuild` or a similar tool before deployment, or update project imports to be Deno-compatible.
