import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { GameProvider, useGame, getEmptyStats, getSavedGames, BOT_NAMES_POOL, deleteActiveGame } from './store/GameStore';
import { getEffectiveSuit, isValidPlay } from './utils/rules';
import { Card } from './types/game';
import { supabase } from './lib/supabase';
import { fetchUserCloudGames, mergeLocalAndCloudGames } from './utils/cloudGames';
import { getFreezeStats, getFreezeRate } from './utils/cloudFreezeLogger';

const getCardJitter = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
    return (Math.abs(hash) % 14) - 7; // -7 to 7 degrees
};

const PlayerSeat = ({
    index,
    position,
    isCurrentTurn,
    isDealer,
    isAnimatingDealer = false,
    inLobby = false
}: {
    index: number;
    position: 'bottom' | 'top' | 'left' | 'right';
    isCurrentTurn: boolean;
    isDealer: boolean;
    isAnimatingDealer?: boolean;
    inLobby?: boolean;
}) => {
    const { state, dispatch } = useGame();
    const player = state.players[index];
    const isTrumpCaller = state.trumpCallerIndex === index && state.phase !== 'lobby';

    const posClasses = {
        bottom: "bottom-4 md:bottom-10 left-1/2 -translate-x-1/2",
        top: "top-1 md:top-4 left-1/2 -translate-x-1/2",
        left: "left-0 md:left-12 top-1/2 -translate-y-1/2 -rotate-90 origin-center",
        right: "right-0 md:right-12 top-1/2 -translate-y-1/2 rotate-90 origin-center"
    };

    if (!player.name && inLobby) {
        return (
            <div className={`absolute ${posClasses[position]} flex flex-col items-center gap-3 z-20 group`}>
                <div className="w-16 h-16 rounded-3xl bg-slate-800/50 border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-600 transition-all group-hover:border-emerald-500/50 group-hover:bg-slate-800">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                </div>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => dispatch({ type: 'SIT_PLAYER', payload: { seatIndex: index, name: state.currentViewPlayerName! } })}
                        className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 transition-all"
                    >
                        Sit Here
                    </button>
                    <button
                        onClick={() => {
                            const activeBotNames = state.players.map(p => p.name).filter(n => n && BOT_NAMES_POOL.includes(n));
                            const availableBots = BOT_NAMES_POOL.filter(n => !activeBotNames.includes(n));
                            const botName = availableBots[Math.floor(Math.random() * availableBots.length)] || 'Bot ' + Math.random().toString().substr(2, 3);
                            dispatch({ type: 'ADD_BOT', payload: { seatIndex: index, botName } });
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-400 px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all"
                    >
                        Add Bot
                    </button>
                </div>
                {/* Seat Label (N/S/E/W) */}
                <div className="absolute -bottom-8 text-[8px] font-black text-slate-600 uppercase tracking-widest opacity-30">
                    {position === 'bottom' ? 'South' : position === 'left' ? 'West' : position === 'top' ? 'North' : 'East'}
                </div>
            </div>
        );
    }

    if (!player.name) return null;

    return (
        <motion.div
            className={`absolute ${posClasses[position]} flex flex-col items-center gap-1 z-0`}
        >
            <motion.div
                className={`
                    relative w-36 md:w-48 h-20 md:h-24 rounded-3xl border-4 transition-all duration-300 flex flex-col items-center justify-center
                    ${isAnimatingDealer
                        ? 'bg-slate-900/95 border-amber-500 shadow-[0_0_40px_rgba(245,158,11,1)]'
                        : isCurrentTurn
                            ? 'bg-slate-900/95 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.8)]'
                            : 'bg-slate-900/90 border-cyan-500/50 shadow-xl'}\
                `}
            >
                {/* Caller Badge - Top Left */}
                {isTrumpCaller && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute -top-3 -left-3 bg-cyan-500/20 backdrop-blur-sm text-cyan-300 text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-wider border-2 border-cyan-500"
                    >
                        Caller
                    </motion.div>
                )}

                {/* Dealer Badge - Top Right */}
                {isDealer && !isAnimatingDealer && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-3 -right-3 bg-amber-500 text-white text-sm font-black w-10 h-10 rounded-full flex items-center justify-center border-4 border-slate-900 shadow-lg"
                    >
                        D
                    </motion.div>
                )}

                {/* Remove Button (Lobby Only) */}
                {player.isComputer && inLobby && (
                    <button
                        onClick={() => dispatch({ type: 'REMOVE_PLAYER', payload: { seatIndex: index } })}
                        className="absolute -top-3 -left-3 bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 border-slate-900 z-10"
                    >
                        ✕
                    </button>
                )}

                {/* Player Name */}
                <div className={`font-black text-xs uppercase tracking-tight ${isCurrentTurn || isAnimatingDealer ? 'text-white' : 'text-slate-200'} truncate max-w-full px-2`}>
                    {player.name}
                </div>

                {/* CARDS LEFT - 5 rectangles showing hand size */}
                {!inLobby && player.name !== state.currentViewPlayerName && state.phase !== 'randomizing_dealer' && (
                    <div className="flex gap-1 justify-center mb-1">
                        {[0, 1, 2, 3, 4].map((i) => {
                            const hasCard = i < player.hand.length;
                            return (
                                <div
                                    key={i}
                                    className={`
                                        w-3 h-5 rounded-sm border transition-all
                                        ${hasCard
                                            ? 'bg-slate-600 border-slate-500'
                                            : 'bg-slate-800/50 border-slate-700/50'}
                                    `}
                                />
                            );
                        })}
                    </div>
                )}

                {/* TRICKS WON - Cyan badge bottom right with number */}
                {!inLobby && state.phase !== 'randomizing_dealer' && (state.tricksWon[player.id] || 0) > 0 && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -bottom-3 -right-3 bg-cyan-400 text-slate-900 text-base font-black w-9 h-9 rounded-full flex items-center justify-center border-3 border-slate-900 shadow-lg"
                    >
                        {state.tricksWon[player.id] || 0}
                    </motion.div>
                )}
            </motion.div>

            <div className="hidden">
                {position === 'bottom' ? 'South' : position === 'left' ? 'West' : position === 'top' ? 'North' : 'East'}
            </div>
        </motion.div>
    );
};

const CardComponent = ({
    card,
    onClick,
    disabled,
    isValid = true,
    size = 'md',
    rotation = 0
}: {
    card: Card;
    onClick?: () => void;
    disabled?: boolean;
    isValid?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'mobile';
    rotation?: number;
}) => {
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    const suitSymbol = card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠';

    const sizes = {
        sm: 'w-16 h-24 text-base',
        md: 'w-20 h-28 text-xl',
        lg: 'w-24 h-36 text-2xl',
        mobile: 'w-[77px] h-[115px] text-xl'
    };

    const valClass = isRed ? 'text-red-600' : 'text-slate-900';
    const invalidClass = isRed ? 'text-red-600/50' : 'text-slate-900/50';

    return (
        <motion.button
            layout
            disabled={disabled}
            onClick={onClick}
            whileHover={isValid && !disabled && onClick ? { y: -15, scale: 1.05, transition: { type: 'spring', stiffness: 300 } } : {}}
            whileTap={isValid && !disabled && onClick ? { scale: 0.95 } : {}}
            className={`
                ${sizes[size]} rounded-[1.25rem] border-2 shadow-[0_8px_30px_rgba(0,0,0,0.5)] 
                flex flex-col items-center justify-center relative overflow-hidden transition-all duration-500
                ${isValid ? 'bg-white border-white' : 'bg-white/90 border-slate-200/50 opacity-80'}
            `}
            style={{ rotate: rotation }}
        >
            <div className={`absolute top-2 left-3 font-black flex flex-col items-center leading-none ${isValid ? valClass : invalidClass}`}>
                <span className="text-xl uppercase">{card.rank}</span>
                <span className="-mt-1 uppercase">{suitSymbol}</span>
            </div>
            <div className={`absolute bottom-2 right-3 font-black rotate-180 flex flex-col items-center leading-none ${isValid ? valClass : invalidClass}`}>
                <span className="text-xl uppercase">{card.rank}</span>
                <span className="-mt-1 uppercase">{suitSymbol}</span>
            </div>

            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
        </motion.button>
    );
};


