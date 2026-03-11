import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../../store/GameStore';
import { PlayerStats } from '../../types/game';
import { getAllPlayerStats } from '../../utils/supabaseStats';
import { TrumpCallsTable } from '../Stats/TrumpCallsTable';
import { DailyLeaderboard } from './DailyLeaderboard';

export const StatsModal = ({
    isOpen,
    onClose,
    initialTab = 'me'
}: {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: 'me' | 'league' | 'daily_challenge' | 'trump_analytics' | 'bot_audit' | 'freeze_incidents' | 'state_management' | 'commentary';
}) => {
    const { state } = useGame();
    const [allStats, setAllStats] = useState<{ [name: string]: PlayerStats }>({});
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            getAllPlayerStats().then(stats => {
                setAllStats(stats);
                setIsLoading(false);
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const myStats = allStats[state.currentViewPlayerName!] || {
        handsPlayed: 0,
        handsWon: 0,
        tricksPlayed: 0,
        tricksWon: 0,
        tricksWonTeam: 0,
        callsMade: 0,
        callsWon: 0,
        lonersAttempted: 0,
        lonersWon: 0,
        pointsScored: 0
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-paper/60 backdrop-blur-md"
                />

                <motion.div
                    initial={{ scale: 0.9, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.9, y: 20, opacity: 0 }}
                    className="relative w-full max-w-4xl bg-paper rounded-[3rem] border-4 border-ink shadow-sketch-ink overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-8 border-b-4 border-ink bg-brand/5 flex justify-between items-center">
                        <div className="space-y-1">
                            <h2 className="text-4xl font-black italic uppercase tracking-tighter">Match Analytics</h2>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-dim">Persistence engine v4.0 (Active)</p>
                        </div>
                        <button onClick={onClose} className="w-12 h-12 rounded-full border-4 border-ink flex items-center justify-center font-black hover:bg-red-500 hover:text-white transition-all shadow-sketch-ink">✕</button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
                        {(['me', 'league', 'daily_challenge', 'trump_analytics', 'bot_audit', 'freeze_incidents', 'state_management', 'commentary'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-4 ${activeTab === tab ? 'border-brand text-brand bg-brand/5' : 'border-transparent text-ink-dim hover:text-ink'}`}
                            >
                                {tab.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-8 bg-paper">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-4">
                                <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-brand">Syncing with Supabase...</div>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                {activeTab === 'me' && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {[
                                            { label: 'Hands Played', value: myStats.handsPlayed, color: 'text-brand' },
                                            { label: 'Win Rate', value: `${myStats.handsPlayed > 0 ? Math.round((myStats.handsWon / myStats.handsPlayed) * 100) : 0}%`, color: 'text-brand' },
                                            { label: 'Tricks Won (Team)', value: myStats.tricksWonTeam, color: 'text-indigo-400' },
                                            { label: 'Trick Win %', value: `${myStats.tricksPlayed > 0 ? Math.round((myStats.tricksWonTeam / myStats.tricksPlayed) * 100) : 0}%`, color: 'text-indigo-400' },
                                            { label: 'Calls Made', value: myStats.callsMade, color: 'text-cyan-500' },
                                            { label: 'Call Win %', value: `${myStats.callsMade > 0 ? Math.round((myStats.callsWon / myStats.callsMade) * 100) : 0}%`, color: 'text-cyan-500' },
                                            { label: 'Loners Won', value: myStats.lonersWon, color: 'text-amber-500' },
                                            { label: 'Points Scored', value: myStats.pointsScored, color: 'text-pink-500' },
                                        ].map(stat => (
                                            <div key={stat.label} className="bg-paper border-2 border-slate-100 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                                <div className={`text-4xl font-black font-hand mb-2 ${stat.color}`}>{stat.value}</div>
                                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">{stat.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'trump_analytics' && (
                                    <TrumpCallsTable />
                                )}

                                {activeTab === 'daily_challenge' && (
                                    <DailyLeaderboard />
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
