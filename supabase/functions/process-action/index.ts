import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { gameReducerFixed, sanitizeState } from "src/store/engine.ts";
import Logger from "src/utils/logger.ts";
import { APP_VERSION } from "src/version.ts";
import { createDeck, shuffleDeck, dealHands } from "src/utils/deck.ts";
import { createDailyRNG } from "src/utils/rng.ts";
import {
  shouldCallTrump,
  shouldGoAlone,
  getBestBid,
  getBotMove,
  getCardValue,
  BOT_PERSONALITIES,
} from "src/utils/rules.ts";
import type { GameState, Action, Card } from "src/types/game.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Generate a fresh dealt hand (seeded for Daily Challenge games). */
function dealForState(state: GameState, tableCode: string): { hands: Card[][]; upcard: Card } {
  const isDaily = state.isDailyChallenge;
  const dailySeed = isDaily
    ? `${tableCode.replace("DAILY-", "")}-hand-${state.handsPlayed}`
    : undefined;
  const deck = shuffleDeck(createDeck(), isDaily ? createDailyRNG(dailySeed!) : undefined);
  const { hands, kitty } = dealHands(deck);
  return { hands, upcard: kitty[0] };
}

/** Cards played so far this hand, extracted from the event log. */
function getPlayedCardsThisHand(eventLog: GameState["eventLog"]): Card[] {
  const lastHandResultIndex = [...eventLog]
    .reverse()
    .findIndex((e) => e.type === "hand_result");
  const startIndex =
    lastHandResultIndex === -1 ? 0 : eventLog.length - lastHandResultIndex;
  return eventLog
    .slice(startIndex)
    .filter((e): e is Extract<GameState["eventLog"][number], { type: "play" }> => e.type === "play")
    .map((e) => e.card);
}

/** Compute the next action a bot should take given the current state. */
function computeBotAction(state: GameState): Action | null {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer?.isComputer) return null;

  const personality =
    currentPlayer.personality ||
    BOT_PERSONALITIES[currentPlayer.name || ""] || {
      aggressiveness: 5,
      riskTolerance: 5,
      consistency: 5,
      archetype: "Generic",
    };
  const position = (state.currentPlayerIndex - state.dealerIndex + 4) % 4;

  if (state.phase === "bidding") {
    if (state.biddingRound === 1 && state.upcard) {
      const result = shouldCallTrump(
        currentPlayer.hand,
        state.upcard.suit,
        personality,
        position,
        false,
        null,
        { scores: state.scores, myIndex: state.currentPlayerIndex }
      );
      if (result.call) {
        const lonerCheck = shouldGoAlone(currentPlayer.hand, state.upcard.suit, personality);
        return {
          type: "MAKE_BID",
          payload: {
            suit: state.upcard.suit,
            callerIndex: state.currentPlayerIndex,
            isLoner: lonerCheck.goAlone,
            reasoning: result.reasoning,
          },
        } as Action;
      }
      return {
        type: "PASS_BID",
        payload: { playerIndex: state.currentPlayerIndex, reasoning: result.reasoning },
      } as Action;
    } else if (state.biddingRound === 2) {
      const filteredHand = currentPlayer.hand.filter(
        (c) => state.upcard && c.suit !== state.upcard.suit
      );
      const result = getBestBid(
        filteredHand,
        personality,
        position,
        true,
        state.upcard?.suit || null,
        { scores: state.scores, myIndex: state.currentPlayerIndex }
      );
      if (result.suit) {
        const lonerCheck = shouldGoAlone(currentPlayer.hand, result.suit, personality);
        return {
          type: "MAKE_BID",
          payload: {
            suit: result.suit,
            callerIndex: state.currentPlayerIndex,
            isLoner: lonerCheck.goAlone,
            reasoning: result.reasoning,
          },
        } as Action;
      } else if (state.currentPlayerIndex === state.dealerIndex) {
        return {
          type: "MAKE_BID",
          payload: {
            suit: result.bestSuitAnyway,
            callerIndex: state.currentPlayerIndex,
            isLoner: false,
            reasoning: "Stuck dealer",
          },
        } as Action;
      }
      return {
        type: "PASS_BID",
        payload: { playerIndex: state.currentPlayerIndex, reasoning: result.reasoning },
      } as Action;
    }
  } else if (state.phase === "discard") {
    const cardToDiscard = [...currentPlayer.hand].sort(
      (a, b) => getCardValue(a, state.trump, null) - getCardValue(b, state.trump, null)
    )[0];
    return {
      type: "DISCARD_CARD",
      payload: { playerIndex: state.currentPlayerIndex, cardId: cardToDiscard.id },
    } as Action;
  } else if (state.phase === "playing") {
    const playedCardsThisHand = getPlayedCardsThisHand(state.eventLog);
    const result = getBotMove(
      currentPlayer.hand,
      state.currentTrick,
      state.trump!,
      state.players.map((p) => p.id),
      currentPlayer.id,
      state.trumpCallerIndex,
      personality,
      { playedCardsThisHand }
    );
    return {
      type: "PLAY_CARD",
      payload: {
        playerIndex: state.currentPlayerIndex,
        cardId: result.card.id,
        reasoning: result.reasoning,
      },
    } as Action;
  }

  return null;
}

