# Trump Analytics - Integration TODO

## Status: Phase 2 In Progress

### ✅ Completed
- [x] Created TrumpCallLog interface in types/game.ts
- [x] Added trumpCallLogs: TrumpCallLog[] to GameState
- [x] Initialized trumpCallLogs: [] in INITIAL_STATE
- [x] Fixed all type errors in trumpCallLogger.ts
- [x] Created createTrumpCallLog() helper function

### 🚧 Next Steps

#### 1. Integrate logging into BID_TRUMP action (GameStore.tsx)

Add this import at top:
```typescript
import { createTrumpCallLog } from '../utils/trumpCallLogger';
```

Find BID_TRUMP case (around line 500). Add logging BEFORE returningstate (in both round 1 and round 2 scenarios):

**Round 1 scenario (before return at line 546)**:
```typescript
// Log trump call
const trumpLog = createTrumpCallLog(
    caller,
    suit,
    dealerName,
    relationship,
    state.upcard,
    state.biddingRound,
    state.tableCode || 'unknown'
);

return {
    ...state,
    players: updatedPlayers,
    trump: suit,
    trumpCallerIndex: callerIndex,
    isLoner,
    phase: 'discard',
    currentPlayerIndex: state.dealerIndex,
    logs: [logMsg, ...state.logs],
    eventLog: [...state.eventLog, bidEvent],
    trumpCallLogs: [...state.trumpCallLogs, trumpLog] // ADD THIS
};
```

**Round 2 scenario (before return at line 588)**:
```typescript
// Log trump call
const trumpLog = createTrumpCallLog(
    caller,
    suit,
    dealerName,
    relationship,
    null, // No upcard in round 2
    state.biddingRound,
    state.tableCode || 'unknown'
);

return {
    ...state,
    players: newPlayers,
    trump: suit,
    trumpCallerIndex: callerIndex,
    isLoner,
    phase: 'playing',
    currentPlayerIndex: (state.dealerIndex + 1) % 4,
    logs: [logMsg, ...state.logs],
    eventLog: [...state.eventLog, bidEvent],
    overlayMessage: generateTrumpMessage(),
    overlayAcknowledged: botAcknowledgments,
    trumpCallLogs: [...state.trumpCallLogs, trumpLog] // ADD THIS
};
```

#### 2. Add Trump Calls tab to StatsModal (App.tsx)

After line 272 (after Leaderboard button), add Trump Calls tab button:
```typescript
<button
    onClick={() => setTab('trumps')}
    className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
        tab === 'trumps' 
            ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' 
            : 'bg-slate-800 text-slate-500 hover:text-slate-300'
    }`}
>
    Trump Calls
</button>
```

Update tab state type (line 224):
```typescript
const [tab, setTab] = useState<'me' | 'league' | 'trumps'>('me');
```

Add Trump Calls content after line 410 (after leaderboard div closes):
```typescript
) : tab === 'trumps' ? (
    <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-slate-400">
                {state.trumpCallLogs.length} trump calls logged
            </div>
            <button
                onClick={() => {
                    const { trumpCallsToCSV } = require('../utils/trumpCallLogger');
                    const csv = trumpCallsToCSV(state.trumpCallLogs);
                    const blob = new Blob([csv], { type: 'text/tab-separated-values' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `trump_calls_${Date.now()}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                }}
                disabled={state.trumpCallLogs.length === 0}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${
                    state.trumpCallLogs.length > 0
                        ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
            >
                📥 Export CSV
            </button>
        </div>
        
        <div className="bg-slate-800/30 border border-slate-800 rounded-[2rem] overflow-x-auto max-h-[400px]">
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/50 sticky top-0">
                    <tr className="text-[9px] font-black text-slate-500 uppercase">
                        <th className="px-3 py-2">Who</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Dealer</th>
                        <th className="px-3 py-2">Picked</th>
                        <th className="px-3 py-2">Trump</th>
                        <th className="px-3 py-2">Bowers</th>
                        <th className="px-3 py-2">Trump</th>
                        <th className="px-3 py-2">Suit</th>
                        <th className="px-3 py-2">Hand</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {state.trumpCallLogs.map((log, i) => (
                        <tr key={i} className="hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-bold text-white">{log.whoCalled}</td>
                            <td className="px-3 py-2 text-slate-400">{log.userType}</td>
                            <td className="px-3 py-2 text-slate-400">{log.dealer}</td>
                            <td className="px-3 py-2 text-cyan-400">{log.cardPickedUp}</td>
                            <td className="px-3 py-2 text-emerald-400 font-bold">{log.suitCalled}</td>
                            <td className="px-3 py-2 text-purple-400">{log.bowerCount}</td>
                            <td className="px-3 py-2 text-purple-400">{log.trumpCount}</td>
                            <td className="px-3 py-2 text-blue-400">{log.suitCount}</td>
                            <td className="px-3 py-2 text-slate-300 font-mono text-[10px]">{log.handAfterDiscard}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
) : (
```

#### 3. Add "View Trump Hand" button (Phase 4)

This would show after bidding completes. Add a button that displays the trump caller's hand in a modal.

## Testing Checklist
- [ ] Trump calls are logged when picked up in round 1
- [ ] Trump calls are logged when called in round 2
- [ ] Bower count is correct (2 max)
- [ ] Trump count includes bowers
- [ ] Hand cards are formatted correctly
- [ ] CSV export works
- [ ] Table displays all data correctly
- [ ] No duplicate logs
- [ ] Dealer relationship shows correctly

## Notes
- trumpCallLogs are currently only in memory - they reset on page refresh
- Could add persistence to localStorage or Supabase later
- CSV uses tab-delimited format for Excel compatibility
