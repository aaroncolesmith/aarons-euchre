# 001 CTO ROADMAP & SOURCE OF TRUTH

## Vision
A beautiful, refined, and addictive Euchre game with a "Robinhood-style" premium aesthetic, featuring robust single-player AI, deep statistical tracking, and a scalable architecture.

## Milestones Log

### ✅ Completed Milestones
- **Milestone 1:** Project Foundation & Core Engine (Deck, Card ranks, Dealing).
- **Milestone 2:** Single Player Game Loop (Phases, Advanced AI v1, Rule enforcement).
- **Milestone 3:** Profiles & Analytics (Global registry, Deep stats, Event logging).
- **Milestone 4:** Multi-Table Lobby (Create/Join, 4-seat visually, Add Bot logic).
- **Milestone 5:** Multiplayer Sync & Persistence (Supabase realtime, Stats corruption fixes, Freeze-crash patches).
- **[EUC-001]** Asynchronous Event Batching (Event Logger refactor).
- **[EUC-002]** "Moneyball" Euchre: Trump Analytics Data Pipeline (Trump call logging, Bower stats, Analytics UI).
- **[EUC-006]** Server-Authoritative Logic & Anti-Cheat via Presence Election. (Moved up due to critical necessity).

---

## 🚧 Current Epic: "Hand of the Day" Mode

**Goal:** Introduce a highly sticky daily challenge where all users face the exact same seeded game state for 4 hands.

*   ✅ **[EUC-003] Deterministic Seeded Game Engine**
    *   *Status: In Progress*
    *   Implement an exact seeded PRNG (`rng.ts`).
    *   Update `shuffleDeck` to use seeds rather than `Math.random()`.
    *   Ensure bots make deterministic moves given the seeded input.
*   TODO: **[EUC-004] "Hand of the Day" Scoring & Submission Pipeline**
    *   Hook up `GameState` so the game cleanly ends after 4 hands.
    *   Build Supabase table `hand_of_the_day_scores`
    *   Aggregate and submit score locally and to cloud.
*   TODO: **[EUC-005] "Hand of the Day" Global Dashboard**
    *   UI tab in Stats Modal showing Daily Leaders, 7-Day Rolling Averages, All-Time Greats.

---

## 📅 Future Epics

*   **[EUC-007] ELO / TrueSkill Matchmaking & Leagues:** Matchmaking queues and rating calculation based on match outcomes.
*   **[EUC-008] Real-Time Win Probability Engine:** Monte Carlo simulations for spectator mode.
*   **[EUC-009] Cinematic Replay Viewer ("Tape Viewer"):** Playback engine extracting states from the event stream.
