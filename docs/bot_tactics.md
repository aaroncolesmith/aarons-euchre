# Bot Tactics

This file is the human-readable catalog for tactical play rules that should exist in bot logic.

Each rule should have:

- `id`: stable identifier used in code and tests
- `phase`: `bidding`, `discard`, or `play`
- `position`: `lead`, `second`, `third`, `fourth`, or `any`
- `team_context`: `maker`, `partner_of_maker`, `defender`, or `any`
- `statement`: plain-English rule
- `why`: tactical purpose
- `trigger`: exact board-state conditions
- `action`: what the bot should prefer, avoid, or require
- `exceptions`: cases where the rule should not fire

## Play Rules

### `protect_non_boss_trump_lead`

- `phase`: `play`
- `position`: `lead`
- `team_context`: `any`
- `statement`: Do not lead a trump card that is not currently boss if a non-trump lead exists.
- `why`: A vulnerable bower or trump Ace often gets covered by a higher outstanding trump, turning one of your strongest cards into a wasted lead.
- `trigger`:
  - bot is leading
  - bot has at least one non-trump alternative
  - candidate lead is trump
  - a higher trump is still outstanding and not in the bot's hand
- `action`: downgrade that trump lead candidate
- `exceptions`:
  - trump is boss
  - trump is the only viable lead
  - endgame requires cashing the trick immediately

### `partner_called_trump_lead_ace`

- `phase`: `play`
- `position`: `lead`
- `team_context`: `partner_of_maker`
- `statement`: If partner called trump, prefer leading an off-suit Ace and avoid leading trump.
- `why`: This pressures the defense without stripping partner's trump control.
- `trigger`:
  - bot is leading
  - partner called trump
  - bot has at least one off-suit Ace
- `action`: heavily prefer the off-suit Ace and downgrade trump leads
- `exceptions`:
  - no off-suit Ace exists
  - bot is forced into a trump-only lead

### `opponents_called_trump_singleton_lead`

- `phase`: `play`
- `position`: `lead`
- `team_context`: `defender`
- `statement`: Against the makers, prefer leading a singleton off-suit card.
- `why`: This helps create a void quickly so the defender can ruff later.
- `trigger`:
  - bot is leading
  - opponents called trump
  - bot holds a singleton non-trump suit
- `action`: prefer singleton off-suit leads
- `exceptions`:
  - no singleton off-suit exists
  - a stronger tactical lead is clearly available

### `second_hand_low`

- `phase`: `play`
- `position`: `second`
- `team_context`: `defender`
- `statement`: As second hand on defense, usually play low rather than spending a winner on an early trick.
- `why`: This preserves control cards for later and lets partner decide the trick from fourth seat.
- `trigger`:
  - bot is second to act
  - bot is defending
  - lead is not a major trump threat
- `action`: strongly prefer the lowest valid card
- `exceptions`:
  - covering an honor is necessary
  - the bot must take control now to prevent a cheap maker trick

## Implementation Notes

- Rules should be executable, not just descriptive.
- Each rule should emit a stable reason string that can appear in bot audit history.
- Generic card ranking is the fallback. Tactical rules should adjust or constrain candidate scoring before final selection.

## Bidding Concepts

- `next_call_bonus`: Seat 1 in round 2 should be more willing to call the same-color suit after a turn-down.
- `reverse_next_bonus`: Seat 2 in round 2 should be more willing to call opposite-color suits after Seat 1 passes.
- `desperation_mode`: When opponents are at 8 or 9, lower calling thresholds.
- `donate`: At `9-6` or `9-7`, Seat 1 can force the upcard to block a game-ending dealer loner.