const StatsModal = ({ isOpen, onClose, initialTab = 'me' }: { isOpen: boolean; onClose: () => void; initialTab?: 'me' | 'league' | 'trumps' | 'admin' }) => {
    const { state } = useGame();
    const [tab, setTab] = useState<'me' | 'league' | 'trumps' | 'admin'>(initialTab);
    const [freezeStats, setFreezeStats] = useState<any>(null);
    const [freezeRate, setFreezeRate] = useState<any>(null);

    // Reset to initial tab when modal opens
    useEffect(() => {
        if (isOpen) {
            setTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // Load global stats from localStorage
    const globalStats = JSON.parse(localStorage.getItem('euchre_global_profiles') || '{}');

    // Load freeze statistics when admin tab is selected
    useEffect(() => {
        if (tab === 'admin' && isOpen) {
            getFreezeStats().then(setFreezeStats);
            getFreezeRate(24).then(setFreezeRate);
        }
    }, [tab, isOpen]);

    // Get my stats - prioritize global stats over current game stats
    const myGlobalStats = globalStats[state.currentViewPlayerName || ''] || getEmptyStats();
    const human = {
        name: state.currentViewPlayerName,
        stats: myGlobalStats
    };

    if (!isOpen) return null;

    const leaguePlayers = Object.keys(globalStats).map(name => ({
        name,
        ...globalStats[name]
    })).sort((a: any, b: any) => (b.gamesWon / Math.max(1, b.gamesPlayed)) - (a.gamesWon / Math.max(1, a.gamesPlayed)));

    const downloadSessionLog = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.eventLog, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `euchre_session_${state.tableCode || 'log'}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const downloadTrumpCallsCSV = () => {
        const { trumpCallsToCSV } = require('../utils/trumpCallLogger');
        const csv = trumpCallsToCSV(state.trumpCallLogs);
        const blob = new Blob([csv], { type: 'text/tab-separated-values' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trump_calls_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-slate-900 border-2 border-slate-800 w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="p-10">
                    <div className="flex justify-between items-start mb-10">
                        <div>
                            <h2 className="text-4xl font-black text-white italic tracking-tighter mb-2">Stats</h2>
                            <div className="flex gap-4 mt-6">
                                <button
                                    onClick={() => setTab('me')}
                                    className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${tab === 'me' ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                                >
                                    My Stats
                                </button>
                                <button
                                    onClick={() => setTab('league')}
                                    className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${tab === 'league' ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                                >
                                    Leaderboard
                                </button>
                                <button
                                    onClick={() => setTab('trumps')}
                                    className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${tab === 'trumps' ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                                >
                                    Trump Calls
                                </button>
                                {state.currentViewPlayerName === 'Aaron' && (
                                    <button
                                        onClick={() => setTab('admin')}
                                        className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${tab === 'admin' ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-slate-800 text-red-400 hover:text-red-300'}`}
                                    >
                                        🔧 Admin
                                    </button>
                                )}
                                <button
                                    onClick={downloadSessionLog}
                                    disabled={state.eventLog.length === 0}
                                    className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${state.eventLog.length > 0
                                        ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 border-slate-700/50 cursor-pointer'
                                        : 'bg-slate-900 text-slate-700 border-slate-800/30 cursor-not-allowed opacity-50'
                                        }`}
                                    title={state.eventLog.length > 0 ? `Download ${state.eventLog.length} events` : 'No events to download yet'}
                                >
                                    📥 Download Log {state.eventLog.length > 0 && `(${state.eventLog.length})`}
                                </button>
                            </div>
                        </div>
                        <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-400 p-4 rounded-3xl transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {tab === 'me' ? (
                        <div className="space-y-10 overflow-y-auto max-h-[60vh] pr-4 custom-scrollbar">
                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 border-b border-slate-800 pb-2">Efficiency & Global</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Games Played', value: human.stats.gamesPlayed, color: 'text-slate-400' },
                                        { label: 'Game Win %', value: `${human.stats.gamesPlayed > 0 ? Math.round((human.stats.gamesWon / human.stats.gamesPlayed) * 100) : 0}%`, color: 'text-emerald-400' },
                                        { label: 'Hands Played', value: human.stats.handsPlayed, color: 'text-slate-400' },
                                        { label: 'Hand Win %', value: `${human.stats.handsPlayed > 0 ? Math.round((human.stats.handsWon / human.stats.handsPlayed) * 100) : 0}%`, color: 'text-cyan-400' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-slate-800/40 border border-slate-700/30 p-5 rounded-[2rem]">
                                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</div>
                                            <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 border-b border-slate-800 pb-2">Trick Play</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Tricks Played', value: human.stats.tricksPlayed, color: 'text-slate-400' },
                                        { label: 'Tricks Taken', value: human.stats.tricksTaken, color: 'text-purple-400' },
                                        { label: 'Tricks Won (Team)', value: human.stats.tricksWonTeam, color: 'text-indigo-400' },
                                        { label: 'Trick Win %', value: `${human.stats.tricksPlayed > 0 ? Math.round((human.stats.tricksWonTeam / human.stats.tricksPlayed) * 100) : 0}%`, color: 'text-indigo-400' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-slate-800/40 border border-slate-700/30 p-5 rounded-[2rem]">
                                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</div>
                                            <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 border-b border-slate-800 pb-2">Bidding & Loners</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Hands Called', value: human.stats.callsMade, color: 'text-amber-400' },
                                        { label: 'Called Hands Won', value: human.stats.callsWon, color: 'text-amber-500' },
                                        { label: 'Loner Attempts', value: human.stats.lonersAttempted, color: 'text-pink-400' },
                                        { label: 'Loners Won (5/5)', value: human.stats.lonersConverted, color: 'text-pink-500' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-slate-800/40 border border-slate-700/30 p-5 rounded-[2rem]">
                                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</div>
                                            <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 border-b border-slate-800 pb-2">Impact Moments</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Euchred Opponent', value: human.stats.euchresMade, color: 'text-red-400' },
                                        { label: 'Been Euchred', value: human.stats.euchred, color: 'text-red-900' },
                                        { label: 'Sweeps (5 Tricks)', value: human.stats.sweeps, color: 'text-yellow-400' },
                                        { label: 'Been Swept (0/5)', value: human.stats.swept, color: 'text-slate-700' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-slate-800/40 border border-slate-700/30 p-5 rounded-[2rem]">
                                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</div>
                                            <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : tab === 'league' ? (
                        <div className="bg-slate-800/30 border border-slate-800 rounded-[2rem] overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-800/50 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                        <th className="px-6 py-4">Player</th>
                                        <th className="px-6 py-4">GP</th>
                                        <th className="px-6 py-4">Game Win %</th>
                                        <th className="px-6 py-4">Hand Win %</th>
                                        <th className="px-6 py-4">Tricks Taken</th>
                                        <th className="px-6 py-4">Tricks %</th>
                                        <th className="px-6 py-4 text-right">Euchres Made</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {leaguePlayers.map((p: any, i: number) => {
                                        // Calculate tricks %: tricks taken / (hands played * 5)
                                        const totalPossibleTricks = p.handsPlayed * 5;
                                        const tricksPercent = totalPossibleTricks > 0
                                            ? Math.round((p.tricksTaken / totalPossibleTricks) * 100)
                                            : 0;

                                        return (
                                            <tr key={i} className={`group hover:bg-slate-800/50 transition-colors ${p.name === human.name ? 'bg-emerald-500/5' : ''}`}>
                                                <td className="px-6 py-4 font-black text-white flex items-center gap-3">
                                                    <span className="text-slate-600 text-[10px] tabular-nums">{i + 1}</span>
                                                    {p.name}
                                                    {p.name === human.name && <span className="bg-emerald-500 text-[8px] px-2 py-0.5 rounded-full">YOU</span>}
                                                </td>
                                                <td className="px-6 py-4 text-slate-400 font-bold tabular-nums">{p.gamesPlayed}</td>
                                                <td className="px-6 py-4 text-emerald-400 font-black tabular-nums">
                                                    {p.gamesPlayed > 0 ? Math.round((p.gamesWon / p.gamesPlayed) * 100) : 0}%
                                                </td>
                                                <td className="px-6 py-4 text-cyan-400 font-black tabular-nums">
                                                    {p.handsPlayed > 0 ? Math.round((p.handsWon / p.handsPlayed) * 100) : 0}%
                                                </td>
                                                <td className="px-6 py-4 text-purple-400 font-black tabular-nums">
                                                    {p.tricksTaken}
                                                </td>
                                                <td className="px-6 py-4 text-purple-300 font-black tabular-nums">
                                                    {tricksPercent}%
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-red-400 tabular-nums">
                                                    {p.euchresMade}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : tab === 'trumps' ? (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-slate-400">
                                    {state.trumpCallLogs.length} trump calls logged this session
                                </div>
                                <button
                                    onClick={downloadTrumpCallsCSV}
                                    disabled={state.trumpCallLogs.length === 0}
                                    className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${state.trumpCallLogs.length > 0
                                        ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                                        : 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                                        }`}
                                >
                                    📥 Export CSV
                                </button>
                            </div>

                            {state.trumpCallLogs.length === 0 ? (
                                <div className="bg-slate-800/30 border border-slate-800 rounded-[2rem] p-12 text-center">
                                    <div className="text-slate-500 text-lg mb-2">No trump calls logged yet</div>
                                    <div className="text-slate-600 text-sm">Play some hands and trump calls will appear here for analysis</div>
                                </div>
                            ) : (
                                <div className="bg-slate-800/30 border border-slate-800 rounded-[2rem] overflow-hidden">
                                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-800/50 sticky top-0">
                                                <tr className="text-[9px] font-black text-slate-500 uppercase">
                                                    <th className="px-4 py-3">Who Called</th>
                                                    <th className="px-4 py-3">Type</th>
                                                    <th className="px-4 py-3">Dealer</th>
                                                    <th className="px-4 py-3">Picked Up</th>
                                                    <th className="px-4 py-3">Trump</th>
                                                    <th className="px-4 py-3 text-center">Bowers</th>
                                                    <th className="px-4 py-3 text-center">Trump #</th>
                                                    <th className="px-4 py-3 text-center">Suit #</th>
                                                    <th className="px-4 py-3">Hand After Discard</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800">
                                                {state.trumpCallLogs.map((log, i) => (
                                                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                                        <td className="px-4 py-3 font-bold text-white">{log.whoCalled}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-1 rounded text-[9px] font-black ${log.userType === 'Human'
                                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                                : 'bg-blue-500/20 text-blue-400'
                                                                }`}>
                                                                {log.userType}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-400 text-[10px]">{log.dealer}</td>
                                                        <td className="px-4 py-3 text-cyan-400 font-bold">{log.cardPickedUp}</td>
                                                        <td className="px-4 py-3 text-emerald-400 font-black">{log.suitCalled}</td>
                                                        <td className="px-4 py-3 text-purple-400 font-bold text-center">{log.bowerCount}</td>
                                                        <td className="px-4 py-3 text-purple-400 font-bold text-center">{log.trumpCount}</td>
                                                        <td className="px-4 py-3 text-blue-400 font-bold text-center">{log.suitCount}</td>
                                                        <td className="px-4 py-3 text-slate-300 font-mono text-[10px]">{log.handAfterDiscard}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : tab === 'admin' ? (
                        <div className="space-y-6">
                            <div className="text-red-400 text-sm font-bold mb-4">
                                🔧 ADMIN DASHBOARD - Freeze Monitoring & Analytics
                            </div>

                            {/* Freeze Rate Card */}
                            {freezeRate && (
                                <div className="bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-800/50 rounded-[2rem] p-6">
                                    <div className="text-xs font-black text-red-400 uppercase tracking-widest mb-4">
                                        Freeze Metrics (Last {freezeRate.timeRange})
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <div className="text-3xl font-black text-white">{freezeRate.total}</div>
                                            <div className="text-xs text-slate-400">Total Freezes</div>
                                        </div>
                                        <div>
                                            <div className="text-3xl font-black text-emerald-400">{freezeRate.recovered}</div>
                                            <div className="text-xs text-slate-400">Recovered</div>
                                        </div>
                                        <div>
                                            <div className="text-3xl font-black text-red-400">{freezeRate.unrecovered}</div>
                                            <div className="text-xs text-slate-400">Unrecovered</div>
                                        </div>
                                        <div>
                                            <div className="text-3xl font-black text-cyan-400">{freezeRate.recoveryRate}</div>
                                            <div className="text-xs text-slate-400">Recovery Rate</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-red-800/30">
                                        <div className="text-sm text-slate-300">
                                            <span className="font-bold text-yellow-400">{freezeRate.freezesPerHour}</span> freezes/hour average
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Recent Freeze Incidents */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                        Recent Freeze Incidents
                                    </div>
                                    <button
                                        onClick={() => { getFreezeStats().then(setFreezeStats); getFreezeRate(24).then(setFreezeRate); }}
                                        className="px-4 py-2 rounded-full text-[10px] font-black bg-slate-800 text-slate-400 hover:bg-slate-700 transition-all"
                                    >
                                        🔄 Refresh
                                    </button>
                                </div>

                                {!freezeStats ? (
                                    <div className="bg-slate-800/30 border border-slate-800 rounded-[2rem] p-12 text-center">
                                        <div className="text-slate-500">Loading freeze data...</div>
                                    </div>
                                ) : freezeStats.length === 0 ? (
                                    <div className="bg-slate-800/30 border border-slate-800 rounded-[2rem] p-12 text-center">
                                        <div className="text-emerald-500 text-lg mb-2">🎉 No Freeze Incidents!</div>
                                        <div className="text-slate-600 text-sm">All games running smoothly</div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-800/30 border border-slate-800 rounded-[2rem] overflow-hidden">
                                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-800/50 sticky top-0">
                                                    <tr className="text-[9px] font-black text-slate-500 uppercase">
                                                        <th className="px-4 py-3">Time</th>
                                                        <th className="px-4 py-3">Game</th>
                                                        <th className="px-4 py-3">Type</th>
                                                        <th className="px-4 py-3">Phase</th>
                                                        <th className="px-4 py-3">Player</th>
                                                        <th className="px-4 py-3">Duration</th>
                                                        <th className="px-4 py-3">Recovery</th>
                                                        <th className="px-4 py-3">Version</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800">
                                                    {freezeStats.map((incident: any) => (
                                                        <tr key={incident.id} className="hover:bg-slate-800/30 transition-colors">
                                                            <td className="px-4 py-3 text-slate-400 text-[10px]">
                                                                {new Date(incident.created_at).toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-cyan-400 font-bold">
                                                                {incident.game_code}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="px-2 py-1 rounded text-[9px] font-black bg-red-500/20 text-red-400">
                                                                    {incident.freeze_type}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-purple-400">{incident.phase}</td>
                                                            <td className="px-4 py-3">
                                                                <div className="text-white font-bold">{incident.current_player_name || 'Unknown'}</div>
                                                                <div className="text-[9px] text-slate-500">
                                                                    {incident.is_bot ? '🤖 Bot' : '👤 Human'}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-yellow-400 font-bold">
                                                                {(incident.time_since_active_ms / 1000).toFixed(0)}s
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {incident.recovered ? (
                                                                    <span className="px-2 py-1 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-400">
                                                                        ✓ Recovered
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-1 rounded text-[9px] font-black bg-red-500/20 text-red-400">
                                                                        ✗ Failed
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">
                                                                {incident.app_version}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}

                    <div className="mt-10 pt-10 border-t border-slate-800 flex justify-center">
                        <button onClick={onClose} className="bg-white text-slate-900 font-black py-4 px-12 rounded-2xl shadow-xl text-lg hover:scale-105 transition-transform active:scale-95">BACK TO TABLE</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TableOverlay = () => {
    const { state, dispatch } = useGame();

    // Don't show if no overlay message
    if (!state.overlayMessage) return null;

    // Auto-advance from scoring when everyone has acknowledged
    React.useEffect(() => {
        if (state.phase === 'scoring' && state.overlayMessage) {
            const humanPlayers = state.players.filter(p => p.name && !p.isComputer);
            const allAcknowledged = humanPlayers.every(p => state.overlayAcknowledged[p.name || '']);

            if (allAcknowledged) {
                // Everyone acknowledged - auto-advance after short delay
                const timer = setTimeout(() => {
                    dispatch({ type: 'FINISH_HAND' });
                }, 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [state.phase, state.overlayMessage, state.overlayAcknowledged, state.players]);

    const handleClick = () => {
        const myName = state.currentViewPlayerName;
        if (myName && !state.overlayAcknowledged[myName]) {
            // Mark as acknowledged
            dispatch({ type: 'CLEAR_OVERLAY' });
        }
    };

    return (
        <div
            onClick={handleClick}
            className="absolute inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300 cursor-pointer"
        >
            <div className="bg-emerald-500 text-white px-6 md:px-12 py-6 md:py-8 rounded-2xl md:rounded-[3rem] shadow-[0_0_100px_rgba(16,185,129,0.4)] border-4 border-white animate-in zoom-in slide-in-from-bottom-12 duration-500 max-w-lg w-full max-h-[80vh] flex flex-col">
                <div className="text-[10px] font-black uppercase tracking-[0.4em] mb-3 md:mb-2 opacity-80 text-center shrink-0">Event Notification</div>
                <div className="text-lg md:text-2xl font-black italic tracking-tight text-center overflow-y-auto flex-1 px-2">{state.overlayMessage}</div>
                <div className="mt-4 md:mt-6 text-[8px] font-black uppercase tracking-widest opacity-60 text-center animate-pulse shrink-0">Click to continue</div>
            </div>
        </div>
    );
};

const LoginPage = () => {
    const { dispatch } = useGame();
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const ALLOWED_USERS = ['Aaron', 'Polina', 'Gray-Gray', 'Mimi', 'Micah', 'Cherrie', 'Peter-Playwright'];

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        const match = ALLOWED_USERS.find(u => u.toLowerCase() === trimmed.toLowerCase());

        if (match) {
            dispatch({ type: 'LOGIN', payload: { userName: match } });
        } else {
            setError('Unauthorized access. Please use a recognized name.');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full max-w-lg p-8 animate-in fade-in zoom-in duration-700">
            <h1 className="text-7xl font-black bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent italic leading-none mb-12 tracking-tighter">
                EUCHRE
            </h1>

            <div className="w-full bg-slate-900/50 p-10 rounded-[3rem] border-2 border-slate-800 backdrop-blur-3xl shadow-2xl">
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">RESTRICTED ACCESS</label>
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            className="w-full bg-slate-950 border-2 border-slate-800 rounded-3xl px-8 py-5 text-xl font-black text-white focus:border-emerald-500 outline-none transition-all placeholder:text-slate-700"
                            placeholder="Enter Username"
                        />
                        {error && <p className="text-red-400 text-[10px] font-black uppercase tracking-widest ml-4 mt-2">Error: {error}</p>}
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-emerald-500 text-white font-black py-6 rounded-3xl text-xl shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:scale-105 active:scale-95 transition-all"
                    >
                        LOGIN
                    </button>
                </form>
            </div>
            <p className="mt-12 text-slate-600 text-[10px] font-black uppercase tracking-widest">Property of the euchre collective</p>
        </div>
    );
};

const LandingPage = () => {
    const { state, dispatch } = useGame();
    const [code, setCode] = useState('');
    const [showJoin, setShowJoin] = useState(false);
    const [_refreshKey, setRefreshKey] = useState(0);
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [statsInitialTab, setStatsInitialTab] = useState<'me' | 'league' | 'trumps' | 'admin'>('me');
    const [cloudGames, setCloudGames] = useState<any[]>([]);
    const [gameFilter, setGameFilter] = useState<'in-progress' | 'completed'>('in-progress');

    useEffect(() => {
        const loadCloudGames = async () => {
            if (!state.currentUser) {
                return;
            }
            const games = await fetchUserCloudGames(state.currentUser);
            setCloudGames(games);
        };
        loadCloudGames();
    }, [state.currentUser, _refreshKey]);

    const savedGamesRaw = getSavedGames();
    const localGames = Object.values(savedGamesRaw)
        .filter(g =>
            g.currentUser === state.currentUser ||
            g.players.some(p => p.name === state.currentUser)
        );

    const savedGames = mergeLocalAndCloudGames(localGames, cloudGames);

    const getTimeAgo = (game: any) => {
        if (!game.lastActive) return "Recently";
        const diff = Date.now() - game.lastActive;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return "Just now";
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const handleCodeChange = (value: string) => {
        // Remove any non-digit characters except dash
        let cleaned = value.replace(/[^\d-]/g, '');

        // Remove existing dashes
        cleaned = cleaned.replace(/-/g, '');

        // Add dash after 3 digits
        if (cleaned.length > 3) {
            cleaned = cleaned.slice(0, 3) + '-' + cleaned.slice(3, 6);
        }

        setCode(cleaned);
    };

    const handleJoinTable = async () => {
        if (!code) return;

        // 1. Try to find the game in the cloud
        const { data } = await supabase
            .from('games')
            .select('state')
            .eq('code', code)
            .single();

        if (data && data.state) {
            dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: data.state } });
            dispatch({ type: 'JOIN_TABLE', payload: { code, userName: state.currentUser! } });
        } else {
            // Local join as fallback/init
            dispatch({ type: 'JOIN_TABLE', payload: { code, userName: state.currentUser! } });
        }
    };

    // Helper to delete game
    const handleDelete = async (tableCode: string | null) => {
        if (!tableCode) return;
        if (confirm('Are you sure you want to delete this game?')) {
            await deleteActiveGame(tableCode);
            setRefreshKey(prev => prev + 1);
        }
    };

    return (
        <div className="flex flex-col items-center justify-start min-h-full w-full max-w-2xl p-4 md:p-8 pt-2 md:pt-8 animate-in fade-in zoom-in duration-700 overflow-y-auto pb-20">
            {/* Header with Branding */}
            <div className="w-full mb-4 md:mb-12">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent italic leading-none tracking-tighter">
                            EUCHRE
                        </h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 ml-1">Authenticated: {state.currentUser}</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setStatsInitialTab('me'); setIsStatsOpen(true); }}
                            className="text-[10px] font-black text-slate-300 hover:text-white hover:bg-slate-800 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl border-2 border-slate-800/50 transition-all uppercase tracking-widest"
                        >
                            Stats
                        </button>
                        {state.currentUser === 'Aaron' && (
                            <button
                                onClick={() => { setStatsInitialTab('admin'); setIsStatsOpen(true); }}
                                className="text-[10px] font-black text-red-400 hover:text-white hover:bg-red-500 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl border-2 border-red-500/20 transition-all uppercase tracking-widest"
                            >
                                🔧 Admin
                            </button>
                        )}
                        <button
                            onClick={() => dispatch({ type: 'LOGOUT' })}
                            className="text-[10px] font-black text-red-500 hover:text-white hover:bg-red-500 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl border-2 border-red-500/20 transition-all uppercase tracking-widest"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                {/* Main Action Buttons */}
                {!showJoin ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-8">
                        <button
                            onClick={() => dispatch({ type: 'CREATE_TABLE', payload: { userName: state.currentUser! } })}
                            className="bg-white text-slate-950 font-black py-8 md:py-10 rounded-2xl md:rounded-[2.5rem] text-base md:text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-center uppercase tracking-tight"
                        >
                            CREATE GAME
                        </button>
                        <button
                            onClick={() => setShowJoin(true)}
                            className="bg-slate-900 text-white font-black py-8 md:py-10 rounded-2xl md:rounded-[2.5rem] text-base md:text-xl border-2 border-slate-800 hover:bg-slate-800 active:scale-95 transition-all uppercase tracking-tight"
                        >
                            JOIN TABLE
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in slide-in-from-right-8 duration-500 bg-slate-900/50 p-6 md:p-8 rounded-2xl md:rounded-[3rem] border-2 border-slate-800 mb-8">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">6-DIGIT CODE</label>
                            <input
                                autoFocus
                                value={code}
                                onChange={(e) => handleCodeChange(e.target.value)}
                                maxLength={7}
                                className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl md:rounded-3xl px-6 md:px-8 py-4 md:py-5 text-3xl md:text-4xl font-black text-white text-center focus:border-emerald-500 outline-none transition-all placeholder:text-slate-800"
                                placeholder="000-000"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                            <button
                                onClick={() => { setShowJoin(false); setCode(''); }}
                                className="bg-slate-800 text-white font-black py-4 md:py-6 rounded-2xl md:rounded-3xl text-base md:text-xl border-2 border-slate-700 hover:bg-slate-700 transition-all uppercase"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={handleJoinTable}
                                className="bg-emerald-500 text-white font-black py-4 md:py-6 rounded-2xl md:rounded-3xl text-base md:text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all uppercase"
                            >
                                JOIN TABLE
                            </button>
                        </div>
                    </div>
                )}

                {/* Continue Progress Section */}
                {savedGames.length > 0 && (
                    <div className="space-y-2 md:space-y-4">
                        {/* Tabs for game filtering */}
                        <div className="flex gap-2 border-b-2 border-slate-800/50">
                            <button
                                onClick={() => setGameFilter('in-progress')}
                                className={`flex-1 text-[10px] md:text-xs font-black uppercase tracking-widest py-2 px-4 transition-all ${gameFilter === 'in-progress'
                                    ? 'text-emerald-400 border-b-2 border-emerald-500 -mb-[2px]'
                                    : 'text-slate-600 hover:text-slate-400'
                                    }`}
                            >
                                In Progress ({savedGames.filter(g => g.phase !== 'game_over').length})
                            </button>
                            <button
                                onClick={() => setGameFilter('completed')}
                                className={`flex-1 text-[10px] md:text-xs font-black uppercase tracking-widest py-2 px-4 transition-all ${gameFilter === 'completed'
                                    ? 'text-emerald-400 border-b-2 border-emerald-500 -mb-[2px]'
                                    : 'text-slate-600 hover:text-slate-400'
                                    }`}
                            >
                                Completed ({savedGames.filter(g => g.phase === 'game_over').length})
                            </button>
                        </div>

                        <div className="max-h-[300px] md:max-h-[400px] overflow-y-auto space-y-2 md:space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950">
                            {savedGames
                                .filter(g => gameFilter === 'in-progress' ? g.phase !== 'game_over' : g.phase === 'game_over')
                                .map(game => (
                                    <div
                                        key={game.tableId}
                                        className="group relative w-full bg-slate-900/40 hover:bg-emerald-500/10 border-2 border-emerald-500/30 hover:border-emerald-500 rounded-xl md:rounded-[2rem] px-3 md:px-8 py-3 md:py-6 transition-all shadow-xl"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div
                                                className="text-left flex-1 cursor-pointer"
                                                onClick={() => dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: game } })}
                                            >
                                                <div className="text-lg md:text-2xl font-black text-emerald-400 group-hover:text-emerald-300 transition-colors italic tracking-tight leading-tight">
                                                    {game.tableName}
                                                </div>
                                                <div className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 md:mt-1.5 opacity-80">
                                                    {game.phase} • Team A: {game.scores.team1} Team B: {game.scores.team2}
                                                </div>
                                                <div className="text-[8px] md:text-[9px] font-bold text-slate-600 mt-0.5 md:mt-1">
                                                    Last Activity: {getTimeAgo(game)}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 md:gap-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(game.tableCode); }}
                                                    className="text-slate-600 hover:text-red-500 transition-colors p-1 md:p-2"
                                                    title="Delete Game"
                                                >
                                                    <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: game } })}
                                                    className="bg-emerald-500 hover:bg-emerald-400 text-white font-black px-3 md:px-6 py-1.5 md:py-3 rounded-lg md:rounded-2xl text-[9px] md:text-xs uppercase tracking-widest transition-all shadow-md"
                                                >
                                                    Resume
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Version */}
            <div className="mt-auto pt-4 md:pt-12 text-center space-y-3 md:space-y-4">
                <button
                    onClick={() => dispatch({ type: 'LOGOUT' })}
                    className="w-full bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-black px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl text-xs md:text-sm uppercase tracking-widest border-2 border-red-500/30 hover:border-red-500 transition-all shadow-lg"
                >
                    Logout from {state.currentUser}
                </button>
                <div className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em]">
                    Euchre Engine V0.46
                </div>
            </div>

            <StatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} initialTab={statsInitialTab} />
        </div>
    );
};

const StatsView = () => {
    const { state } = useGame();
    const [tab, setTab] = useState<'me' | 'league'>('me');
    const mySeatIndex = state.players.findIndex(p => p.name === state.currentViewPlayerName);
    const human = mySeatIndex !== -1 ? state.players[mySeatIndex] : {
        name: state.currentViewPlayerName,
        stats: getEmptyStats()
    };

    const globalStats = JSON.parse(localStorage.getItem('euchre_global_profiles') || '{}');
    const leaguePlayers = Object.keys(globalStats).map(name => ({
        name,
        ...globalStats[name]
    })).sort((a: any, b: any) => (b.gamesWon / Math.max(1, b.gamesPlayed)) - (a.gamesWon / Math.max(1, a.gamesPlayed)));

    return (
        <div className="md:hidden flex-1 bg-slate-900/95 rounded-[2rem] p-4 overflow-y-auto w-full h-full flex flex-col pt-20">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-white italic tracking-tighter">Stats</h2>
                <div className="flex gap-2 bg-slate-800/50 p-1 rounded-full">
                    <button
                        onClick={() => setTab('me')}
                        className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'me' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500'}`}
                    >
                        Career
                    </button>
                    <button
                        onClick={() => setTab('league')}
                        className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'league' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500'}`}
                    >
                        League
                    </button>
                </div>
            </div>

            {tab === 'me' ? (
                <div className="space-y-6 pb-20">
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Games Played', value: human.stats.gamesPlayed, color: 'text-slate-400' },
                            { label: 'Win Rate', value: `${human.stats.gamesPlayed > 0 ? Math.round((human.stats.gamesWon / human.stats.gamesPlayed) * 100) : 0}%`, color: 'text-emerald-400' },
                            { label: 'Hand Win %', value: `${human.stats.handsPlayed > 0 ? Math.round((human.stats.handsWon / human.stats.handsPlayed) * 100) : 0}%`, color: 'text-cyan-400' },
                            { label: 'Sweeps', value: human.stats.sweeps, color: 'text-yellow-400' },
                        ].map((stat, i) => (
                            <div key={i} className="bg-slate-800/40 border border-slate-700/30 p-4 rounded-2xl">
                                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</div>
                                <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
                            </div>
                        ))}
                    </div>

                    <div>
                        <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Trick Taking</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Tricks Taken', value: human.stats.tricksTaken, color: 'text-purple-400' },
                                {
                                    label: 'Tricks %',
                                    value: `${human.stats.handsPlayed > 0 ? Math.round((human.stats.tricksTaken / (human.stats.handsPlayed * 5)) * 100) : 0}%`,
                                    color: 'text-purple-300'
                                },
                                { label: 'Euchres', value: human.stats.euchresMade, color: 'text-pink-400' },
                            ].map((stat, i) => (
                                <div key={i} className="bg-slate-800/40 border border-slate-700/30 p-4 rounded-2xl">
                                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</div>
                                    <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-800/30 border border-slate-800 rounded-2xl overflow-hidden pb-20">
                    <table className="w-full text-left">
                        <thead className="bg-slate-800/50 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                            <tr>
                                <th className="px-4 py-3">Player</th>
                                <th className="px-4 py-3 text-right">Win %</th>
                                <th className="px-4 py-3 text-right">Tricks %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {leaguePlayers.map((p: any, i: number) => {
                                // Calculate tricks taken percentage
                                // Each hand has 5 tricks, so total possible = handsPlayed * 5
                                const totalPossibleTricks = p.handsPlayed * 5;
                                const tricksPercent = totalPossibleTricks > 0
                                    ? Math.round((p.tricksTaken / totalPossibleTricks) * 100)
                                    : 0;

                                return (
                                    <tr key={i} className={`group ${p.name === human.name ? 'bg-emerald-500/5' : ''}`}>
                                        <td className="px-4 py-3 font-black text-white flex items-center gap-3">
                                            <span className="text-slate-600 text-[9px] tabular-nums">{i + 1}</span>
                                            <span className="text-sm">{p.name}</span>
                                        </td>
                                        <td className="px-4 py-3 text-emerald-400 font-black text-sm tabular-nums text-right">
                                            {p.gamesPlayed > 0 ? Math.round((p.gamesWon / p.gamesPlayed) * 100) : 0}%
                                        </td>
                                        <td className="px-4 py-3 text-purple-400 font-black text-sm tabular-nums text-right">
                                            {tricksPercent}%
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const TabButton = ({ active, onClick, children }: any) => (
    <button
        onClick={onClick}
        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${active
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
            : 'text-slate-500 hover:text-slate-300'
            }`}
    >
        {children}
    </button>
);

const GameView = () => {
    const { state, dispatch } = useGame();
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    // @ts-ignore - Will be used when admin button is added to GameView
    const [statsInitialTab, setStatsInitialTab] = useState<'me' | 'league' | 'trumps' | 'admin'>('me');
    const [activeTab, setActiveTab] = useState<'table' | 'commentary' | 'stats'>('table');

    const handleNextStep = () => {
        // AI execution is handled in GameStore useEffect hooks
    };

    if (state.phase === 'login') return <LoginPage />;
    if (state.phase === 'landing') return <LandingPage />;

    // Game Over Screen
    if (state.phase === 'game_over') {
        const winner = state.scores.team1 >= 10 ? state.teamNames.team1 : state.teamNames.team2;
        return (
            <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto p-8 animate-in fade-in zoom-in duration-700">
                <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-10 md:p-16 rounded-[3rem] border-4 border-emerald-500 shadow-[0_0_80px_rgba(16,185,129,0.5)] relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent pointer-events-none" />

                    <div className="relative z-10 space-y-8">
                        <h1 className="text-6xl md:text-7xl font-black bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent text-center leading-none">
                            GAME OVER!
                        </h1>

                        <div className="text-center space-y-2">
                            <div className="text-2xl md:text-3xl font-black text-emerald-400 uppercase tracking-wide">
                                🏆 {winner} Wins! 🏆
                            </div>
                            <div className="text-lg text-slate-400 font-bold">
                                Final Score: {state.scores.team1} - {state.scores.team2}
                            </div>
                        </div>

                        <div className="bg-slate-950/50 rounded-2xl p-6 border border-slate-700">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <div className="text-sm text-slate-500 font-black uppercase tracking-wider mb-2">{state.teamNames.team1}</div>
                                    <div className={`text-5xl font-black ${state.scores.team1 >= 10 ? 'text-emerald-400' : 'text-slate-600'}`}>
                                        {state.scores.team1}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-slate-500 font-black uppercase tracking-wider mb-2">{state.teamNames.team2}</div>
                                    <div className={`text-5xl font-black ${state.scores.team2 >= 10 ? 'text-emerald-400' : 'text-slate-600'}`}>
                                        {state.scores.team2}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}
                                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-6 rounded-2xl text-xl shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all active:scale-95"
                            >
                                GO HOME
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <LayoutGroup>
            <div className="w-full h-full max-w-7xl max-h-screen flex flex-col md:flex-row p-2 md:p-6 gap-4 md:gap-6 overflow-hidden">

                {/* Mobile Tabs */}
                <div className="flex md:hidden w-full shrink-0 bg-slate-900/90 rounded-2xl p-1 mb-2 border border-slate-800">
                    <TabButton active={activeTab === 'table'} onClick={() => setActiveTab('table')}>TABLE</TabButton>
                    <TabButton active={activeTab === 'commentary'} onClick={() => setActiveTab('commentary')}>COMMENTARY</TabButton>
                    <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>STATS</TabButton>
                </div>

                {/* Table Commentary Log (Sidebar) */}
                <div className={`md:w-72 bg-slate-900/90 rounded-[3rem] border border-slate-800/50 p-6 backdrop-blur-3xl flex flex-col shadow-2xl shrink-0 ${activeTab === 'commentary' ? 'flex flex-1 w-full order-last' : 'hidden md:flex'}`}>
                    <div className="flex flex-col gap-4 mb-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Table Commentary
                            </h2>
                            {state.phase !== 'lobby' && (
                                <button
                                    onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}
                                    className="text-[8px] font-black text-red-500/50 hover:text-red-500 uppercase tracking-widest"
                                >
                                    Exit
                                </button>
                            )}
                        </div>

                        {state.tableCode && (
                            <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 flex items-center justify-between group cursor-pointer hover:border-emerald-500/50 transition-all"
                                onClick={() => navigator.clipboard.writeText(state.tableCode!)}
                            >
                                <div>
                                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Table Code</div>
                                    <div className="text-xl font-black text-white tracking-widest group-hover:text-emerald-400 transition-colors">{state.tableCode}</div>
                                </div>
                                <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest bg-slate-900 px-2 py-1 rounded group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-colors">
                                    COPY
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                        {state.logs.map((log: string, i: number) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className={`text-xs font-bold leading-relaxed ${i === 0 ? 'text-emerald-400' : 'text-slate-400'}`}
                            >
                                {log}
                            </motion.div>
                        ))}
                    </div>
                </div>

                <StatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} initialTab={statsInitialTab} />

                <div className={`flex-1 bg-slate-900/95 rounded-[2rem] md:rounded-[3rem] shadow-2xl border border-slate-800/50 p-3 md:p-8 backdrop-blur-3xl flex flex-col relative overflow-hidden ${activeTab === 'table' ? 'flex' : 'hidden md:flex'}`}>

                    <div className="flex justify-between items-start md:items-center mb-2 md:mb-4">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <h1 className="text-lg md:text-2xl font-black bg-gradient-to-br from-emerald-400 to-blue-500 bg-clip-text text-transparent italic leading-none">
                                    {state.tableName || 'Euchre'}
                                </h1>
                                {state.tableCode && (
                                    <>
                                        <div className="hidden md:block text-[10px] font-black text-slate-500 tracking-[0.2em] mt-1">CODE: {state.tableCode}</div>
                                        <div className="md:hidden text-[8px] font-bold text-slate-600 tracking-wider mt-0.5">{state.tableCode}</div>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={() => setIsStatsOpen(true)}
                                className="hidden md:block bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all shadow-sm"
                            >
                                Stats
                            </button>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    if (!state.tableCode) return;
                                    const { data } = await supabase.from('games').select('state').eq('code', state.tableCode).single();
                                    if (data && data.state) {
                                        dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: data.state } });
                                        // Preserve user view
                                        dispatch({ type: 'JOIN_TABLE', payload: { code: state.tableCode, userName: state.currentUser! } });
                                    }
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3 py-1 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-slate-700 transition-all shadow-sm"
                            >
                                Sync
                            </button>

                            {state.phase === 'lobby' ? (
                                <button
                                    onClick={() => {
                                        // Check if there are empty seats
                                        const emptySeats = state.players.filter(p => !p.name).length;

                                        if (emptySeats > 0) {
                                            // Prompt user to auto-fill
                                            if (confirm(`There ${emptySeats === 1 ? 'is 1 empty seat' : `are ${emptySeats} empty seats`}. Would you like to auto-fill with bots?`)) {
                                                // Auto-fill empty seats with bots
                                                dispatch({ type: 'AUTOFILL_BOTS' });
                                                // Then start the match
                                                setTimeout(() => dispatch({ type: 'START_MATCH' }), 100);
                                            }
                                        } else {
                                            // All seats filled, start immediately
                                            dispatch({ type: 'START_MATCH' });
                                        }
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1 px-4 md:py-2 md:px-10 rounded-lg md:rounded-xl transition transform active:scale-95 text-[10px] md:text-sm shadow-lg shadow-emerald-500/20 animate-pulse"
                                >
                                    START
                                </button>
                            ) : (
                                <button
                                    onClick={() => dispatch({ type: 'TOGGLE_STEP_MODE' })}
                                    className={`font-black py-1 px-3 md:py-2 md:px-6 rounded-lg md:rounded-xl transition border text-[8px] md:text-[10px] flex items-center gap-2
                                        ${state.stepMode ? 'bg-amber-500 text-white border-white/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
                                >
                                    {state.stepMode ? 'Step: ON' : 'Step'}
                                </button>
                            )}
                            <button
                                onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}
                                className="bg-slate-800 hover:bg-red-500 text-slate-400 hover:text-white px-3 py-1 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase border border-slate-700 transition-all"
                            >
                                Leave
                            </button>
                        </div>
                    </div>

                    {state.phase !== 'lobby' && (
                        <div className="flex justify-center items-center gap-4 md:gap-12 mb-1 md:mb-4">
                            <div className="text-center">
                                <div className="text-[8px] md:text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-0.5 md:mb-1">{state.teamNames.team1}</div>
                                <div className="text-xl md:text-3xl font-black text-white table-nums leading-none">{state.scores.team1}</div>
                            </div>

                            {state.trump && (
                                <div className="flex flex-col items-center bg-slate-800/80 px-2 py-1 md:px-4 md:py-2 rounded-xl md:rounded-2xl border border-slate-700/50">
                                    <div className="hidden md:block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">TRUMP</div>
                                    <div className={`text-lg md:text-2xl font-black leading-none ${state.trump === 'hearts' || state.trump === 'diamonds' ? 'text-red-500' : 'text-white'}`}>
                                        {state.trump === 'hearts' ? '♥' : state.trump === 'diamonds' ? '♦' : state.trump === 'clubs' ? '♣' : '♠'}
                                    </div>
                                </div>
                            )}

                            <div className="text-center">
                                <div className="text-[8px] md:text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-0.5 md:mb-1">{state.teamNames.team2}</div>
                                <div className="text-xl md:text-3xl font-black text-white table-nums leading-none">{state.scores.team2}</div>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 relative bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05)_0%,transparent_70%)] rounded-[2rem] md:rounded-[3rem] border border-slate-800/30 flex items-center justify-center overflow-hidden scale-90 md:scale-100 origin-center">

                        <TableOverlay />

                        {(() => {
                            const myIdx = state.players.findIndex(p => p.name === state.currentViewPlayerName);
                            const refIdx = myIdx === -1 ? 0 : myIdx;
                            const positions: ('bottom' | 'left' | 'top' | 'right')[] = ['bottom', 'left', 'top', 'right'];

                            return [0, 1, 2, 3].map(offset => {
                                const pIdx = (refIdx + offset) % 4;
                                return (
                                    <PlayerSeat
                                        key={pIdx}
                                        inLobby={state.phase === 'lobby'}
                                        index={pIdx}
                                        position={positions[offset]}
                                        isCurrentTurn={state.currentPlayerIndex === pIdx}
                                        isDealer={state.dealerIndex === pIdx}
                                        isAnimatingDealer={state.displayDealerIndex === pIdx}
                                    />
                                );
                            });
                        })()}

                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                            <AnimatePresence>
                                {state.currentTrick.map((t) => {
                                    const pIdx = state.players.findIndex(p => p.id === t.playerId);
                                    const mIdx = state.players.findIndex(p => p.name === state.currentViewPlayerName);
                                    const rIdx = mIdx === -1 ? 0 : mIdx;
                                    const relativePos = (pIdx - rIdx + 4) % 4;

                                    const offsets = [
                                        { y: 50, r: 0 },   // Bottom
                                        { x: -50, r: 90 }, // Left
                                        { y: -50, r: 180 },  // Top
                                        { x: 50, r: -90 }, // Right
                                    ];
                                    const { x = 0, y = 0, r = 0 } = offsets[relativePos] || {};

                                    return (
                                        <motion.div
                                            key={t.card.id}
                                            layoutId={t.card.id}
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1, x, y, rotate: r + getCardJitter(t.card.id) }}
                                            exit={{ scale: 0, opacity: 0 }}
                                            className="absolute"
                                        >
                                            <CardComponent card={t.card} size="sm" rotation={0} disabled />
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>

                            {state.phase === 'bidding' && state.biddingRound === 1 && state.upcard && (
                                (() => {
                                    const dealerIdx = state.dealerIndex;
                                    const myIdx = state.players.findIndex(p => p.name === state.currentViewPlayerName);
                                    const refIdx = myIdx === -1 ? 0 : myIdx;
                                    const relativePos = (dealerIdx - refIdx + 4) % 4;

                                    // Larger offsets to put it "on" the dealer seats
                                    const upcardOffsets = [
                                        { x: 140, y: 100, r: 15 },    // Bottom seat (offset to side to avoid bidding UI)
                                        { x: -180, y: 0, r: 90 },     // Left seat
                                        { x: 0, y: -180, r: 0 },      // Top seat
                                        { x: 180, y: 0, r: -90 },     // Right seat
                                    ];
                                    const { x, y, r } = upcardOffsets[relativePos];

                                    return (
                                        <motion.div
                                            key={state.upcard.id}
                                            layoutId={state.upcard.id}
                                            initial={{ x: 0, y: 0, scale: 0.5, opacity: 0 }}
                                            animate={{ x, y, scale: 1, opacity: 1, rotate: r }}
                                            className="absolute pointer-events-auto z-30"
                                        >
                                            <CardComponent
                                                card={state.upcard}
                                                size="md"
                                                isValid={state.phase === 'bidding'}
                                                rotation={0}
                                                disabled
                                            />
                                            {state.phase === 'bidding' && (
                                                <div className="absolute -top-3 -right-3 bg-white text-slate-950 text-[10px] font-black px-2 py-1 rounded-sm shadow-xl z-20 border border-slate-200">
                                                    UPCARD
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })()
                            )}

                            {state.phase === 'randomizing_dealer' && (
                                <div className="bg-amber-500/10 border border-amber-500/50 px-8 py-4 rounded-[2rem] backdrop-blur-3xl animate-pulse">
                                    <div className="text-amber-500 text-lg font-black uppercase tracking-tighter">Choosing Dealer...</div>
                                </div>
                            )}

                        </div>
                    </div>

                    <div className="absolute bottom-60 md:bottom-[28%] md:top-auto left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full px-4 md:w-auto md:px-0">
                        <AnimatePresence>
                            {(() => {
                                const myIdx = state.players.findIndex(p => p.name === state.currentViewPlayerName);
                                if (state.phase === 'bidding' && state.currentPlayerIndex === myIdx) {
                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, y: 50 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            className="pointer-events-auto p-3 md:p-6 bg-slate-900/90 rounded-[2rem] md:rounded-[3rem] border-2 border-emerald-500 shadow-2xl flex flex-col gap-2 md:gap-6 backdrop-blur-md w-full max-w-xs mx-auto"
                                        >
                                            <div className="text-center">
                                                <div className="text-lg md:text-xl font-black text-white italic tracking-tighter mb-1">What's the call?</div>

                                                {/* Scoreboard */}
                                                <div className="flex justify-center gap-8 mb-2 bg-slate-800/50 py-1.5 rounded-xl">
                                                    <div className="text-center">
                                                        <div className="text-[7px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">{state.teamNames.team1}</div>
                                                        <div className="text-lg font-black text-white leading-none">{state.scores.team1}</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-[7px] font-black text-emerald-500 uppercase tracking-widest mb-0.5">{state.teamNames.team2}</div>
                                                        <div className="text-lg font-black text-white leading-none">{state.scores.team2}</div>
                                                    </div>
                                                </div>

                                                <div className="text-[10px] font-bold text-slate-400 mb-2">
                                                    Your {myIdx === state.dealerIndex ? <span className="text-emerald-400">self</span> : ((myIdx + 2) % 4 === state.dealerIndex ? 'teammate' : 'opponent')} <span className="text-white">{state.players[state.dealerIndex].name}</span> is the dealer
                                                </div>

                                                {state.biddingRound === 1 && state.upcard && (
                                                    <div className="flex justify-center mb-2">
                                                        <div className="scale-75 origin-center">
                                                            <CardComponent card={state.upcard} size="md" disabled />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {state.biddingRound === 1 ? (
                                                <div className="flex gap-2 justify-center">
                                                    <button onClick={() => dispatch({ type: 'MAKE_BID', payload: { suit: state.upcard!.suit, callerIndex: myIdx, isLoner: false } })} className="bg-emerald-600 hover:bg-emerald-500 text-white flex-1 py-3 rounded-xl font-black text-[10px] md:text-sm uppercase shadow-lg shadow-emerald-500/20 leading-tight transition-transform active:scale-95">Order<br />Up</button>
                                                    <button onClick={() => dispatch({ type: 'MAKE_BID', payload: { suit: state.upcard!.suit, callerIndex: myIdx, isLoner: true } })} className="bg-amber-500 hover:bg-amber-400 text-white flex-1 py-3 rounded-xl font-black text-[10px] md:text-sm uppercase shadow-lg shadow-amber-500/20 leading-tight transition-transform active:scale-95">Go<br />Alone</button>
                                                    <button onClick={() => dispatch({ type: 'PASS_BID', payload: { playerIndex: myIdx } })} className="bg-pink-600 hover:bg-pink-500 text-white flex-1 py-3 rounded-xl font-black text-[10px] md:text-sm uppercase shadow-lg shadow-pink-500/20 leading-tight transition-transform active:scale-95 flex items-center justify-center">Pass</button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex flex-wrap justify-center gap-2">
                                                        {(['hearts', 'diamonds', 'clubs', 'spades'] as const).filter(s => s !== state.upcard!.suit).map(suit => (
                                                            <div key={suit} className="flex flex-col gap-1">
                                                                <button onClick={() => dispatch({ type: 'MAKE_BID', payload: { suit, callerIndex: myIdx, isLoner: false } })} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase border border-slate-700 transition-all hover:scale-105 active:scale-95">{suit}</button>
                                                                <button onClick={() => dispatch({ type: 'MAKE_BID', payload: { suit, callerIndex: myIdx, isLoner: true } })} className="bg-slate-800/50 hover:bg-amber-500/20 text-amber-500/50 hover:text-amber-500 px-2 py-1 rounded text-[8px] font-black uppercase transition-all">Alone</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button onClick={() => dispatch({ type: 'PASS_BID', payload: { playerIndex: myIdx } })} className="w-full bg-pink-600 hover:bg-pink-500 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg transition-transform active:scale-95">Pass</button>
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                }

                                if (state.phase === 'scoring') {
                                    return (
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="pointer-events-auto p-12 bg-slate-900/95 rounded-[4rem] border-2 border-emerald-500 shadow-2xl text-center backdrop-blur-3xl max-w-md"
                                        >
                                            <h3 className="text-sm font-black text-emerald-500 uppercase tracking-[0.4em] mb-4 text-center">Hand Result</h3>
                                            <p className="text-4xl font-black text-white italic tracking-tighter mb-10 leading-tight">
                                                {state.overlayMessage || state.logs[0]}
                                            </p>
                                            <button
                                                onClick={() => dispatch({ type: 'FINISH_HAND' })}
                                                className="w-full bg-white text-slate-950 font-black py-5 rounded-3xl shadow-xl text-2xl hover:scale-105 active:scale-95 transition-all"
                                            >
                                                NEXT HAND
                                            </button>
                                        </motion.div>
                                    );
                                }

                                return null;
                            })()}
                        </AnimatePresence>
                    </div>


                    <div className="h-32 md:h-36 flex items-end justify-center relative mt-auto px-4 md:px-10 pt-2 pb-2 bg-slate-800/10 rounded-t-[3rem]">
                        {(() => {
                            const myIdx = state.players.findIndex(p => p.name === state.currentViewPlayerName);
                            if (myIdx === -1 || ['scoring', 'randomizing_dealer', 'game_over', 'lobby'].includes(state.phase)) return null;

                            const myPlayer = state.players[myIdx];
                            const handSize = myPlayer.hand.length;

                            return (
                                <div className="flex justify-center items-end relative" style={{ width: '100%', maxWidth: '400px' }}>
                                    {myPlayer.hand.map((card: Card, index: number) => {
                                        let isValid = false;
                                        const isPickedUpCard = state.phase === 'discard' && card.id === state.upcard?.id;

                                        if (state.currentPlayerIndex === myIdx) {
                                            if (state.phase === 'discard') isValid = !isPickedUpCard;
                                            else if (state.phase === 'playing') {
                                                const leadCard = state.currentTrick.length > 0 ? state.currentTrick[0].card : null;
                                                const leadSuit = leadCard ? getEffectiveSuit(leadCard, state.trump) : null;
                                                isValid = isValidPlay(card, myPlayer.hand, leadSuit, state.trump);
                                            } else if (state.phase === 'bidding') isValid = true;
                                        }

                                        // Calculate overlap - cards overlap by 60% (77px * 0.6 = ~46px)
                                        const overlapAmount = handSize > 1 ? -46 : 0;
                                        const isFirstCard = index === 0;

                                        return (
                                            <motion.div
                                                key={card.id}
                                                layoutId={card.id}
                                                initial={{ y: 150, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                className="relative"
                                                style={{
                                                    marginLeft: isFirstCard ? 0 : `${overlapAmount}px`,
                                                    zIndex: index + 1
                                                }}
                                            >
                                                <AnimatePresence>
                                                    {isPickedUpCard && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            className="absolute -top-12 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-xl border-2 border-white z-10 whitespace-nowrap"
                                                        >
                                                            NEW CARD
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                                <CardComponent
                                                    card={card}
                                                    size="mobile"
                                                    isValid={isValid || state.phase === 'scoring'}
                                                    onClick={() => {
                                                        if (state.phase === 'discard' && isValid) dispatch({ type: 'DISCARD_CARD', payload: { playerIndex: myIdx, cardId: card.id } });
                                                        else if (state.phase === 'playing' && isValid) dispatch({ type: 'PLAY_CARD', payload: { playerIndex: myIdx, cardId: card.id } });
                                                    }}
                                                />
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                <div className={`shrink-0 flex flex-col gap-4 transition-all ${state.stepMode ? 'w-56' : 'w-0 overflow-hidden'}`}>
                    {state.stepMode && (
                        <div className="p-6 bg-amber-500 text-white rounded-[2.5rem] shadow-xl text-center">
                            <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">Step Mode</div>
                            <button onClick={handleNextStep} className="w-full font-black py-4 bg-white/20 hover:bg-white/30 rounded-2xl transition transform active:scale-95">NEXT ACTION →</button>
                        </div>
                    )}
                </div>

                {/* Mobile Stats View */}
                {activeTab === 'stats' && <StatsView />}
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
        // Only activate if at the top of the page
        if (window.scrollY === 0) {
            startY.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isPulling) return;

        currentY.current = e.touches[0].clientY;
        const distance = currentY.current - startY.current;

        // Only track downward pulls
        if (distance > 0) {
            setPullDistance(Math.min(distance / 2, 80)); // Cap at 80px
        }
    };

    const handleTouchEnd = () => {
        if (pullDistance > 60) {
            // Threshold reached - reload
            window.location.reload();
        }

        setIsPulling(false);
        setPullDistance(0);
    };

    return (
        <div
            className="w-screen h-screen bg-slate-950 text-white flex items-center justify-center selection:bg-emerald-500 overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull to refresh indicator */}
            {pullDistance > 0 && (
                <div
                    className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center transition-all"
                    style={{ height: `${pullDistance}px`, opacity: Math.min(pullDistance / 60, 1) }}
                >
                    <div className="bg-emerald-500/20 backdrop-blur-sm rounded-full p-2">
                        <svg
                            className={`w-6 h-6 text-emerald-400 ${pullDistance > 60 ? 'animate-spin' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </div>
                </div>
            )}

            <GameProvider>
                <GameView />
            </GameProvider>
        </div>
    );
}

export default App;
