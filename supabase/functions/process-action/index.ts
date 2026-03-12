import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
// Note: We use the import map to resolve "src/" to the symlinked source directory
import { gameReducerFixed } from "src/store/engine.ts";

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

    // 1. Fetch current state from DB (Source of Truth)
    const { data: game, error: fetchError } = await supabase
      .from("games")
      .select("state")
      .eq("code", tableCode)
      .single();

    if (fetchError || !game) {
      throw new Error(`Game ${tableCode} not found`);
    }

    const currentState = game.state;

    // 2. Authoritative Processing
    // Assign a server version if none exists, or ensure it's at least current + 1
    const nextState = gameReducerFixed(currentState, action);

    // If no state change occurred, it might be a duplicate or invalid action
    if (nextState === currentState && action.type !== 'UPDATE_ANIMATION_DEALER') {
      console.log(`[SERVER] No state change for action ${action.type}. Likely duplicate.`);
      return new Response(JSON.stringify({ success: true, processed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. Persist State
    const { error: updateError } = await supabase
      .from("games")
      .update({ state: nextState })
      .eq("code", tableCode);

    if (updateError) throw updateError;

    // 4. Authoritative Broadcast
    // We broadcast the specific action that triggered the state change
    // Clients will apply it locally to reach the same state
    const channel = supabase.channel(`table-${tableCode}`);
    await channel.send({
      type: "broadcast",
      event: "authoritative_action",
      payload: { 
        action: { 
            ...action, 
            version: nextState.stateVersion // Pass the new server-assigned version
        }, 
        tableCode 
      },
    });

    return new Response(JSON.stringify({ success: true, version: nextState.stateVersion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
