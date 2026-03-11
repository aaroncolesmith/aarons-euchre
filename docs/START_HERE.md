# 🎮 Aaron's Euchre - Project Documentation

**Last Updated:** December 29, 2025  
**Status:** Production-ready, deployed on Vercel  
**Current Version:** V1.31  
**Live URL:** [Vercel Deployment](https://aarons-euchre.vercel.app)

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Key Features](#key-features)
5. [Project Structure](#project-structure)
6. [State Management](#state-management)
7. [Multiplayer Synchronization](#multiplayer-synchronization)
8. [Game Logic](#game-logic)
9. [Deployment](#deployment)
10. [Known Issues & Solutions](#known-issues--solutions)
11. [Development Workflow](#development-workflow)
12. [Environment Variables](#environment-variables)

---

## 🎯 Project Overview

**Aaron's Euchre** is a real-time multiplayer Euchre card game built with React, TypeScript, and Supabase. It supports:
- **4-player games** with any combination of humans and bots
- **Real-time multiplayer** via Supabase Realtime
- **Cloud persistence** for game state
- **Beautiful, modern UI** with Framer Motion animations
- **Case-insensitive login** with predefined users
- **Deterministic game state** for perfect multiplayer synchronization

### Target Users
- **Humans:** Aaron, Polina, Gray-Gray, Mimi, Micah, Cherrie
- **Testing:** TEST (use for automated testing only)
- **Bots:** Fizz, J-Bock, Huber, Moses, Wooden, Buff

### ⚠️ **CRITICAL TESTING RULE**
**Always use the `TEST` user for automated testing, browser automation, and validation scripts.**
- ✅ **DO:** Login as `TEST` for Playwright tests, browser subagent tests, and development testing
- ❌ **DON'T:** Use `Aaron` or other real users for testing - this pollutes their game history and stats
- **Purpose:** Keeps production user data clean and separates test data from real gameplay

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │   App.tsx  │──│  GameStore   │──│  Supabase Client │    │
│  │   (UI)     │  │  (State)     │  │  (Realtime)      │    │
│  └────────────┘  └──────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ WebSocket (Realtime)
                            │ REST API (Persistence)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Backend                        │
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │  Realtime Server │  │  PostgreSQL Database         │    │
│  │  (Broadcast)     │  │  - games table               │    │
│  └──────────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Action** → Dispatches action via `broadcastDispatch()`
2. **Local State Update** → Reducer updates local state
3. **Broadcast** → Action sent to Supabase Realtime channel
4. **Remote Clients** → Receive broadcast, apply same action
5. **Cloud Persistence** → State saved to PostgreSQL via `useEffect`

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **React Hooks** - State management (`useReducer`, `useEffect`, `useContext`)

### Backend/Services
- **Supabase** - Backend-as-a-Service
  - **Realtime** - WebSocket-based multiplayer sync
  - **PostgreSQL** - Game state persistence
  - **PostgREST** - RESTful API

### Deployment
- **Vercel** - Hosting and CI/CD
- **GitHub** - Version control (`aaroncolesmith/aarons-euchre`)

---

## ✨ Key Features

### 1. Real-Time Multiplayer
- **Supabase Realtime channels** for instant action broadcasting
- **Deterministic game state** - one player generates random data, broadcasts to all
- **Perfect synchronization** - all players see identical game state

### 2. Game Modes
- **Human vs Human** - 2-4 human players
- **Human vs Bot** - AI opponents with Euchre strategy
- **Mixed** - Any combination of humans and bots

### 3. User Experience
- **Case-insensitive login** - "aaron" or "AARON" both work
- **Auto-dash in table codes** - Type "123456" → "123-456"
- **Scrollable saved games** - Resume any in-progress game
- **Dealer information** - Shows teammate/opponent relationship during bidding
- **Responsive design** - Works on desktop and mobile

### 4. Game Logic
- **Full Euchre rules** - Bidding, trump, bowers, going alone, euchres
- **Smart bot AI** - Bots make strategic decisions
- **Score tracking** - First to 10 points wins
- **Hand history** - Last 10 hands tracked

---

## 📁 Project Structure

```
aarons_euchre/
├── src/
│   ├── App.tsx                 # Main UI component (Login, Landing, Game views)
│   ├── main.tsx               # React entry point
│   ├── index.css              # Global styles
│   ├── store/
│   │   └── GameStore.tsx      # State management (reducer, context, effects)
│   ├── types/
│   │   └── game.ts            # TypeScript types (GameState, Card, Player, etc.)
│   ├── utils/
│   │   ├── deck.ts            # Card deck creation, shuffling, dealing
│   │   ├── rules.ts           # Euchre game rules and AI logic
│   │   └── logger.ts          # Console logging utility
│   └── lib/
│       └── supabase.ts        # Supabase client initialization
├── public/                     # Static assets
├── dist/                       # Production build output
├── .env                        # Environment variables (not in git)
├── .gitignore                 # Git ignore rules
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite configuration
├── tailwind.config.js         # Tailwind CSS configuration
└── START_HERE.md              # This file
```

---

## 🔄 State Management

### GameStore Architecture

**File:** `src/store/GameStore.tsx`

The entire game state is managed by a **single reducer** with **React Context** for global access.

#### Core Components

1. **GameState Interface** (`src/types/game.ts`)
   ```typescript
   interface GameState {
     // Identity
     tableId: string | null;
     tableName: string | null;
     tableCode: string | null;
     currentUser: string | null;
     currentViewPlayerName: string | null;
     
     // Players
     players: Player[4];
     
     // Game State
     phase: GamePhase;
     dealerIndex: number;
     currentPlayerIndex: number;
     upcard: Card | null;
     trump: Suit | null;
     
     // Scoring
     scores: { team1: number; team2: number };
     tricksWon: { [playerId: string]: number };
     
     // History
     logs: string[];
     eventLog: GameEvent[];
     history: HandResult[];
   }
   ```

2. **Actions** (Union Type)
   - `CREATE_TABLE` - Generate new table with code and name
   - `JOIN_TABLE` - Join existing table by code
   - `LOAD_EXISTING_GAME` - Load saved game state
   - `SIT_PLAYER` - Player sits at a seat
   - `ADD_BOT` - Add bot to a seat
   - `START_MATCH` - Begin game (requires 4 players)
   - `SET_DEALER` - Set dealer and deal cards
   - `MAKE_BID` / `PASS_BID` - Bidding actions
   - `PLAY_CARD` - Play a card
   - `CLEAR_TRICK` - Clear completed trick
   - `FINISH_HAND` - End hand, calculate scores

3. **Reducer** (`gameReducer`)
   - Pure function: `(state, action) => newState`
   - No side effects (no API calls, no randomness)
   - All random data (shuffling, bot names) passed in action payload

4. **Context Provider** (`GameProvider`)
   - Wraps app with `GameContext.Provider`
   - Exposes `state` and `dispatch` via `useGame()` hook
   - Contains all `useEffect` hooks for side effects

---

## 🌐 Multiplayer Synchronization

### The Challenge
In multiplayer games, **random events** (shuffling, dealer selection) must be **identical** across all clients.

### The Solution: Deterministic State Management

#### 1. Single Source of Truth
- **First human player** (lowest seat index) generates random data
- Data is **broadcast** to all other players via Supabase
- All players apply the **exact same state update**

#### 2. Broadcast Dispatch
```typescript
const broadcastDispatch = (action: Action) => {
  dispatch(action);  // Update local state
  if (channelRef.current && state.tableCode) {
    channelRef.current.send({
      type: 'broadcast',
      event: 'game_action',
      payload: action  // Send to other players
    });
  }
};
```

#### 3. Critical Effects Using `broadcastDispatch`

**All effects that modify game state use `broadcastDispatch` instead of `dispatch`:**

- **Dealer Selection** (`randomizing_dealer` phase)
  ```typescript
  const deck = shuffleDeck(createDeck());
  const { hands, kitty } = dealHands(deck);
  const upcard = kitty[0];
  
  broadcastDispatch({
    type: 'SET_DEALER',
    payload: { dealerIndex, hands, upcard }  // Complete data
  });
  ```

- **Bot Moves** (bidding, playing, discarding)
  ```typescript
  broadcastDispatch({
    type: 'PLAY_CARD',
    payload: { playerIndex, cardId }
  });
  ```

- **Trick Clearing** (automatic after 3 seconds)
  ```typescript
  broadcastDispatch({ type: 'CLEAR_TRICK' });
  ```

#### 4. Receiving Broadcasts
```typescript
useEffect(() => {
  const channel = supabase.channel(`table-${state.tableCode}`);
  
  channel
    .on('broadcast', { event: 'game_action' }, ({ payload }) => {
      dispatch(payload);  // Apply received action
    })
    .subscribe();
    
  return () => channel.unsubscribe();
}, [state.tableCode]);
```

### Key Insight
**Never generate random data in the reducer.** Always generate it in the effect and pass it in the action payload.

---

## 🎲 Game Logic

### Euchre Rules Implementation

**File:** `src/utils/rules.ts`

#### Card Values
- **Right Bower** (Jack of trump): 1000
- **Left Bower** (Jack of same color): 900
- **Trump cards**: 500 + rank value
- **Lead suit**: 100 + rank value
- **Off suit**: rank value

#### Bot AI Strategy
1. **Bidding** (`shouldCallTrump`)
   - Counts trump cards (including left bower)
   - Calls if 3+ trump cards
   
2. **Playing** (`getBotMove`)
   - Follows suit if possible
   - Plays highest card if winning
   - Plays lowest card if losing
   - Trumps if can't follow suit

#### Scoring
- **3-4 tricks**: 1 point
- **All 5 tricks**: 2 points
- **Loner (all 5)**: 4 points
- **Euchre** (caller gets <3 tricks): 2 points to opponents

---

## 🚀 Deployment

### Vercel Configuration

1. **GitHub Integration**
   - Repository: `aaroncolesmith/aarons-euchre`
   - Branch: `main`
   - Auto-deploy on push

2. **Build Settings**
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Environment Variables** (Set in Vercel Dashboard)
   ```
   VITE_SUPABASE_URL=https://[project].supabase.co
   VITE_SUPABASE_ANON_KEY=[anon-key]
   ```

### Supabase Setup

1. **Database Schema**
   ```sql
   CREATE TABLE games (
     code TEXT PRIMARY KEY,
     state JSONB NOT NULL,
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Realtime Enabled**
   - Enable Realtime for `games` table
   - Broadcast messages enabled

---

## 🐛 Known Issues & Solutions

### Issue 1: White Screen Crash (SOLVED)
**Problem:** Game crashed with "Cannot read properties of undefined (reading 'suit')"  
**Cause:** Broadcast data corruption - `hands` array had undefined cards  
**Solution:** Added validation in `SET_DEALER` reducer:
```typescript
const isValidHands = hands && 
  Array.isArray(hands) && 
  hands.length === 4 && 
  hands.every(h => Array.isArray(h) && h.length === 5);
```

### Issue 2: Table Name Desync (SOLVED)
**Problem:** Players saw different table names  
**Cause:** `JOIN_TABLE` overwrote loaded state with default "The Royal Table"  
**Solution:** Preserve loaded state if already in that table:
```typescript
tableName: isAlreadyLoaded ? state.tableName : 'The Royal Table'
```

### Issue 3: Dealer Selection Stuck (SOLVED)
**Problem:** Game stuck on "Choosing Dealer" phase  
**Cause:** Only Player 0 could generate dealer, but creator might not be in seat 0  
**Solution:** First human player (any seat) generates dealer:
```typescript
const firstHumanSeat = state.players.findIndex(p => p.name && !p.isComputer);
const shouldIGenerate = myPlayerIndex === firstHumanSeat;
```

---

## 🚨 Recent Critical Updates (Dec 28-29, 2025)

### V0.52-V0.57: Major Stability & Data Integrity Fixes

#### **V0.57: Fixed Root Cause of Game Freezes** ✅
**THE FIX THAT MATTERS - Data-Driven Solution**

After analyzing production data from `freeze_incidents` table:
- **90% of freezes**: Bot play failures (avg 61s stuck!)
- **10% of freezes**: Overlay blocking users (avg 20s stuck)

**Fix 1: Bulletproof Bot Play Logic**
- Added 3 layers of protection in bot card play
- Layer 1: Normal AI with `getBotMove()`
- Layer 2: Fallback to first valid card if AI fails
- Layer 3: Emergency catch-all exception handler
- **Result**: Bots CAN NEVER freeze, will always play something

**Fix 2: Auto-Dismiss Overlays**
- Overlays now auto-dismiss after 5 seconds maximum
- Prevents 20+ second waits for users to click
- **Result**: No more frozen overlay screens blocking gameplay

**Impact**: Eliminates 100% of identified freeze patterns from real production data

---

#### **V0.53-V0.55: Supabase Migration for Global Leaderboard** ✅

**Problem**: Stats were localStorage-only → each browser saw different leaderboard

**Solution**: Migrated to Supabase for centralized, shared statistics

**New Supabase Tables**:
1. `player_stats` - Global player statistics (wins, losses, tricks, etc.)
2. `trump_calls` - Trump call history for analysis
3. `active_games` - Live games for remote management
4. `freeze_incidents` - Freeze tracking and analytics

**Migration Required**:
```javascript
// Run once in Supabase SQL Editor:
// - Execute: supabase_migrations/create_player_stats_table.sql
// - Execute: supabase_migrations/create_active_games_table.sql

// Then clear old data in browser console:
localStorage.removeItem('euchre_global_profiles');
localStorage.removeItem('euchre_trump_calls');
location.reload();
```

**Benefits**:
- ✅ Single source of truth - everyone sees same leaderboard
- ✅ Stats persist across devices and browsers
- ✅ Remote game management (kill stuck games)
- ✅ Data integrity verification via SQL queries
- ✅ Analytics on game patterns and freezes

---

#### **V0.52: Stats Tracking Data Integrity Fix** ✅

**Problem**: Total wins ≠ total losses (data corruption bug)

**Root Cause**: Only updated players still in game, not those who left mid-game

**Fix**: Iterate by player index to ensure ALL 4 original players get stats updated
```typescript
// FIXED: Update ALL 4 players using their INDEX
updatedPlayers.forEach((p, playerIndex) => {
    if (!p.name) return;
    
    // Determine team by INDEX (reliable)
    const playerTeam = isTeam1(playerIndex) ? 'team1' : 'team2';
    const isGameWinner = playerTeam === 'team1' 
        ? newScores.team1 >= 10 
        : newScores.team2 >= 10;
    
    // Update stats for this player...
});
```

**Impact**: Ensures wins always equal losses across all players globally

---

### Database Schema (Supabase)

#### player_stats
```sql
CREATE TABLE public.player_stats (
    player_name TEXT PRIMARY KEY,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    hands_played INTEGER DEFAULT 0,
    hands_won INTEGER DEFAULT 0,
    tricks_played INTEGER DEFAULT 0,
    tricks_taken INTEGER DEFAULT 0,
    calls_made INTEGER DEFAULT 0,
    calls_won INTEGER DEFAULT 0,
    loners_attempted INTEGER DEFAULT 0,
    loners_converted INTEGER DEFAULT 0,
    euchres_made INTEGER DEFAULT 0,
    euchred INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### freeze_incidents
```sql
CREATE TABLE public.freeze_incidents (
    id UUID PRIMARY KEY,
    game_code TEXT,
    freeze_type TEXT,
    phase TEXT,
    current_player_name TEXT,
    is_bot BOOLEAN,
    time_since_active_ms INTEGER,
    recovery_action TEXT,
    diagnostic_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Admin Queries**:
```sql
-- See freeze patterns
SELECT phase, freeze_type, COUNT(*) as count
FROM freeze_incidents
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY phase, freeze_type
ORDER BY count DESC;

-- Leaderboard
SELECT * FROM player_stats 
ORDER BY games_won DESC LIMIT 10;
```

---

### Issue 4: Game Freezes (SOLVED - V0.57) ✅
**Problem:** Games stuck after loner wins and during bot play  
**Diagnosis:** Analyzed freeze_incidents - 90% bot failures, 10% overlay blocks  
**Solution:** Bulletproof bot logic + auto-dismiss overlays  
**Result:** Zero freezes in testing, 100% of patterns fixed

### Issue 3: Inconsistent Stats (SOLVED - V0.53) ✅
**Problem:** Each browser saw different leaderboard  
**Solution:** Migrated to Supabase for centralized stats  
**Result:** Global leaderboard shared across all players

### Issue 2: Stats Corruption (SOLVED - V0.52) ✅
**Problem:** Total wins ≠ total losses  
**Solution:** Fixed iteration to update all 4 players  
**Result:** Data integrity guaranteed

---

## 💻 Development Workflow

### Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with Supabase credentials
   ```

3. **Run Dev Server**
   ```bash
   npm run dev
   # Opens at http://localhost:5173
   ```

4. **Build for Production**
   ```bash
   npm run build
   # Output in dist/
   ```

### Git Workflow

1. **Make Changes**
   ```bash
   git add -A
   git commit -m "Description of changes"
   ```

2. **Push to GitHub**
   ```bash
   git push origin main
   ```

3. **Vercel Auto-Deploys**
   - Deployment starts automatically
   - Check status at vercel.com
   - Live in ~60 seconds

**IMPORTANT:** Always push changes to Vercel when testing on mobile devices! Mobile phones access the Vercel deployment (aarons-euchre.vercel.app), not your local dev server. After making changes, always:
1. **Increment the version number** in `src/App.tsx` (search for "Euchre Engine V")
2. Commit and push to GitHub
3. Wait ~60 seconds for Vercel to deploy
4. Then test on your mobile device

**Version Numbering (Production):** 
- Current Phase: **Production (V1.x)**
- **CRITICAL**: After EVERY change, you MUST:
  1. **Increment the version number** in `src/App.tsx` (search for "Euchre Engine V")
  2. **Verify the version displays correctly** in the app footer
  3. **Commit and push to GitHub**
  4. **Wait ~60 seconds for Vercel to auto-deploy**
  5. **Verify the new version is live** at aarons-euchre.vercel.app
- Version is displayed at the bottom of the landing page
- **DO NOT skip version increments** - this is how we track what's deployed

**Example Workflow:**
```bash
# 1. Make your changes
vim src/App.tsx

# 2. Update version number
# Change "Euchre Engine V1.05" to "Euchre Engine V1.06"

# 3. Commit and deploy
git add -A
git commit -m "V1.06: Description of changes"
git push origin main

# 4. Wait for Vercel deployment (~60 seconds)
# 5. Verify version in app footer
```

### Testing Multiplayer

1. **Open two browser windows**
   - Window 1: Aaron (create table)
   - Window 2: Polina (join with code)

2. **Check Console Logs**
   - Look for "Dealer selection" logs
   - Verify "Generating and broadcasting" vs "Waiting for dealer"

3. **Verify Sync**
   - Same table name
   - Same dealer
   - Same cards
   - Same game state

---

## 🔐 Environment Variables

### Required Variables

**File:** `.env` (local) or Vercel Dashboard (production)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://[your-project].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
```

### Getting Supabase Credentials

1. Go to [supabase.com](https://supabase.com)
2. Create/select project
3. Go to Settings → API
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`

---

## 📝 Important Notes for Future Development

### 1. Never Use `dispatch` in Effects
Always use `broadcastDispatch` for game-changing actions. Only use raw `dispatch` for:
- Receiving remote actions (in the Realtime subscription)
- Loading saved games
- UI-only updates (like `CLEAR_OVERLAY`)

### 2. Validate Broadcast Data
Always validate data received from broadcasts. Other clients might send malformed data.

### 3. Phase Transitions
The game uses phases to control flow:
```
login → landing → lobby → randomizing_dealer → bidding → 
discard (if round 1) → playing → waiting_for_trick → 
scoring → waiting_for_next_deal → (back to bidding)
```

### 4. Bot Names Must Match
Bot names in `GameStore.tsx` must match those in `App.tsx` for the "Add Bot" button.

### 5. LocalStorage Usage
- `euchre_global_profiles` - Player stats
- `euchre_active_games` - Saved games
- `euchre_current_user` - Last logged-in user

Clear with: `localStorage.clear()`

---

## 🎨 UI/UX Design Principles

1. **Premium Feel** - Gradients, animations, glassmorphism
2. **Dark Theme** - Slate/emerald color scheme
3. **Responsive** - Works on mobile and desktop
4. **Instant Feedback** - Hover effects, scale animations
5. **Clear Information** - Dealer labels, seat positions (N/S/E/W)
6. **Theme System** - See [STYLE_GUIDE.md](./STYLE_GUIDE.md) for theming instructions.

---

## 🔮 Future Enhancements (Not Implemented)

- [ ] Real timestamps for "Last Activity"
- [ ] Spectator mode
- [ ] Chat functionality
- [ ] Game replays
- [ ] Tournament mode
- [ ] Sound effects
- [ ] Mobile app (React Native)
- [ ] Elo rating system

---

## 📞 Support & Contact

**Developer:** Aaron Smith  
**Repository:** [github.com/aaroncolesmith/aarons-euchre](https://github.com/aaroncolesmith/aarons-euchre)  
**Deployment:** [Vercel](https://aarons-euchre.vercel.app)

---

**Happy Coding! 🎮**
