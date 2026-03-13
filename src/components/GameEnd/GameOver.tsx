import React from 'react';
import { motion } from 'framer-motion';
import { GameState } from '../../types/game';
import { DailyLeaderboard } from '../common/DailyLeaderboard';
import { GameRecapModal } from './GameRecapModal';

interface GameOverProps {
    state: GameState;
    onPlayAgain: () => void;
    onExit: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({ state, onPlayAgain, onExit }) => {
    const [showGameRecap, setShowGameRecap] = React.useState(false);
    const winner = state.scores.team1 >= 10 ? state.teamNames.team1 : state.teamNames.team2;
    const isTeam1Winner = state.scores.team1 >= 10;

    return (
        <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto p-8 animate-in fade-in zoom-in duration-700">
            <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                className="w-full bg-paper p-10 md:p-16 rounded-[3rem] border-4 border-brand shadow-sketch-brand-strong relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-brand/5 pointer-events-none" />

                <div className="relative z-10 space-y-8">
                    <h1 className="text-6xl md:text-7xl font-black text-brand-dark text-center leading-none italic uppercase transform -rotate-2">
                        GAME OVER!
                    </h1>

                    <div className="text-center space-y-2">
                        <div className="text-2xl md:text-3xl font-black text-brand-dim uppercase tracking-wide">
                            🏆 {winner} Wins! 🏆
                        </div>
                        <div className="text-lg text-ink-dim font-bold">
                            Final Score: {state.scores.team1} - {state.scores.team2}
                        </div>
                    </div>

                    <div className="bg-paper-dim rounded-2xl p-6 border-2 border-brand/20 shadow-inner">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <div className="text-sm text-ink-dim font-black uppercase tracking-wider mb-2">{state.teamNames.team1}</div>
                                <div className={`text-6xl font-black font-hand ${isTeam1Winner ? 'text-brand' : 'text-ink-dim'}`}>
                                    {state.scores.team1}
                                </div>
                            </div>
                            <div>
                                <div className="text-sm text-ink-dim font-black uppercase tracking-wider mb-2">{state.teamNames.team2}</div>
                                <div className={`text-6xl font-black font-hand ${!isTeam1Winner ? 'text-brand' : 'text-ink-dim'}`}>
                                    {state.scores.team2}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        {state.isDailyChallenge ? (
                            <div className="space-y-6">
                                <DailyLeaderboard hideHeader={true} />
                                <div className="flex justify-center pt-4">
                                    <button
                                        onClick={onExit}
                                        className="bg-paper hover:bg-red-50 text-red-500 font-black py-4 px-12 rounded-2xl text-lg border-4 border-red-500 shadow-sketch-red transition-all active:scale-95 uppercase tracking-widest"
                                    >
                                        Exit
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setShowGameRecap(true)}
                                        className="bg-paper hover:bg-paper-dim text-ink font-black py-4 rounded-2xl text-lg border-4 border-ink shadow-sketch-ink transition-all active:scale-95 uppercase tracking-widest"
                                    >
                                        Recap
                                    </button>
                                    <button
                                        onClick={onExit}
                                        className="bg-paper hover:bg-red-50 text-red-500 font-black py-4 rounded-2xl text-lg border-4 border-red-500 shadow-sketch-red transition-all active:scale-95 uppercase tracking-widest"
                                    >
                                        Exit
                                    </button>
                                </div>
                                <button
                                    onClick={onPlayAgain}
                                    className="w-full bg-brand hover:bg-brand-dim text-white font-black py-6 rounded-2xl text-2xl shadow-sketch-brand transition-all active:scale-95 uppercase tracking-[0.2em] flex items-center justify-center gap-3"
                                >
                                    <span className="text-3xl">♠️</span> PLAY AGAIN <span className="text-3xl">♥️</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </motion.div>
            <GameRecapModal isOpen={showGameRecap} onClose={() => setShowGameRecap(false)} gameState={state} />
        </div>
    );
};
