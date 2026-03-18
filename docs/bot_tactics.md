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

### `protected_left_lead`

- `phase`: `play`
- `position`: `lead`
- `team_context`: `any`
- `statement`: Do not lead the Left Bower while the Right Bower is still unplayed if another reasonable lead exists.
- `why`: The Left is often a future stopper. Leading it too early invites the Right to cover it and burns one of the strongest remaining cards in the deck.
- `trigger`:
  - bot is leading
  - bot holds the Left Bower
  - the Right Bower has not been played yet this hand
  - bot has at least one other valid lead
- `action`: downgrade the Left Bower as a lead candidate rather than auto-playing the highest trump
- `exceptions`:
  - Left is the only valid lead
  - endgame requires cashing the trick immediately
  - no other lead has comparable utility

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
