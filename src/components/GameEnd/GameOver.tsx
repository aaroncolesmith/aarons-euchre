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
        <div className="w-full h-full overflow-y-auto custom-scrollbar pb-24 animate-in fade-in duration-700 font-hand">
            <div className="max-w-xl mx-auto px-4 py-8 space-y-10">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="space-y-8"
                >
                    <h1 className="text-5xl md:text-6xl font-black text-brand-dark text-center leading-none italic uppercase tracking-tight">
                        GAME OVER
                    </h1>

                    {!state.isDailyChallenge && (
                        <div className="text-center space-y-2">
                            <div className="text-2xl md:text-3xl font-black text-brand-dim uppercase tracking-wide">
                                🏆 {winner} Wins! 🏆
                            </div>
                            <div className="text-lg text-ink-dim font-bold">
                                Final Score: {state.scores.team1} - {state.scores.team2}
                            </div>
                        </div>
                    )}

                    <div className="bg-paper border-4 border-brand/20 rounded-[2rem] p-8 shadow-sketch-brand/10">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <div className="text-[10px] text-ink-dim font-black uppercase tracking-[0.2em] mb-3">{state.teamNames.team1}</div>
                                <div className={`text-7xl font-black font-hand ${isTeam1Winner ? 'text-brand' : 'text-ink-dim/40'}`}>
                                    {state.scores.team1}
                                </div>
                            </div>
                            <div className="border-l-2 border-brand/10">
                                <div className="text-[10px] text-ink-dim font-black uppercase tracking-[0.2em] mb-3">{state.teamNames.team2}</div>
                                <div className={`text-7xl font-black font-hand ${!isTeam1Winner ? 'text-brand' : 'text-ink-dim/40'}`}>
                                    {state.scores.team2}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {state.isDailyChallenge ? (
                            <div className="space-y-10">
                                <div className="pt-4 border-t-2 border-brand/10">
                                    <h2 className="text-3xl md:text-4xl font-black text-brand-dim text-center uppercase tracking-tight mb-2">
                                        DAILY CHALLENGE STATS
                                    </h2>
                                    <DailyLeaderboard hideHeader={true} />
                                </div>
                                <div className="flex justify-center pt-8">
                                    <button
                                        onClick={onExit}
                                        className="bg-white hover:bg-red-50 text-red-500 font-black py-4 px-16 rounded-2xl text-xl border-4 border-red-500 shadow-sketch-red transition-all active:scale-95 uppercase tracking-widest"
                                    >
                                        Exit
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6 pt-4">
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
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
            <GameRecapModal isOpen={showGameRecap} onClose={() => setShowGameRecap(false)} gameState={state} />
        </div>
    );
};
