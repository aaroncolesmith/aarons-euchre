import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
// Note: We use the import map to resolve "src/" to the symlinked source directory
import { gameReducerFixed, sanitizeState } from "src/store/engine.ts";
import Logger from "src/utils/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; 
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, tableCode } = await req.json();

    if (!tableCode || !action) {
      throw new Error("Missing tableCode or action");
    }

    // Set Logger metadata for this request
    Logger.setMetadata({
        tableCode,
        environment: 'server',
        appVersion: '1.54'
    });

    // 1. Fetch current FULL state from games_auth (Source of Truth)
    // ... rest of the code ...
    let { data: authGame, error: authError } = await supabase
      .from("games_auth")
      .select("full_state")
      .eq("game_code", tableCode)
      .single();

    let currentState;
    if (authError || !authGame) {
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("state")
        .eq("code", tableCode)
        .single();
      
      if (gameError || !game) throw new Error(`Game ${tableCode} not found`);
      currentState = game.state;
    } else {
      currentState = authGame.full_state;
    }

    // 2. Authoritative Processing
    const nextState = gameReducerFixed(currentState, action);

    // If no state change occurred, skip persistence (unless it's a non-state action)
    if (nextState === currentState && !['UPDATE_ANIMATION_DEALER'].includes(action.type)) {
      console.log(`[SERVER] No state change for action ${action.type}. Skipping update.`);
      return new Response(JSON.stringify({ success: true, processed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. Persist Event Stream (Intent + Outcomes)
    const eventsToLog = [
      {
        game_code: tableCode,
        state_version: nextState.stateVersion,
        hand_number: nextState.handsPlayed || 0,
        trick_number: (nextState.currentTrick?.length || 0),
        action_type: action.type,
        action_payload: action,
        actor_name: action.payload?.userName || action.payload?.name || 'System',
        actor_seat: action.payload?.playerIndex ?? action.payload?.seatIndex
      }
    ];

    // Add new internal events (outcomes)
    const newEvents = nextState.eventLog.slice(currentState.eventLog?.length || 0);
    newEvents.forEach((ev: any) => {
      eventsToLog.push({
        game_code: tableCode,
        state_version: nextState.stateVersion,
        hand_number: nextState.handsPlayed || 0,
        trick_number: (nextState.currentTrick?.length || 0),
        action_type: `EVENT:${ev.type}`,
        action_payload: ev,
        actor_name: 'System',
        actor_seat: null
      });
    });

    const { error: eventError } = await supabase
      .from("play_events")
      .insert(eventsToLog);
    
    if (eventError) Logger.error("[SERVER] Event logging error:", eventError);

    // If we just logged a hand result, refresh the materialized stats
    const hasHandResult = newEvents.some((ev: any) => ev.type === 'hand_result');
    if (hasHandResult) {
      const { error: refreshError } = await supabase.rpc('refresh_player_stats_from_events');
      if (refreshError) Logger.error("[SERVER] Stats refresh error:", refreshError);
    }

    // 4. Update FULL State (Private)
    const { error: authUpdateError } = await supabase
      .from("games_auth")
      .upsert({ 
        game_code: tableCode, 
        full_state: nextState,
        updated_at: new Date().toISOString()
      });
    if (authUpdateError) throw authUpdateError;

    // 5. Update MINIMAL Snapshot (Public & Broadcast)
    const sanitizedSnapshot = sanitizeState(nextState);
    const { error: updateError } = await supabase
      .from("games")
      .update({ state: sanitizedSnapshot })
      .eq("code", tableCode);
    if (updateError) throw updateError;

    // 6. Authoritative Broadcast
    const channel = supabase.channel(`table-${tableCode}`);
    await channel.send({
      type: "broadcast",
      event: "authoritative_action",
      payload: { 
        action: { 
            ...action, 
            version: nextState.stateVersion
        }, 
        tableCode 
      },
    });

    return new Response(JSON.stringify({ success: true, version: nextState.stateVersion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    Logger.error(`[SERVER ERROR] ${err.message}`, { stack: err.stack });
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