/** Build the play_events rows for a single applied action. */
function buildEventRows(
  action: Action,
  prevState: GameState,
  nextState: GameState,
  tableCode: string
): object[] {
  const rows: object[] = [
    {
      game_code: tableCode,
      state_version: nextState.stateVersion,
      hand_number: nextState.handsPlayed || 0,
      trick_number: nextState.currentTrick?.length || 0,
      action_type: action.type,
      action_payload: action,
      actor_name:
        (action as any).payload?.userName ||
        (action as any).payload?.name ||
        "System",
      actor_seat:
        (action as any).payload?.playerIndex ??
        (action as any).payload?.seatIndex ??
        null,
    },
  ];

  const newEvents = nextState.eventLog.slice(prevState.eventLog?.length || 0);
  for (const ev of newEvents) {
    rows.push({
      game_code: tableCode,
      state_version: nextState.stateVersion,
      hand_number: nextState.handsPlayed || 0,
      trick_number: nextState.currentTrick?.length || 0,
      action_type: `EVENT:${ev.type}`,
      action_payload: ev,
      actor_name: "System",
      actor_seat: null,
    });
  }

  return rows;
}

// ─── Timing constants ─────────────────────────────────────────────────────────
// These control how long the server waits before advancing game phases.
// Smaller than the original client timers (1200ms bots, 3000ms trick clear,
// 2000ms scoring) because broadcast latency adds natural delay.
const BOT_DELAY_MS = 700;
const TRICK_CLEAR_DELAY_MS = 1800;
const SCORE_DELAY_MS = 900;
const DEAL_DELAY_MS = 600;
const MAX_CASCADE_STEPS = 40; // Safety limit

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action: rawAction, tableCode, bootstrapState } = await req.json();

    if (!tableCode || !rawAction) {
      throw new Error("Missing tableCode or action");
    }

    Logger.setMetadata({ tableCode, environment: "server", appVersion: APP_VERSION });

    // ── Special action: SUBMIT_DAILY_SCORE ─────────────────────────────────────
    if (rawAction.type === "SUBMIT_DAILY_SCORE") {
      const score = rawAction.payload;
      const { error } = await supabase
        .from("daily_challenge_scores")
        .upsert(score, { onConflict: "date_string,player_name" });

      if (error) {
        Logger.error("[SERVER] SUBMIT_DAILY_SCORE error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ── Special action: SYNC_PLAYER_STATS ─────────────────────────────────────
    // Atomic per-game stat increment for Daily Challenge games (which run
    // client-side and don't pass through the normal game loop).  The payload
    // contains each player's in-game delta; the DB increments atomically so
    // concurrent games on different devices can't clobber each other.
    if (rawAction.type === "SYNC_PLAYER_STATS") {
      const { playerDeltas } = rawAction.payload as {
        playerDeltas: Array<{
          name: string;
          gamesPlayed: number; gamesWon: number;
          handsPlayed: number; handsWon: number;
          tricksPlayed: number; tricksTaken: number; tricksWonTeam: number;
          callsMade: number; callsWon: number;
          lonersAttempted: number; lonersWon: number;
          pointsScored: number; euchresMade: number; euchred: number;
          sweeps: number; swept: number;
        }>;
      };

      const errs: string[] = [];
      for (const delta of playerDeltas) {
        const { error } = await supabase.rpc("increment_player_stats", {
          p_name:             delta.name,
          p_games_played:     delta.gamesPlayed    || 0,
          p_games_won:        delta.gamesWon        || 0,
          p_hands_played:     delta.handsPlayed     || 0,
          p_hands_won:        delta.handsWon        || 0,
          p_tricks_played:    delta.tricksPlayed    || 0,
          p_tricks_taken:     delta.tricksTaken     || 0,
          p_tricks_won_team:  delta.tricksWonTeam   || 0,
          p_calls_made:       delta.callsMade       || 0,
          p_calls_won:        delta.callsWon        || 0,
          p_loners_attempted: delta.lonersAttempted || 0,
          p_loners_converted: delta.lonersWon       || 0,
          p_points_scored:    delta.pointsScored    || 0,
          p_euchres_made:     delta.euchresMade     || 0,
          p_euchred:          delta.euchred         || 0,
          p_sweeps:           delta.sweeps          || 0,
          p_swept:            delta.swept           || 0,
        });
        if (error) {
          Logger.error(`[SERVER] increment_player_stats error for ${delta.name}:`, error);
          errs.push(`${delta.name}: ${error.message}`);
        }
      }

      if (errs.length > 0) {
        return new Response(JSON.stringify({ error: errs.join("; ") }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ── Load current state ─────────────────────────────────────────────────────
    let { data: authGame, error: authError } = await supabase
      .from("games_auth")
      .select("full_state")
      .eq("game_code", tableCode)
      .single();

    let currentState: GameState;
    if (authError || !authGame) {
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("state")
        .eq("code", tableCode)
        .single();

      if (gameError || !game) {
        if (!bootstrapState) throw new Error(`Game ${tableCode} not found`);
        currentState = bootstrapState;
      } else {
        currentState = bootstrapState || game.state;
      }
    } else {
      currentState = authGame.full_state;
    }

    // ── T-10: Enrich SET_DEALER with server-generated hands ───────────────────
    // The client sends only the dealerIndex; the server generates the deck
    // deterministically so no client can rig the deal.
    let action: Action = rawAction;
    if (action.type === "SET_DEALER" && !(action as any).payload?.hands) {
      const { hands, upcard } = dealForState(currentState, tableCode);
      action = {
        ...action,
        payload: { ...(action as any).payload, hands, upcard },
      } as Action;
      Logger.info(`[T-10] Server generated deal for hand ${currentState.handsPlayed}`);
    }

    // ── Apply the initial action ───────────────────────────────────────────────
    let state = gameReducerFixed(currentState, action);

    if (state === currentState && action.type !== "UPDATE_ANIMATION_DEALER") {
      Logger.info(`[SERVER] No state change for ${action.type}. Skipping.`);
      return new Response(JSON.stringify({ success: true, processed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Channel for all broadcasts in this request
    const channel = supabase.channel(`table-${tableCode}`);

    // Collect all event rows for a single batch insert at the end
    const allEventRows: object[] = buildEventRows(action, currentState, state, tableCode);

    // Broadcast the initial action (enriched with hands if SET_DEALER)
    await channel.send({
      type: "broadcast",
      event: "authoritative_action",
      payload: {
        action: { ...action, version: state.stateVersion },
        tableCode,
      },
    });

    // ── T-11: Bot cascade ─────────────────────────────────────────────────────
    // After each action, advance the game through bot moves and phase
    // transitions until a human's turn is required or the game ends.
    // This replaces the host-client useEffect timers and the freeze-recovery
    // watchdog for regular multiplayer games.
    const isMultiplayer =
      !!tableCode && !tableCode.startsWith("DAILY-") &&
      !state.players.every((p) => p.isComputer);

    if (isMultiplayer) {
      for (let step = 0; step < MAX_CASCADE_STEPS; step++) {
        const phase = state.phase;

        // Terminal states — stop cascade
        if (
          phase === "game_over" ||
          phase === "landing" ||
          phase === "lobby" ||
          phase === "login" ||
          phase === "randomizing_dealer"
        ) {
          break;
        }

        let nextAction: Action | null = null;
        let delay = 0;

        if (phase === "waiting_for_trick") {
          delay = TRICK_CLEAR_DELAY_MS;
          nextAction = { type: "CLEAR_TRICK" } as Action;
        } else if (phase === "scoring") {
          delay = SCORE_DELAY_MS;
          nextAction = { type: "FINISH_HAND" } as Action;
        } else if (phase === "waiting_for_next_deal") {
          delay = DEAL_DELAY_MS;
          const { hands, upcard } = dealForState(state, tableCode);
          nextAction = {
            type: "SET_DEALER",
            payload: { dealerIndex: state.dealerIndex, hands, upcard },
          } as Action;
        } else {
          // Active game phase — check if current player is a bot
          const currentPlayer = state.players[state.currentPlayerIndex];
          if (!currentPlayer?.isComputer) break; // Human's turn — stop

          delay = BOT_DELAY_MS;
          nextAction = computeBotAction(state);
          if (!nextAction) {
            Logger.warn(`[CASCADE] Could not compute bot action in phase ${phase}`);
            break;
          }
        }

        await new Promise((r) => setTimeout(r, delay));

        const cascadeAction: Action = {
          ...nextAction!,
          actionId: generateId(),
        };

        const prevState = state;
        state = gameReducerFixed(state, cascadeAction);

        if (state === prevState) {
          Logger.warn(`[CASCADE] No state change for ${cascadeAction.type}, stopping`);
          break;
        }

        allEventRows.push(...buildEventRows(cascadeAction, prevState, state, tableCode));

        await channel.send({
          type: "broadcast",
          event: "authoritative_action",
          payload: {
            action: { ...cascadeAction, version: state.stateVersion },
            tableCode,
          },
        });

        Logger.debug(`[CASCADE step ${step}] ${cascadeAction.type} → phase: ${state.phase}`);

        if (state.phase === "game_over") break;
      }
    }

    // ── Batch persist events ───────────────────────────────────────────────────
    if (allEventRows.length > 0) {
      const { error: eventError } = await supabase
        .from("play_events")
        .insert(allEventRows);
      if (eventError) Logger.error("[SERVER] Event logging error:", eventError);
    }

    // Refresh materialized player stats if any hand completed
    const hasHandResult = allEventRows.some(
      (r: any) => r.action_type === "EVENT:hand_result"
    );
    if (hasHandResult) {
      const { error: refreshError } = await supabase.rpc("refresh_player_stats_from_events");
      if (refreshError) Logger.error("[SERVER] Stats refresh error:", refreshError);
    }

    // ── Persist final state ────────────────────────────────────────────────────
    const cappedState = {
      ...state,
      logs: Array.isArray(state.logs) ? state.logs.slice(0, 200) : state.logs,
      eventLog: Array.isArray(state.eventLog) ? state.eventLog.slice(-200) : state.eventLog,
      trumpCallLogs: Array.isArray(state.trumpCallLogs)
        ? state.trumpCallLogs.slice(-200)
        : state.trumpCallLogs,
    };

    const { error: authUpdateError } = await supabase.from("games_auth").upsert({
      game_code: tableCode,
      full_state: cappedState,
      updated_at: new Date().toISOString(),
    });
    if (authUpdateError) throw authUpdateError;

    const sanitizedSnapshot = sanitizeState(cappedState);
    const { error: updateError } = await supabase.from("games").upsert(
      { code: tableCode, state: sanitizedSnapshot, updated_at: new Date().toISOString() },
      { onConflict: "code" }
    );
    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, version: state.stateVersion }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    Logger.error(`[SERVER ERROR] ${err.message}`, { stack: err.stack });
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
