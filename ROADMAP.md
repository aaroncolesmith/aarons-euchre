# Euchre Game Roadmap

## Vision
A beautiful, refined, and addictive Euchre game with a "Robinhood-style" premium aesthetic, featuring robust single-player AI, deep statistical tracking, and a scalable architecture supporting multiple tables and diverse player/bot configurations.

## Milestones

### Milestone 1: Project Foundation & Core Engine ✅ COMPLETE
**Goal:** Establish the codebase and the fundamental rules of Euchre.
- [x] Initialize React + TypeScript + Vite project.
- [x] Set up the "Premium" design system (Variables, CSS baseline, Typography).
- [x] Implement Core Logic:
    - Deck generation (standard 24 card deck).
    - Card ranking logic (standard + trump + left bower nuances).
    - Shuffling and Dealing algorithms.
- [x] Basic Debug Logging infrastructure.

### Milestone 2: Single Player Game Loop ✅ COMPLETE
**Goal:** A playable game against computer bots.
- [x] **Game State Manager**: Handling phases (Bidding, Playing, Scoring).
- [x] **Advanced AI (v1)**: Strategic trick-playing (ruffing, partner-awareness).
- [x] **UI Components**:
    - Table Commentary sidebar for play-by-play.
    - Hand Sorting (Suit-based + Trump prioritization).
    - Dynamic Scoreboard.
- [x] **Rule Enforcement**: Preventing illegal moves.

### Milestone 3: Universal Profiles & Analytics ✅ COMPLETE
**Goal:** Establish sophisticated data collection for both human and bot players.
- [x] **Global Profile Registry**: Unified storage for humans and bots.
- [x] **Deep Stats**:
    - [x] Games Played/Won.
    - [x] Hands Won.
    - [x] Tricks Played/Won & Trick Win %.
    - [x] Call success/Euchre rates.
- [x] **Data Architecture**:
    - [x] Transition to a normalized event-based data log (save every card played and bid made).
    - [x] Enable table-specific history exports for analysis.
- [x] **League Leaderboard**: Enhanced Hall of Fame with sortable metrics across all registered profiles.

### Milestone 4: Multi-Table Lobby & Table Management ✅ COMPLETE
**Goal:** Support the "Create/Join" flow and flexible player seating.
- [x] **Landing Page**:
    - [x] Create Table button (Generates random name + Triple-Triple code, e.g., `243-679`).
    - [x] Join Table via Code input.
    - [x] "Continue Existing Game" list for persistent sessions.
- [x] **The "Pre-Game Lounge"**:
    - [x] Four-seat visual layout where players can "Sit".
    - [x] Seat availability logic (Humans/Bots).
    - [x] "Add Bot" selector.
- [x] **Bot Resource Management**: Basic bot registry and unique naming.
- [x] **Table Metadata**: Support for various team configurations (Human+Human, Human+Bot, etc.).

### Milestone 5: Multiplayer Sync & Persistence 🔄 IN PROGRESS
**Goal:** Connect real players across sessions.
- [x] **User Identity**:
    - [x] Simple login with whitelisted usernames (Aaron/Polina).
    - [x] Local persistence of user session.
- [ ] **Real-time Backend Integration**:
    - [ ] Transition from `localStorage` to a centralized DB (Supabase/Firebase).
    - [ ] WebSocket/PubSub for live table synchronization.
- [ ] **ELO & Ranking**: Competitive ranking based on performance against various bot/human difficulties.
- [ ] **Analytical Replay**: Use the `eventLog` to provide a visual playback of previous trick sequences.

### Milestone 6: "Premium" Polish & Visual Wow 🔄 IN PROGRESS
**Goal:** Finalize the aesthetic to "Apple/Robinhood" standards.
- [x] **Visual Clarity**:
    - [x] Perspective-aware table rotation (User always at bottom).
    - [x] Relative card orientation (Facing the player who played it).
    - [x] Natural card jitter/tilt on the table.
- [x] **Game Feedback**:
    - [x] Dedicated Hand Complete summaries.
    - [x] Trump Caller "Caller" badge.
    - [x] Dealer "D" badge logic.
- [x] **Aesthetics Upgrade**:
    - [x] Glassmorphism effects for all panels.
    - [x] Smooth 60fps card transitions and dealing animations.
    - [x] Micro-animations for bidding choices.
- [ ] **Advanced Intelligence**:
    - [ ] "Risk Profile" calculation (Aggression Score based on bid strength).
    - [ ] Predictive Win Probabilities during trick play.
- [ ] **Performance & SEO**:
    - [ ] Optimized bundle size.
    - [ ] Full Meta-tag support.
