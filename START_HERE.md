# 🎮 Aaron's Euchre - Project Documentation

**Last Updated:** December 22, 2025  
**Status:** Production-ready, deployed on Vercel  
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
- **Bots:** Fizz, J-Bock, Huber, Moses, Wooden, Buff

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
1. Commit and push to GitHub
2. Wait ~60 seconds for Vercel to deploy
3. Then test on your mobile device

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
