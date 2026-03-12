import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// Note: In a real deployment, you'd handle the imports using an import map 
// that points to the shared logic. For now, we'll assume the engine logic
// can be instantiated or we provide a simplified authoritative transition.

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

    // 2. Validation & Processing
    // We would import the gameReducer here. 
    // For this implementation, we'll mark the action as 'intent' and let the 
    // server broadcast it back as 'validated' once saved.
    
    // In a fully authoritative model, we calculate nextState = reducer(currentState, action)
    // and only save/broadcast if nextState !== currentState.
    
    // For now, we update the DB state with the action
    // This acknowledges the move was received by the server.
    const { error: updateError } = await supabase
      .from("games")
      .update({ 
        state: { ...currentState, lastAction: action, updatedAt: Date.now() } 
      })
      .eq("code", tableCode);

    if (updateError) throw updateError;

    // 3. Authoritative Broadcast
    // Instead of clients broadcasting locally, they wait for this.
    const channel = supabase.channel(`table-${tableCode}`);
    await channel.send({
      type: "broadcast",
      event: "authoritative_action",
      payload: { action, tableCode },
    });

    return new Response(JSON.stringify({ success: true, action }), {
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
