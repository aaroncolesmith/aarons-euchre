import React, { useState, useRef } from 'react';
import { LayoutGroup } from 'framer-motion';
import { GameProvider, useGame } from './store/GameStore';
import { LoginPage } from './components/Lobby/LoginPage';
import { LandingPage } from './components/Lobby/LandingPage';
import { LobbyView } from './components/Lobby/LobbyView';
import { TableView } from './components/Table/TableView';
import { GameOver } from './components/GameEnd/GameOver';

const GameView = () => {
    const { state, dispatch } = useGame();

    const handleNextStep = () => {
        const currentPlayer = state.players[state.currentPlayerIndex];
        if (!currentPlayer) return;

        if (state.phase === 'bidding') {
            dispatch({ type: 'PASS_BID', payload: { playerIndex: state.currentPlayerIndex } });
        } else if (state.phase === 'playing' || state.phase === 'discard') {
            // This would normally be handle by a bot if it were their turn
            // For manual stepping, we might need a more specific action or just rely on actual bot logic
        }
    };

    // Routing based on game phase
    if (state.phase === 'login') return <LoginPage />;
    if (state.phase === 'landing') return <LandingPage />;

    if (state.phase === 'game_over') {
        return (
            <GameOver
                state={state}
                onPlayAgain={() => dispatch({ type: 'PLAY_AGAIN' })}
                onExit={() => dispatch({ type: 'EXIT_TO_LANDING' })}
            />
        );
    }

    if (state.phase === 'lobby') return <LobbyView />;

    // All active gameplay phases use the TableView
    return (
        <LayoutGroup>
            <div className="w-full h-full max-w-7xl mx-auto max-h-screen flex flex-col md:flex-row px-2 py-2 gap-4 overflow-hidden bg-paper/0 font-hand">
                <TableView handleNextStep={handleNextStep} />
            </div>
        </LayoutGroup>
    );
};

function App() {
    const [pullDistance, setPullDistance] = useState(0);
    const [isPulling, setIsPulling] = useState(false);
    const startY = useRef(0);
    const currentY = useRef(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) {
            startY.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isPulling) return;
        currentY.current = e.touches[0].clientY;
        const distance = currentY.current - startY.current;
        if (distance > 0) {
            setPullDistance(Math.min(distance / 2, 80));
        }
    };

    const handleTouchEnd = () => {
        if (pullDistance > 60) window.location.reload();
        setIsPulling(false);
        setPullDistance(0);
    };

    return (
        <div
            className="w-screen h-screen bg-transparent text-ink selection:bg-emerald-200 overflow-hidden font-hand relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {pullDistance > 0 && (
                <div
                    className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center transition-all"
                    style={{ height: `${pullDistance}px`, opacity: Math.min(pullDistance / 60, 1) }}
                >
                    <div className="bg-brand/20 backdrop-blur-sm rounded-full p-2">
                        <svg className={`w-6 h-6 text-brand-dim ${pullDistance > 60 ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </div>
                </div>
            )}

            <GameProvider>
                <GameView />
            </GameProvider>

            {/* Version Footer */}
            <div className="fixed bottom-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-30 z-[100]">
                <div className="text-[10px] font-black uppercase tracking-[0.5em]">
                    Euchre Engine V1.58
                </div>
            </div>
        </div>
    );
}

export default App;
