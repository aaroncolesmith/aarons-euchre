import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { GameProvider, useGame, getEmptyStats, getSavedGames, BOT_NAMES_POOL, deleteActiveGame } from './store/GameStore';
import { getEffectiveSuit, isValidPlay } from './utils/rules';
import { Card } from './types/game';
import { supabase } from './lib/supabase';
import { fetchUserCloudGames, mergeLocalAndCloudGames } from './utils/cloudGames';
import { getFreezeStats, getFreezeRate } from './utils/cloudFreezeLogger';
import { getAllPlayerStats } from './utils/supabaseStats';
import { GameRecapModal } from './components/GameRecapModal';

const getCardJitter = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
    return (Math.abs(hash) % 14) - 7; // -7 to 7 degrees
};

const getPositionJitter = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
    const jX = (Math.abs(hash) % 20) - 10; // -10 to 10px
    const jY = (Math.abs(hash >> 1) % 20) - 10; // -10 to 10px
    return { x: jX, y: jY };
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
        bottom: "bottom-24 md:bottom-32 left-1/2 -translate-x-1/2",
        top: "top-24 md:top-32 left-1/2 -translate-x-1/2",
        left: "left-6 md:left-10 top-1/2 -translate-y-1/2 -rotate-90 origin-center",
        right: "right-6 md:right-10 top-1/2 -translate-y-1/2 rotate-90 origin-center"
    };

    if (!player.name && inLobby) {
        return (
            <div className={`absolute ${posClasses[position]} flex flex-col items-center gap-3 z-20 group`}>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => dispatch({ type: 'SIT_PLAYER', payload: { seatIndex: index, name: state.currentViewPlayerName! } })}
                        className="bg-brand/10 hover:bg-brand/20 text-brand-dark px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-brand-dim transition-all"
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
                        className="bg-paper hover:bg-paper-dim text-ink-dim px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-ink-dim/50 transition-all"
                    >
                        Add Bot
                    </button>
                </div>
                {/* Seat Label (N/S/E/W) */}
                <div className="absolute -bottom-6 text-[8px] font-black text-emerald-200 uppercase tracking-widest">
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
                className={`relative w-auto h-auto flex flex-col items-center justify-center`}
            >
                {/* Caller Badge */}
                {isTrumpCaller && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute -top-7 bg-paper text-cyan-600 text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-wider border-2 border-cyan-500 shadow-sm z-30 whitespace-nowrap"
                    >
                        Caller
                    </motion.div>
                )}

                {/* Dealer Badge */}
                {isDealer && !isAnimatingDealer && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-6 -right-5 bg-paper text-amber-500 text-xs font-black w-7 h-7 rounded-full flex items-center justify-center border-2 border-amber-500 shadow-sm z-30"
                    >
                        D
                    </motion.div>
                )}

                {/* UPCARD centered */}
                {isDealer && !isAnimatingDealer && state.phase === 'bidding' && state.biddingRound === 1 && state.upcard && (
                    <motion.div
                        layoutId={state.upcard.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`absolute ${position === 'bottom' ? 'bottom-full mb-4' : 'top-full mt-4'} left-1/2 -translate-x-1/2 z-20 pointer-events-none`}
                    >
                        <div className="relative">
                            <CardComponent card={state.upcard} size="sm" rotation={position === 'top' ? 195 : 15} disabled />
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-paper text-brand-dark text-[8px] font-black px-2 py-0.5 rounded shadow-sm border border-brand-dim whitespace-nowrap z-30">
                                UPCARD
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Remove Player (Lobby) */}
                {player.isComputer && inLobby && (
                    <button
                        onClick={() => dispatch({ type: 'REMOVE_PLAYER', payload: { seatIndex: index } })}
                        className="absolute -top-2 -left-4 bg-paper text-red-500 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border border-red-200 hover:border-red-500 transition-all z-10 shadow-sm"
                    >
                        ✕
                    </button>
                )}

                {/* Player Name */}
                <div className={`
                    font-hand font-black text-xl uppercase tracking-tight whitespace-nowrap px-4 py-2 rounded-xl transition-all duration-300
                    ${isCurrentTurn || isAnimatingDealer
                        ? 'text-brand bg-brand/10 border-4 border-brand shadow-[4px_4px_0px_0px_rgba(16,185,129,0.5)] scale-110'
                        : 'text-ink-dim border-2 border-transparent'}
                `}>
                    {player.name}
                </div>

                {/* Cards Left */}
                {!inLobby && player.name !== state.currentViewPlayerName && state.phase !== 'randomizing_dealer' && (
                    <div className="flex gap-1 justify-center mt-1">
                        {[0, 1, 2, 3, 4].map((i) => {
                            const hasCard = i < player.hand.length;
                            return (
                                <div
                                    key={i}
                                    className={`
                                        w-3 h-5 rounded-[2px] transition-all
                                        ${hasCard
                                            ? 'bg-paper border-2 border-brand'
                                            : 'bg-transparent border-2 border-brand-dim/50'}
                                    `}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Tricks Won */}
                {!inLobby && state.phase !== 'randomizing_dealer' && (state.tricksWon[player.id] || 0) > 0 && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -bottom-2 -right-6 bg-paper text-brand text-sm font-black w-7 h-7 rounded-full flex items-center justify-center border-2 border-brand shadow-sm font-hand"
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

    const valClass = isRed ? 'text-red-600' : 'text-ink';
    const invalidClass = isRed ? 'text-red-600/50' : 'text-ink/50';

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
                ${isValid ? 'bg-paper border-white' : 'bg-paper/90 border-ink-dim/50/50 opacity-80'}
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


const BotAuditView = ({ decisions, filterType }: { decisions: any[]; filterType?: 'all' | 'trump_calls' }) => {
    // Filter decisions based on filterType
    const filteredDecisions = filterType === 'trump_calls'
        ? decisions.filter(d => d.game_phase && d.game_phase.includes('bidding') && d.decision && !d.decision.toLowerCase().includes('pass'))
        : decisions;

    if (filteredDecisions.length === 0) {
        return (
            <div className="bg-paper border-2 border-brand rounded-2xl p-12 text-center shadow-sketch-brand">
                <div className="text-ink-dim text-lg mb-2 font-black uppercase tracking-widest">No bot decisions logged yet</div>
                <div className="text-brand text-sm font-bold">Play against bots to see their decision-making process here</div>
            </div>
        );
    }

    return (
        <div className="bg-paper border-2 border-brand rounded-2xl overflow-hidden shadow-sketch-brand">
            <div className="overflow-x-auto overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-xs font-hand">
                    <thead className="bg-paper sticky top-0 z-20">
                        <tr className="text-[9px] font-black text-brand-dark uppercase tracking-widest border-b-2 border-brand">
                            <th className="px-4 py-4 bg-paper">Time</th>
                            <th className="px-4 py-4 whitespace-nowrap bg-paper">Game ID</th>
                            <th className="px-4 py-4 bg-paper">Bot</th>
                            <th className="px-4 py-4 whitespace-nowrap bg-paper">Archetype</th>
                            <th className="px-4 py-4 bg-paper">Phase</th>
                            <th className="px-4 py-4 bg-paper">Decision</th>
                            <th className="px-4 py-4 whitespace-nowrap bg-paper">Hand at Decision</th>
                            <th className="px-4 py-4 bg-paper">Reasoning</th>
                            <th className="px-4 py-4 text-center bg-paper">Strength</th>
                            <th className="px-4 py-4 text-center bg-paper">Score</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                        {filteredDecisions.map((d, i) => {
                            const formatHand = (handData: any) => {
                                if (!handData) return '-';
                                try {
                                    const cards = Array.isArray(handData) ? handData : JSON.parse(handData);
                                    if (!Array.isArray(cards)) return '-';
                                    const suitMap: Record<string, string> = { 'hearts': '♥', 'diamonds': '♦', 'clubs': '♣', 'spades': '♠' };
                                    return cards.map((c: any) => `${c.rank}${suitMap[c.suit] || c.suit.charAt(0).toUpperCase()}`).join(', ');
                                } catch (e) {
                                    return '-';
                                }
                            };

                            return (
                                <tr key={`${d.id || i}`} className="hover:bg-brand/10 transition-colors group border-b border-emerald-50">
                                    <td className="px-4 py-3 text-ink-dim text-[10px] font-medium whitespace-nowrap tabular-nums">
                                        {new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </td>
                                    <td className="px-4 py-3 text-ink-dim text-[10px] font-black tabular-nums whitespace-nowrap">{d.game_code || 'N/A'}</td>
                                    <td className="px-4 py-3 font-black text-brand-dark whitespace-nowrap">{d.player_name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="text-[9px] text-brand-dark font-black px-2 py-0.5 bg-brand/20 rounded-full border border-brand-dim uppercase tracking-tight">
                                            {d.archetype}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-ink-dim uppercase text-[9px] font-black whitespace-nowrap">{d.game_phase}</td>
                                    <td className="px-4 py-3 font-black text-brand group-hover:text-brand-dark transition-colors whitespace-nowrap">{d.decision}</td>
                                    <td className="px-4 py-3 text-slate-600 font-bold text-[10px] whitespace-nowrap font-mono">{formatHand(d.hand_state)}</td>
                                    <td className="px-4 py-3 text-slate-700 min-w-[300px] max-w-md leading-relaxed text-[11px] font-hand">{d.reasoning}</td>
                                    <td className="px-4 py-3 text-center font-black text-purple-600 tabular-nums">{d.hand_strength?.toFixed(1) || '-'}</td>
                                    <td className="px-4 py-3 text-center text-ink-dim text-[9px] font-black tabular-nums whitespace-nowrap">
                                        {d.current_score_us}-{d.current_score_them}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const StatsModal = ({ isOpen, onClose, initialTab = 'me' }: { isOpen: boolean; onClose: () => void; initialTab?: 'me' | 'league' | 'bot_audit' | 'freeze_incidents' | 'state_management' | 'commentary' }) => {
    const { state } = useGame();
    const [tab, setTab] = useState<'me' | 'league' | 'bot_audit' | 'freeze_incidents' | 'state_management' | 'commentary'>(initialTab as any);
    const [botAuditFilter, setBotAuditFilter] = useState<'all' | 'trump_calls'>('all');
    const [freezeStats, setFreezeStats] = useState<any>(null);
    const [freezeRate, setFreezeRate] = useState<any>(null);

    // Leaderboard sorting state (must be at top level - Rules of Hooks!)
    const [sortColumn, setSortColumn] = useState<string>('winPct');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [cloudGames, setCloudGames] = useState<any[]>([]);

    // Reset to initial tab when modal opens
    useEffect(() => {
        if (isOpen) {
            setTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // Load global stats from Supabase (primary) with localStorage fallback
    const [globalStats, setGlobalStats] = useState<Record<string, any>>({});

    useEffect(() => {
        const loadStats = async () => {
            try {
                // Try Supabase first
                const supabaseStats = await getAllPlayerStats();

                if (Object.keys(supabaseStats).length > 0) {
                    console.log('[STATS] Loaded from Supabase:', Object.keys(supabaseStats).length, 'players');
                    setGlobalStats(supabaseStats);
                } else {
                    // Fallback to localStorage
                    const localStats = JSON.parse(localStorage.getItem('euchre_global_profiles') || '{}');
                    console.log('[STATS] Using localStorage fallback:', Object.keys(localStats).length, 'players');
                    setGlobalStats(localStats);
                }
            } catch (err) {
                console.error('[STATS] Error loading from Supabase, using localStorage:', err);
                const localStats = JSON.parse(localStorage.getItem('euchre_global_profiles') || '{}');
                setGlobalStats(localStats);
            }
        };

        if (isOpen) {
            loadStats();
        }
    }, [isOpen]);

    // Load freeze statistics when freeze_incidents or state_management tab is selected
    useEffect(() => {
        if ((tab === 'freeze_incidents' || tab === 'state_management') && isOpen) {
            getFreezeStats().then(setFreezeStats);
            getFreezeRate(24).then(setFreezeRate);
        }
    }, [tab, isOpen]);



    // Load Bot Decisions for audit
    const [botDecisions, setBotDecisions] = useState<any[]>([]);

    useEffect(() => {
        const loadBotDecisions = async () => {
            try {
                const { getBotDecisions } = await import('./utils/supabaseStats');
                const decisions = await getBotDecisions(200);
                setBotDecisions(decisions);
            } catch (err) {
                console.error('[BOT AUDIT] Error loading decisions:', err);
            }
        };

        if (isOpen && (tab === 'bot_audit' || tab === 'freeze_incidents' || tab === 'state_management')) {
            loadBotDecisions();
        }
    }, [isOpen, tab]);

    // Load cloud games for localStorage comparison in admin
    useEffect(() => {
        const loadCloudGames = async () => {
            if (!state.currentUser) return;
            try {
                const games = await fetchUserCloudGames(state.currentUser);
                setCloudGames(games);
            } catch (err) {
                console.error('[ADMIN] Error loading cloud games:', err);
            }
        };

        if (isOpen && tab === 'state_management') {
            loadCloudGames();
        }
    }, [isOpen, tab, state.currentUser]);

    // Get my stats - use currentUser (works everywhere) or fallback to currentViewPlayerName (in-game)
    const playerName = state.currentUser || state.currentViewPlayerName || '';
    const myGlobalStats = globalStats[playerName] || getEmptyStats();
    const human = {
        name: playerName,
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



    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 md:pt-24 p-4 bg-ink/10 backdrop-blur-sm animate-in fade-in duration-300 font-hand">
            <div className="bg-paper border-4 border-ink w-full max-w-4xl rounded-[2rem] shadow-sketch-ink overflow-hidden animate-in zoom-in duration-300 max-h-[85vh] flex flex-col">
                <div className="p-6 md:p-8 flex flex-col flex-1 min-h-0 bg-paper">
                    <div className="flex justify-between items-start mb-2 shrink-0">
                        <div className="flex-1 overflow-x-auto min-w-0 mr-4 scrollbar-hide">
                            <div className="flex gap-2 flex-nowrap py-1">
                                {[
                                    { id: 'me', label: 'My Stats' },
                                    { id: 'league', label: 'Leaderboard' },
                                    { id: 'bot_audit', label: 'Bot Audit' },
                                    { id: 'freeze_incidents', label: 'Freeze Logs' },
                                    { id: 'state_management', label: 'Admin' },
                                    { id: 'commentary', label: 'Chat' }
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setTab(t.id as any)}
                                        className={`px-2 py-2 mx-1 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-4 ${tab === t.id
                                            ? 'text-brand border-brand'
                                            : 'text-ink-dim hover:text-brand border-transparent'
                                            }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                                <button
                                    onClick={downloadSessionLog}
                                    disabled={state.eventLog.length === 0}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border-2 whitespace-nowrap ${state.eventLog.length > 0
                                        ? 'bg-paper text-ink border-ink hover:bg-paper-dim cursor-pointer shadow-sketch-ink'
                                        : 'bg-transparent text-ink-dim/50 border-ink-dim/50 cursor-not-allowed'
                                        }`}
                                >
                                    📥 Log
                                </button>
                            </div>
                        </div>
                        <button onClick={onClose} className="bg-paper hover:bg-paper-dim text-ink border-2 border-ink p-1.5 rounded-lg transition-all shadow-sketch-ink active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex-shrink-0">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {tab === 'me' ? (
                        <div className="space-y-10 overflow-y-auto pr-4 custom-scrollbar flex-1 min-h-0 pb-6">
                            <div>
                                <h3 className="text-[10px] font-black text-ink-dim uppercase tracking-[0.4em] mb-4 border-b border-ink pb-2">Efficiency & Global</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Games Played', value: human.stats.gamesPlayed, color: 'text-ink-dim' },
                                        { label: 'Game Win %', value: `${human.stats.gamesPlayed > 0 ? Math.round((human.stats.gamesWon / human.stats.gamesPlayed) * 100) : 0}%`, color: 'text-brand-dim' },
                                        { label: 'Hands Played', value: human.stats.handsPlayed, color: 'text-ink-dim' },
                                        { label: 'Hand Win %', value: `${human.stats.handsPlayed > 0 ? Math.round((human.stats.handsWon / human.stats.handsPlayed) * 100) : 0}%`, color: 'text-cyan-400' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-paper border-2 border-brand p-4 rounded-2xl flex flex-col items-center justify-center shadow-sketch-brand transform hover:-rotate-1 transition-transform">
                                            <div className="text-[10px] font-black text-ink-dim uppercase tracking-widest mb-1">{stat.label}</div>
                                            <div className={`text-3xl font-black font-hand ${String(stat.value).includes('%') ? 'text-brand' : 'text-ink'}`}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-black text-ink-dim uppercase tracking-[0.4em] mb-4 border-b border-ink pb-2">Trick Play</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Tricks Played', value: human.stats.tricksPlayed, color: 'text-ink-dim' },
                                        { label: 'Tricks Taken', value: human.stats.tricksTaken, color: 'text-purple-400' },
                                        { label: 'Tricks Won (Team)', value: human.stats.tricksWonTeam, color: 'text-indigo-400' },
                                        { label: 'Trick Win %', value: `${human.stats.tricksPlayed > 0 ? Math.round((human.stats.tricksWonTeam / human.stats.tricksPlayed) * 100) : 0}%`, color: 'text-indigo-400' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-paper border-2 border-brand p-4 rounded-2xl flex flex-col items-center justify-center shadow-sketch-brand transform hover:-rotate-1 transition-transform">
                                            <div className="text-[10px] font-black text-ink-dim uppercase tracking-widest mb-1">{stat.label}</div>
                                            <div className={`text-3xl font-black font-hand ${String(stat.value).includes('%') ? 'text-brand' : 'text-ink'}`}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-black text-ink-dim uppercase tracking-[0.4em] mb-4 border-b border-ink pb-2">Bidding & Loners</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Hands Called', value: human.stats.callsMade, color: 'text-amber-400' },
                                        { label: 'Called Hands Won', value: human.stats.callsWon, color: 'text-amber-500' },
                                        { label: 'Loner Attempts', value: human.stats.lonersAttempted, color: 'text-pink-400' },
                                        { label: 'Loners Won (5/5)', value: human.stats.lonersConverted, color: 'text-pink-500' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-paper border-2 border-brand p-4 rounded-2xl flex flex-col items-center justify-center shadow-sketch-brand transform hover:-rotate-1 transition-transform">
                                            <div className="text-[10px] font-black text-ink-dim uppercase tracking-widest mb-1">{stat.label}</div>
                                            <div className={`text-3xl font-black font-hand ${String(stat.value).includes('%') ? 'text-brand' : 'text-ink'}`}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-black text-ink-dim uppercase tracking-[0.4em] mb-4 border-b border-ink pb-2">Impact Moments</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {[
                                        { label: 'Euchred Opponent', value: human.stats.euchresMade, color: 'text-red-400' },
                                        { label: 'Been Euchred', value: human.stats.euchred, color: 'text-red-900' },
                                        { label: 'Sweeps (5 Tricks)', value: human.stats.sweeps, color: 'text-yellow-400' },
                                        { label: 'Been Swept (0/5)', value: human.stats.swept, color: 'text-slate-700' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-paper border-2 border-brand p-4 rounded-2xl flex flex-col items-center justify-center shadow-sketch-brand transform hover:-rotate-1 transition-transform">
                                            <div className="text-[10px] font-black text-ink-dim uppercase tracking-widest mb-1">{stat.label}</div>
                                            <div className={`text-3xl font-black font-hand ${String(stat.value).includes('%') ? 'text-brand' : 'text-ink'}`}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : tab === 'league' ? (
                        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-2 pb-6">
                            {(() => {
                                const handleSort = (column: string) => {
                                    if (sortColumn === column) {
                                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                                    } else {
                                        setSortColumn(column);
                                        setSortDirection('desc');
                                    }
                                };

                                const sortedPlayers = [...leaguePlayers].sort((a: any, b: any) => {
                                    let aVal, bVal;

                                    switch (sortColumn) {
                                        case 'name':
                                            aVal = a.name;
                                            bVal = b.name;
                                            break;
                                        case 'gp':
                                            aVal = a.gamesPlayed;
                                            bVal = b.gamesPlayed;
                                            break;
                                        case 'wins':
                                            aVal = a.gamesWon;
                                            bVal = b.gamesWon;
                                            break;
                                        case 'losses':
                                            aVal = a.gamesPlayed - a.gamesWon;
                                            bVal = b.gamesPlayed - b.gamesWon;
                                            break;
                                        case 'winPct':
                                            aVal = a.gamesPlayed > 0 ? (a.gamesWon / a.gamesPlayed) : 0;
                                            bVal = b.gamesPlayed > 0 ? (b.gamesWon / b.gamesPlayed) : 0;
                                            break;
                                        case 'handWinPct':
                                            aVal = a.handsPlayed > 0 ? (a.handsWon / a.handsPlayed) : 0;
                                            bVal = b.handsPlayed > 0 ? (b.handsWon / b.handsPlayed) : 0;
                                            break;
                                        case 'tricksTaken':
                                            aVal = a.tricksTaken;
                                            bVal = b.tricksTaken;
                                            break;
                                        case 'tricksPct':
                                            const aTotalTricks = a.handsPlayed * 5;
                                            const bTotalTricks = b.handsPlayed * 5;
                                            aVal = aTotalTricks > 0 ? (a.tricksTaken / aTotalTricks) : 0;
                                            bVal = bTotalTricks > 0 ? (b.tricksTaken / bTotalTricks) : 0;
                                            break;
                                        case 'euchres':
                                            aVal = a.euchresMade;
                                            bVal = b.euchresMade;
                                            break;
                                        case 'lonersWon':
                                            aVal = a.lonersConverted;
                                            bVal = b.lonersConverted;
                                            break;
                                        case 'lonersCalled':
                                            aVal = a.lonersAttempted;
                                            bVal = b.lonersAttempted;
                                            break;
                                        default:
                                            aVal = 0;
                                            bVal = 0;
                                    }

                                    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                                    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                                    return 0;
                                });

                                const SortableHeader = ({ column, children }: { column: string; children: React.ReactNode }) => (
                                    <th
                                        className="px-4 py-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
                                        onClick={() => handleSort(column)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {children}
                                            {sortColumn === column && (
                                                <span className="text-brand-dim">
                                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                );

                                return (
                                    <div className="bg-paper border-2 border-brand rounded-2xl overflow-hidden shadow-sketch-brand">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm font-hand">
                                                <thead>
                                                    <tr className="bg-paper border-b-2 border-brand text-[10px] font-black text-brand-dark uppercase tracking-widest">
                                                        <SortableHeader column="name">Player</SortableHeader>
                                                        <SortableHeader column="gp">GP</SortableHeader>
                                                        <SortableHeader column="wins">Wins</SortableHeader>
                                                        <SortableHeader column="losses">Losses</SortableHeader>
                                                        <SortableHeader column="winPct">Win %</SortableHeader>
                                                        <SortableHeader column="handWinPct">Hand Win %</SortableHeader>
                                                        <SortableHeader column="tricksTaken">Tricks Taken</SortableHeader>
                                                        <SortableHeader column="tricksPct">Tricks %</SortableHeader>
                                                        <SortableHeader column="euchres">Euchres Made</SortableHeader>
                                                        <SortableHeader column="lonersWon">Loners Won</SortableHeader>
                                                        <SortableHeader column="lonersCalled">Loners Called</SortableHeader>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-emerald-100">
                                                    {sortedPlayers.map((p: any, i: number) => {
                                                        const totalPossibleTricks = p.handsPlayed * 5;
                                                        const tricksPercent = totalPossibleTricks > 0
                                                            ? Math.round((p.tricksTaken / totalPossibleTricks) * 100)
                                                            : 0;

                                                        return (
                                                            <tr key={i} className={`group hover:bg-brand/10 transition-colors ${p.name === human.name ? 'bg-brand/10' : ''}`}>
                                                                <td className="px-4 py-3 font-bold text-brand-dark whitespace-nowrap">
                                                                    {p.name}
                                                                    {p.name === human.name && <span className="ml-2 bg-brand text-white text-[8px] px-2 py-0.5 rounded-full">YOU</span>}
                                                                </td>
                                                                <td className="px-4 py-3 text-slate-700 font-bold tabular-nums font-hand text-lg">{p.gamesPlayed}</td>
                                                                <td className="px-4 py-3 text-brand font-bold tabular-nums font-hand text-lg">{p.gamesWon}</td>
                                                                <td className="px-4 py-3 text-red-500 font-bold tabular-nums font-hand text-lg">{p.gamesPlayed - p.gamesWon}</td>
                                                                <td className="px-4 py-3 text-brand font-black tabular-nums font-hand text-lg">
                                                                    {p.gamesPlayed > 0 ? Math.round((p.gamesWon / p.gamesPlayed) * 100) : 0}%
                                                                </td>
                                                                <td className="px-4 py-3 text-cyan-600 font-black tabular-nums font-hand text-lg">
                                                                    {p.handsPlayed > 0 ? Math.round((p.handsWon / p.handsPlayed) * 100) : 0}%
                                                                </td>
                                                                <td className="px-4 py-3 text-purple-600 font-bold tabular-nums font-hand text-lg">{p.tricksTaken}</td>
                                                                <td className="px-4 py-3 text-purple-600 font-bold tabular-nums font-hand text-lg">{tricksPercent}%</td>
                                                                <td className="px-4 py-3 text-red-500 font-bold tabular-nums font-hand text-lg">{p.euchresMade}</td>
                                                                <td className="px-4 py-3 text-yellow-600 font-bold tabular-nums font-hand text-lg">{p.lonersConverted}</td>
                                                                <td className="px-4 py-3 text-orange-500 font-bold tabular-nums font-hand text-lg">{p.lonersAttempted}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    ) : tab === 'freeze_incidents' ? (
                        <div className="space-y-6 flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-2 pb-6">
                            {/* Freeze Rate Card */}
                            {freezeRate && (
                                <div className="bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-800/50 rounded-[2rem] p-6">
                                    <div className="text-xs font-black text-red-400 uppercase tracking-widest mb-4">
                                        Freeze Metrics (Last {freezeRate.timeRange})
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <div className="text-3xl font-black text-white">{freezeRate.total}</div>
                                            <div className="text-xs text-ink-dim">Total Freezes</div>
                                        </div>
                                        <div>
                                            <div className="text-3xl font-black text-brand-dim">{freezeRate.recovered}</div>
                                            <div className="text-xs text-ink-dim">Recovered</div>
                                        </div>
                                        <div>
                                            <div className="text-3xl font-black text-red-400">{freezeRate.unrecovered}</div>
                                            <div className="text-xs text-ink-dim">Unrecovered</div>
                                        </div>
                                        <div>
                                            <div className="text-3xl font-black text-cyan-400">{freezeRate.recoveryRate}</div>
                                            <div className="text-xs text-ink-dim">Recovery Rate</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-red-800/30">
                                        <div className="text-sm text-ink-dim/50">
                                            <span className="font-bold text-yellow-400">{freezeRate.freezesPerHour}</span> freezes/hour average
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Recent Freeze Incidents */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="text-xs font-black text-ink-dim uppercase tracking-widest">
                                        Recent Freeze Incidents
                                    </div>
                                    <button
                                        onClick={() => { getFreezeStats().then(setFreezeStats); getFreezeRate(24).then(setFreezeRate); }}
                                        className="px-4 py-2 rounded-full text-[10px] font-black bg-ink text-ink-dim hover:bg-slate-700 transition-all"
                                    >
                                        🔄 Refresh
                                    </button>
                                </div>

                                {!freezeStats ? (
                                    <div className="bg-paper border-2 border-brand rounded-[2rem] p-12 text-center shadow-sketch-brand">
                                        <div className="text-ink-dim font-medium">Loading freeze data...</div>
                                    </div>
                                ) : freezeStats.length === 0 ? (
                                    <div className="bg-paper border-2 border-brand rounded-[2rem] p-12 text-center shadow-sketch-brand">
                                        <div className="text-brand text-lg mb-2 font-black">🎉 No Freeze Incidents!</div>
                                        <div className="text-ink-dim text-sm font-medium">All games running smoothly</div>
                                    </div>
                                ) : (
                                    <div className="bg-paper border-2 border-brand rounded-[2rem] overflow-hidden shadow-sketch-brand">
                                        <div className="overflow-x-auto overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-left text-xs font-hand">
                                                <thead className="bg-paper sticky top-0 z-20">
                                                    <tr className="text-[9px] font-black text-brand-dark uppercase tracking-widest border-b-2 border-brand">
                                                        <th className="px-4 py-4 bg-paper">Time</th>
                                                        <th className="px-4 py-4 bg-paper">Game</th>
                                                        <th className="px-4 py-4 bg-paper">Type</th>
                                                        <th className="px-4 py-4 bg-paper">Phase</th>
                                                        <th className="px-4 py-4 bg-paper">Player</th>
                                                        <th className="px-4 py-4 bg-paper">Duration</th>
                                                        <th className="px-4 py-4 bg-paper">Recovery</th>
                                                        <th className="px-4 py-4 bg-paper">Version</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-emerald-100">
                                                    {freezeStats.map((incident: any) => (
                                                        <tr key={incident.id} className="hover:bg-brand/10 transition-colors group">
                                                            <td className="px-4 py-3 text-ink-dim font-medium text-[10px] whitespace-nowrap tabular-nums">
                                                                {new Date(incident.created_at).toLocaleString()}
                                                            </td>
                                                            <td className="px-4 py-3 font-black text-brand font-mono">
                                                                {incident.game_code}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-50 text-red-500 border border-red-200 uppercase tracking-tight">
                                                                    {incident.freeze_type}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-brand font-bold uppercase text-[9px] tracking-wider">{incident.phase}</td>
                                                            <td className="px-4 py-3">
                                                                <div className="text-brand-dark font-black">{incident.current_player_name || 'Unknown'}</div>
                                                                <div className="text-[9px] text-brand-dim font-bold">
                                                                    {incident.is_bot ? '🤖 Bot' : '👤 Human'}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-purple-600 font-black tabular-nums">
                                                                {(incident.time_since_active_ms / 1000).toFixed(0)}s
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {incident.recovered ? (
                                                                    <span className="text-[9px] font-black text-brand flex items-center gap-1">
                                                                        ✓ Recovered
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[9px] font-black text-red-500 flex items-center gap-1">
                                                                        ✗ Failed
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-ink-dim font-mono text-[10px]">
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
                    ) : tab === 'state_management' ? (
                        <div className="space-y-6 flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-2 pb-6">
                            {/* Stats Wipe (Aaron only) */}
                            {state.currentUser === 'Aaron' && (
                                <div className="flex justify-between items-center bg-paper border-2 border-red-500 p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(239,68,68,0.2)]">
                                    <div className="text-red-500 text-sm font-black uppercase tracking-widest">
                                        ⚠️ DANGER ZONE - Stats Management
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (confirm('🚨 NUCLEAR OPTION: Are you sure you want to WIPE ALL PLAYER STATS? This is permanent.')) {
                                                if (confirm('FINAL CONFIRMATION: Really delete all stats for all players?')) {
                                                    const { clearAllPlayerStats } = await import('./utils/supabaseStats');
                                                    const success = await clearAllPlayerStats();
                                                    if (success) {
                                                        alert('Global stats have been wiped.');
                                                        window.location.reload();
                                                    }
                                                }
                                            }
                                        }}
                                        className="px-6 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(153,27,27,1)] transition-all active:translate-y-[2px] active:shadow-none border-2 border-red-700"
                                    >
                                        🗑️ Wipe All Stats
                                    </button>
                                </div>
                            )}

                            {/* localStorage Management */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="text-xs font-black text-brand-dark uppercase tracking-widest border-b-2 border-brand pb-1">
                                        localStorage Management
                                    </div>
                                </div>

                                {(() => {
                                    const activeGamesRaw = localStorage.getItem('euchre_active_games');
                                    const localGames = activeGamesRaw ? JSON.parse(activeGamesRaw) : {};
                                    const gamesArray = Object.values(localGames) as any[];
                                    const aaronGames = gamesArray.filter((g: any) =>
                                        g.currentUser === state.currentUser ||
                                        g.players?.some((p: any) => p.name === state.currentUser)
                                    );
                                    const inProgress = aaronGames.filter((g: any) => g.phase !== 'game_over');
                                    const completed = aaronGames.filter((g: any) => g.phase === 'game_over');

                                    return (
                                        <div className="space-y-4">
                                            {/* Summary Card */}
                                            <div className="bg-paper border-2 border-brand rounded-2xl p-6 shadow-sketch-brand">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div>
                                                        <div className="text-3xl font-black text-slate-700 font-hand">{gamesArray.length}</div>
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-ink-dim">Total stored</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-3xl font-black text-brand font-hand">{aaronGames.length}</div>
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-ink-dim">Your Games</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-3xl font-black text-cyan-500 font-hand">{inProgress.length}</div>
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-ink-dim">In Progress</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-3xl font-black text-purple-500 font-hand">{completed.length}</div>
                                                        <div className="text-[10px] font-black uppercase tracking-widest text-ink-dim">Completed</div>
                                                    </div>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-brand-dim/50">
                                                    <div className="text-sm text-slate-600 font-hand">
                                                        <span className="font-bold text-brand">Cloud Games:</span> {cloudGames.length} (source of truth)
                                                    </div>
                                                    <div className="text-xs text-ink-dim mt-2 font-bold">
                                                        💡 If counts don't match cloud, clear localStorage to sync fresh data
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => {
                                                        const data = JSON.stringify(localGames, null, 2);
                                                        const blob = new Blob([data], { type: 'application/json' });
                                                        const url = URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `euchre_localStorage_backup_${Date.now()}.json`;
                                                        a.click();
                                                        URL.revokeObjectURL(url);
                                                    }}
                                                    className="flex-1 px-6 py-3 rounded-xl bg-paper border-2 border-ink text-ink hover:bg-paper-dim text-sm font-black uppercase tracking-widest shadow-sketch-ink transition-all active:translate-y-[2px] active:shadow-none"
                                                >
                                                    💾 Export Backup
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('⚠️ WARNING: This will delete ALL games from localStorage on THIS device!\n\nGames will be re-synced from cloud on next refresh.\n\nContinue?')) {
                                                            return;
                                                        }
                                                        localStorage.removeItem('euchre_active_games');
                                                        alert('✅ localStorage cleared! Refreshing to sync from cloud...');
                                                        window.location.reload();
                                                    }}
                                                    className="flex-1 px-6 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(153,27,27,1)] transition-all active:translate-y-[2px] active:shadow-none border-2 border-red-700"
                                                >
                                                    🗑️ Clear Storage
                                                </button>
                                            </div>

                                            {/* Game List */}
                                            {aaronGames.length > 0 && (
                                                <div className="bg-paper border-2 border-brand rounded-2xl overflow-hidden shadow-sketch-brand">
                                                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                                                        <table className="w-full text-left text-xs font-hand">
                                                            <thead className="bg-paper sticky top-0 border-b-2 border-brand">
                                                                <tr className="text-[9px] font-black text-brand-dark uppercase tracking-widest">
                                                                    <th className="px-4 py-3 bg-paper">Table Name</th>
                                                                    <th className="px-4 py-3 bg-paper">Code</th>
                                                                    <th className="px-4 py-3 bg-paper">Phase</th>
                                                                    <th className="px-4 py-3 bg-paper">Score</th>
                                                                    <th className="px-4 py-3 bg-paper">Last Active</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-emerald-100">
                                                                {aaronGames
                                                                    .sort((a: any, b: any) => (b.lastActive || 0) - (a.lastActive || 0))
                                                                    .map((g: any, i: number) => (
                                                                        <tr key={i} className="hover:bg-brand/10 transition-colors border-b border-emerald-50">
                                                                            <td className="px-4 py-3 text-brand-dark font-bold">{g.tableName || 'Unnamed'}</td>
                                                                            <td className="px-4 py-3 font-mono text-brand font-bold">{g.tableCode || 'N/A'}</td>
                                                                            <td className="px-4 py-3">
                                                                                <span className={`px-2 py-1 rounded-full text-[9px] font-black border uppercase tracking-tight ${g.phase === 'game_over'
                                                                                    ? 'bg-paper-dim text-ink-dim border-ink-dim/50'
                                                                                    : 'bg-brand/20 text-brand border-brand-dim'
                                                                                    }`}>
                                                                                    {g.phase}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-4 py-3 text-purple-600 font-bold">
                                                                                {g.scores?.team1 || 0}-{g.scores?.team2 || 0}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-ink-dim text-[10px] tabular-nums">
                                                                                {g.lastActive
                                                                                    ? new Date(g.lastActive).toLocaleString('en-US', {
                                                                                        month: '2-digit',
                                                                                        day: '2-digit',
                                                                                        hour: '2-digit',
                                                                                        minute: '2-digit'
                                                                                    })
                                                                                    : 'Unknown'}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    ) : tab === 'bot_audit' ? (
                        <div className="space-y-6 flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-2 pb-6">
                            {/* Filter Controls */}
                            {/* Filter Controls */}
                            <div className="flex gap-8 border-b-2 border-brand-dim/50/50 px-2">
                                <button
                                    onClick={() => setBotAuditFilter('all')}
                                    className={`pb-3 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all relative ${botAuditFilter === 'all' ? 'text-brand' : 'text-ink-dim hover:text-brand-dim'}`}
                                >
                                    All
                                    {botAuditFilter === 'all' && (
                                        <motion.div layoutId="auditFilterTab" className="absolute bottom-[-2px] left-0 right-0 h-[3px] bg-brand rounded-t-full" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setBotAuditFilter('trump_calls')}
                                    className={`pb-3 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all relative ${botAuditFilter === 'trump_calls' ? 'text-brand' : 'text-ink-dim hover:text-brand-dim'}`}
                                >
                                    Trump Calls
                                    {botAuditFilter === 'trump_calls' && (
                                        <motion.div layoutId="auditFilterTab" className="absolute bottom-[-2px] left-0 right-0 h-[3px] bg-brand rounded-t-full" />
                                    )}
                                </button>
                            </div>

                            <BotAuditView decisions={botDecisions} filterType={botAuditFilter} />
                        </div>
                    ) : tab === 'commentary' ? (
                        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar pr-2 pb-6">
                            <div className="bg-paper border-2 border-brand rounded-[2rem] p-6 h-full overflow-y-auto space-y-4 custom-scrollbar shadow-sketch-brand">
                                {state.logs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-ink-dim space-y-4 font-hand">
                                        <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center border-2 border-brand-dim/50">
                                            <svg className="w-8 h-8 text-brand-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                        </div>
                                        <p className="font-bold">No commentary yet</p>
                                    </div>
                                ) : (
                                    state.logs.map((log: string, i: number) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className={`text-sm md:text-base font-bold leading-relaxed p-4 rounded-2xl font-hand shadow-sm ${i === 0 ? 'bg-brand/20 text-brand-dark border-2 border-brand-dim' : 'bg-paper text-ink-dim border-2 border-paper-dim'}`}
                                        >
                                            {log}
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : null}

                </div>
            </div>
        </div >
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

    // CRITICAL: Auto-dismiss overlay after 5 seconds to prevent freeze
    // Users were getting stuck for 20+ seconds waiting for overlays
    React.useEffect(() => {
        if (state.overlayMessage) {
            console.log('[OVERLAY] Auto-dismiss timer started (5 seconds)');
            const autoDismiss = setTimeout(() => {
                console.log('[OVERLAY] Auto-dismissing overlay to prevent freeze');
                dispatch({ type: 'CLEAR_OVERLAY' });
            }, 5000); // 5 seconds max wait time

            return () => clearTimeout(autoDismiss);
        }
    }, [state.overlayMessage]);

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
            className="absolute inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-paper/60 backdrop-blur-sm animate-in fade-in duration-300 cursor-pointer text-center"
        >
            <div className="bg-paper text-brand-dark px-6 md:px-12 py-8 rounded-[2rem] shadow-[12px_12px_0px_0px_rgba(16,185,129,0.2)] border-4 border-brand animate-in zoom-in slide-in-from-bottom-12 duration-500 max-w-lg w-full">
                <div className="text-xs font-black text-brand-dim uppercase tracking-[0.3em] mb-4">Event Notification</div>
                <div className="text-2xl md:text-3xl font-black font-hand text-brand-dark leading-relaxed">{state.overlayMessage}</div>
                <div className="mt-8 text-[10px] font-black text-brand-dim uppercase tracking-widest animate-pulse">Click to continue</div>
            </div>
        </div>
    );
};

const LoginPage = () => {
    const { dispatch } = useGame();
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const ALLOWED_USERS = ['Aaron', 'Polina', 'Gray-Gray', 'Mimi', 'Micah', 'Cherrie', 'Peter-Playwright', 'TEST'];

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
        <div className="flex flex-col items-center justify-center h-full w-full max-w-lg mx-auto p-8 animate-in fade-in zoom-in duration-700">
            <h1 className="text-7xl font-black text-ink italic leading-none mb-16 tracking-widest uppercase transform -rotate-2">
                EUCHRE
            </h1>

            <div className="w-full bg-paper p-10 rounded-[2rem] border-2 border-ink shadow-sketch-ink transform rotate-1">
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            className="w-full bg-paper border-2 border-ink rounded-2xl px-8 py-5 text-xl font-black text-ink focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all placeholder:text-ink-dim uppercase shadow-[4px_4px_0px_0px_#cbd5e1]"
                            placeholder="Enter Username"
                        />
                        {error && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest ml-4 mt-2">Error: {error}</p>}
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-brand-dim text-ink font-black py-6 rounded-2xl text-xl border-2 border-slate-900 shadow-sketch-ink active:shadow-none active:translate-x-[6px] active:translate-y-[6px] transition-all hover:-translate-y-1 hover:shadow-sketch-ink uppercase tracking-widest"
                    >
                        LOGIN
                    </button>
                </form>
            </div>
        </div>
    );
};

const LandingPage = () => {
    const { state, dispatch } = useGame();
    const [code, setCode] = useState('');
    const [showJoin, setShowJoin] = useState(false);
    const [_refreshKey, setRefreshKey] = useState(0);
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [statsInitialTab, setStatsInitialTab] = useState<'me' | 'league' | 'bot_audit' | 'freeze_incidents' | 'state_management' | 'commentary'>('me');
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
        <div className="flex flex-col items-center justify-start h-full w-full max-w-2xl mx-auto p-4 md:p-8 pt-6 md:pt-12 animate-in fade-in zoom-in duration-700 overflow-y-auto no-scrollbar">
            {/* Header with Branding */}

            {/* Revised Header Structure */}
            <div className="w-full mb-8">
                <div className="flex justify-between items-center mb-2">
                    <div>
                        <h1 className="text-6xl font-black text-ink tracking-wide uppercase italic">
                            EUCHRE
                        </h1>
                        <p className="text-xs font-bold text-brand tracking-[0.2em] mt-1 ml-1 uppercase">
                            Hello, {state.currentUser}
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                        <button
                            onClick={() => { setStatsInitialTab('me'); setIsStatsOpen(true); }}
                            className="bg-paper hover:bg-paper-dim text-[10px] font-bold text-ink px-3 py-1.5 rounded-lg border-2 border-ink uppercase tracking-widest transition-all shadow-sketch-ink active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                        >
                            STATS
                        </button>
                        <button
                            onClick={() => dispatch({ type: 'LOGOUT' })}
                            className="bg-paper hover:bg-paper-dim text-[10px] font-bold text-red-500 px-3 py-1.5 rounded-lg border-2 border-red-500 uppercase tracking-widest transition-all shadow-[2px_2px_0px_0px_rgba(239,68,68,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                        >
                            LOGOUT
                        </button>
                    </div>
                </div>

                {/* Main Action Buttons */}
                {!showJoin ? (
                    <div className="flex flex-col gap-6 mt-8 mb-16">
                        <button
                            onClick={() => dispatch({ type: 'CREATE_TABLE', payload: { userName: state.currentUser! } })}
                            className="bg-paper text-ink font-black py-5 rounded-2xl text-xl border-4 border-ink shadow-sketch-ink-lg hover:translate-y-px hover:shadow-sketch-ink-lg active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all uppercase tracking-[0.2em]"
                        >
                            CREATE GAME
                        </button>
                        <button
                            onClick={() => setShowJoin(true)}
                            className="bg-brand-dim text-ink font-black py-5 rounded-2xl text-xl border-4 border-ink shadow-sketch-ink-lg hover:translate-y-px hover:shadow-sketch-ink-lg active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all uppercase tracking-[0.2em]"
                        >
                            JOIN TABLE
                        </button>
                    </div>
                ) : (
                    <div className="bg-paper p-6 rounded-[2rem] border-2 border-ink shadow-sketch-ink mb-10 animate-in slide-in-from-right-8 fade-in duration-300">
                        <div className="space-y-4">
                            <label className="text-xs font-black text-ink-dim uppercase tracking-widest ml-2">Enter 6-Digit Code</label>
                            <input
                                autoFocus
                                value={code}
                                onChange={(e) => handleCodeChange(e.target.value)}
                                maxLength={7}
                                className="w-full bg-paper-dim border-2 border-ink rounded-2xl px-6 py-4 text-4xl font-black text-ink text-center focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all placeholder:text-ink-dim/50 tracking-widest shadow-inner"
                                placeholder="000-000"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <button
                                onClick={() => { setShowJoin(false); setCode(''); }}
                                className="bg-paper-dim text-slate-600 font-black py-4 rounded-xl text-lg border-2 border-ink-dim hover:bg-slate-200 transition-all uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleJoinTable}
                                className="bg-brand text-white font-black py-4 rounded-xl text-lg border-2 border-brand-dark shadow-[4px_4px_0px_0px_rgba(6,95,70,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(6,95,70,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all uppercase tracking-widest"
                            >
                                Join
                            </button>
                        </div>
                    </div>
                )}

                {/* Continue Progress Section */}
                {savedGames.length > 0 && (
                    <div className="space-y-4">
                        {/* Tabs for game filtering */}
                        <div className="flex gap-6 border-b-2 border-ink-dim/50 pb-px px-2">
                            <button
                                onClick={() => setGameFilter('in-progress')}
                                className={`text-xs font-black uppercase tracking-widest pb-3 transition-all relative ${gameFilter === 'in-progress'
                                    ? 'text-brand'
                                    : 'text-ink-dim hover:text-slate-600'
                                    }`}
                            >
                                In Progress ({savedGames.filter(g => g.phase !== 'game_over').length})
                                {gameFilter === 'in-progress' && (
                                    <span className="absolute bottom-[-2px] left-0 w-full h-[3px] bg-brand rounded-full" />
                                )}
                            </button>
                            <button
                                onClick={() => setGameFilter('completed')}
                                className={`text-xs font-black uppercase tracking-widest pb-3 transition-all relative ${gameFilter === 'completed'
                                    ? 'text-brand'
                                    : 'text-ink-dim hover:text-slate-600'
                                    }`}
                            >
                                Completed ({savedGames.filter(g => g.phase === 'game_over').length})
                                {gameFilter === 'completed' && (
                                    <span className="absolute bottom-[-2px] left-0 w-full h-[3px] bg-brand rounded-full" />
                                )}
                            </button>
                            <button
                                onClick={() => setRefreshKey(prev => prev + 1)}
                                className="ml-auto text-ink-dim hover:text-brand transition-colors"
                                title="Sync with Cloud"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h5M20 20v-5h-5M20 5.138A9 9 0 004.862 13M4 18.862A9 9 0 0019.138 11" /></svg>
                            </button>
                        </div>

                        <div className="space-y-3 pb-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                            {savedGames
                                .filter(g => gameFilter === 'in-progress' ? g.phase !== 'game_over' : g.phase === 'game_over')
                                .map(game => (
                                    <div
                                        key={game.tableCode}
                                        className="group relative bg-paper border-2 border-dashed border-ink-dim hover:border-solid hover:border-brand rounded-xl p-4 transition-all hover:shadow-sketch-brand cursor-pointer"
                                        onClick={() => dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: game } })}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="bg-brand/20 text-brand-dark text-[10px] font-black px-2 py-0.5 rounded border border-brand-dim uppercase tracking-wider">
                                                        {game.tableCode}
                                                    </div>
                                                    <div className="text-[10px] font-bold text-ink-dim uppercase tracking-wider">
                                                        {getTimeAgo(game)}
                                                    </div>
                                                </div>
                                                <div className="text-lg font-black text-ink leading-tight mb-1">
                                                    {game.tableName || 'Untitled Game'}
                                                </div>
                                                <div className="text-xs font-bold text-ink-dim flex items-center gap-3">
                                                    <span className={game.scores.team1 >= 10 ? 'text-brand' : ''}>Team A: {game.scores.team1}</span>
                                                    <span className="text-ink-dim/50">•</span>
                                                    <span className={game.scores.team2 >= 10 ? 'text-brand' : ''}>Team B: {game.scores.team2}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 pl-4 border-l-2 border-paper-dim">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(game.tableCode); }}
                                                    className="p-2 text-ink-dim/50 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                                <button className="bg-brand/10 text-brand hover:bg-brand hover:text-white border-2 border-brand-dim hover:border-brand p-2 rounded-lg transition-all">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
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
            <div className="mt-auto pt-8 text-center w-full">
                <div className="text-[10px] font-black text-ink-dim/50 uppercase tracking-[0.5em]">
                    Euchre Engine V1.34
                </div>
            </div>

            <StatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} initialTab={statsInitialTab} />
        </div >
    );
};





const GameView = () => {
    const { state, dispatch } = useGame();
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    // @ts-ignore - Will be used when admin button is added to GameView
    const [statsInitialTab, setStatsInitialTab] = useState<'me' | 'league' | 'bot_audit' | 'freeze_incidents' | 'state_management' | 'commentary'>('me');
    const [showGameRecap, setShowGameRecap] = useState(false);


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
                    className="w-full bg-paper p-10 md:p-16 rounded-[3rem] border-4 border-brand shadow-sketch-brand-strong relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-brand/5 pointer-events-none" />

                    <div className="relative z-10 space-y-8">
                        <h1 className="text-6xl md:text-7xl font-black text-brand-dark text-center leading-none">
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

                        <div className="bg-paper-dim rounded-2xl p-6 border-2 border-brand/20">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <div className="text-sm text-ink-dim font-black uppercase tracking-wider mb-2">{state.teamNames.team1}</div>
                                    <div className={`text-5xl font-black ${state.scores.team1 >= 10 ? 'text-brand' : 'text-ink-dim'}`}>
                                        {state.scores.team1}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm text-ink-dim font-black uppercase tracking-wider mb-2">{state.teamNames.team2}</div>
                                    <div className={`text-5xl font-black ${state.scores.team2 >= 10 ? 'text-brand' : 'text-ink-dim'}`}>
                                        {state.scores.team2}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => setShowGameRecap(true)}
                                className="w-full bg-paper hover:bg-paper-dim text-ink font-black py-4 rounded-2xl text-lg border-4 border-ink shadow-sketch-ink transition-all active:scale-95"
                            >
                                GAME RECAP
                            </button>
                            <button
                                onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}
                                className="w-full bg-brand hover:bg-brand-dim text-white font-black py-6 rounded-2xl text-xl shadow-sketch-brand transition-all active:scale-95"
                            >
                                GO HOME
                            </button>
                        </div>
                    </div>
                </motion.div>
                <GameRecapModal isOpen={showGameRecap} onClose={() => setShowGameRecap(false)} gameState={state} />
            </div>
        );
    }

    return (
        <LayoutGroup>
            <div className="w-full h-full max-w-7xl mx-auto max-h-screen flex flex-col md:flex-row px-2 py-2 gap-4 overflow-hidden bg-paper/0 font-hand">



                <StatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} initialTab={statsInitialTab} />

                {/* Main Game Area */}
                <div className="flex-1 bg-paper rounded-[2rem] md:rounded-[3rem] border-4 border-brand shadow-sketch-brand relative flex flex-col w-full h-full overflow-hidden">

                    {/* Header (Separated) */}
                    <div className="shrink-0 flex justify-between items-start p-5 md:p-8 bg-paper border-b-2 border-brand-dim/50 z-30">
                        <div className="flex flex-col">
                            <h1 className="text-2xl md:text-3xl font-black text-brand-dark tracking-wide leading-none">
                                {state.tableName || 'The Green Table'}
                            </h1>
                            {state.tableCode && (
                                <div className="text-[10px] md:text-xs font-bold text-brand-dim mt-1 pl-1 tracking-widest font-mono">
                                    {state.tableCode}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setStatsInitialTab('me'); setIsStatsOpen(true); }}
                                    className="bg-paper hover:bg-brand/10 text-brand-dark px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-brand transition-all shadow-[3px_3px_0px_0px_rgba(16,185,129,0.3)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                                >
                                    STATS
                                </button>
                                <button
                                    onClick={() => dispatch({ type: 'EXIT_TO_LANDING' })}
                                    className="w-[34px] h-[34px] bg-paper hover:bg-red-50 text-brand-dark hover:text-red-500 rounded-xl border-2 border-brand hover:border-red-400 transition-all shadow-[3px_3px_0px_0px_rgba(16,185,129,0.3)] hover:shadow-[3px_3px_0px_0px_rgba(239,68,68,0.3)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none flex items-center justify-center"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            {state.phase === 'lobby' && (
                                <button
                                    onClick={() => {
                                        const emptySeats = state.players.filter(p => !p.name).length;
                                        if (emptySeats > 0) {
                                            if (confirm(`Auto-fill ${emptySeats} seats with bots?`)) {
                                                dispatch({ type: 'AUTOFILL_BOTS' });
                                                setTimeout(() => dispatch({ type: 'START_MATCH' }), 100);
                                            }
                                        } else {
                                            dispatch({ type: 'START_MATCH' });
                                        }
                                    }}
                                    className="bg-brand hover:bg-brand-dim text-white font-black text-[10px] px-3 py-1.5 rounded-lg border-2 border-brand shadow-sm animate-pulse"
                                >
                                    START GAME
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Game Board Surface */}
                    <div className="flex-1 relative bg-paper flex flex-col items-center overflow-hidden w-full h-full scale-95 md:scale-100 origin-center">

                        {/* Scoreboard (Green Ink) - Flowing inside Board */}
                        {state.phase !== 'lobby' && (
                            <div className="flex justify-between items-center w-full px-6 md:px-12 mt-2 md:mt-6 mb-2 pointer-events-none relative z-20 shrink-0">
                                {/* Team 1 Score */}
                                <div className="text-center">
                                    <div className="text-[10px] font-black text-brand-dim uppercase tracking-widest mb-1">{state.teamNames.team1}</div>
                                    <div className="text-3xl md:text-5xl font-black text-brand-dark font-hand">{state.scores.team1}</div>
                                </div>

                                {/* Trump Display */}
                                {state.trump && (
                                    <div className="flex flex-col items-center bg-paper px-4 py-2 rounded-2xl border-2 border-brand shadow-sketch-brand">
                                        <div className="hidden md:block text-[8px] font-black text-brand-dim uppercase tracking-widest mb-0.5">TRUMP</div>
                                        <div className={`text-2xl md:text-4xl font-black leading-none ${state.trump === 'hearts' || state.trump === 'diamonds' ? 'text-red-500' : 'text-ink'}`}>
                                            {state.trump === 'hearts' ? '♥' : state.trump === 'diamonds' ? '♦' : state.trump === 'clubs' ? '♣' : '♠'}
                                        </div>
                                    </div>
                                )}

                                {/* Team 2 Score */}
                                <div className="text-center">
                                    <div className="text-[10px] font-black text-brand-dim uppercase tracking-widest mb-1">{state.teamNames.team2}</div>
                                    <div className="text-3xl md:text-5xl font-black text-brand-dark font-hand">{state.scores.team2}</div>
                                </div>
                            </div>
                        )}



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
                                    const jitter = getPositionJitter(t.card.id);

                                    return (
                                        <motion.div
                                            key={t.card.id}
                                            layoutId={t.card.id}
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1, x: x + jitter.x, y: y + jitter.y, rotate: r + getCardJitter(t.card.id) }}
                                            exit={{ scale: 0, opacity: 0 }}
                                            className="absolute"
                                        >
                                            <CardComponent card={t.card} size="sm" rotation={0} disabled />
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>

                            {/* Global Upcard Display removed - now handled in PlayerSeat */}

                            {state.phase === 'randomizing_dealer' && (
                                <div className="bg-amber-500/10 border border-amber-500/50 px-8 py-4 rounded-[2rem] backdrop-blur-3xl animate-pulse">
                                    <div className="text-amber-500 text-lg font-black uppercase tracking-tighter">Choosing Dealer...</div>
                                </div>
                            )}

                        </div>
                    </div>

                    <div className="absolute bottom-[160px] md:bottom-[160px] left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full px-4 md:w-auto md:px-0">
                        <AnimatePresence>
                            {(() => {
                                const myIdx = state.players.findIndex(p => p.name === state.currentViewPlayerName);
                                if (state.phase === 'bidding' && state.currentPlayerIndex === myIdx) {
                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="pointer-events-auto flex flex-col items-center mx-auto w-full max-w-[380px] md:max-w-2xl"
                                        >
                                            {state.biddingRound === 1 ? (
                                                <div className="grid grid-cols-3 gap-3 w-full">
                                                    <button onClick={() => dispatch({ type: 'MAKE_BID', payload: { suit: state.upcard!.suit, callerIndex: myIdx, isLoner: false } })} className="bg-paper hover:bg-brand/10 text-brand-dark w-full py-3 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider border-2 border-brand transition-all shadow-[4px_4px_0px_0px_rgba(16,185,129,0.4)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none whitespace-nowrap">Order Up</button>
                                                    <button onClick={() => dispatch({ type: 'MAKE_BID', payload: { suit: state.upcard!.suit, callerIndex: myIdx, isLoner: true } })} className="bg-paper hover:bg-brand/10 text-brand-dark w-full py-3 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider border-2 border-brand transition-all shadow-[4px_4px_0px_0px_rgba(16,185,129,0.4)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none whitespace-nowrap">Go Alone</button>
                                                    <button onClick={() => dispatch({ type: 'PASS_BID', payload: { playerIndex: myIdx } })} className="bg-paper hover:bg-brand/10 text-brand-dark w-full py-3 rounded-xl font-black text-xs md:text-sm uppercase tracking-wider border-2 border-brand transition-all shadow-[4px_4px_0px_0px_rgba(16,185,129,0.4)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none whitespace-nowrap">Pass</button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-4 w-full">
                                                    <div className="flex gap-3">
                                                        {(['hearts', 'diamonds', 'clubs', 'spades'] as const).filter(s => s !== state.upcard!.suit).map(suit => (
                                                            <div key={suit} className="flex-1 flex flex-col gap-2">
                                                                <button onClick={() => dispatch({ type: 'MAKE_BID', payload: { suit, callerIndex: myIdx, isLoner: false } })} className="bg-paper hover:bg-brand/10 text-brand-dark w-full py-3 rounded-xl font-black text-[10px] md:text-xs uppercase tracking-wider border-2 border-brand transition-all shadow-[3px_3px_0px_0px_rgba(16,185,129,0.4)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">{suit}</button>
                                                                <button onClick={() => dispatch({ type: 'MAKE_BID', payload: { suit, callerIndex: myIdx, isLoner: true } })} className="bg-paper hover:bg-brand/10 text-brand w-full py-1.5 rounded-lg font-black text-[8px] uppercase tracking-wider border border-emerald-400 transition-all shadow-[2px_2px_0px_0px_rgba(16,185,129,0.3)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">Alone</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {myIdx !== state.dealerIndex ? (
                                                        <button onClick={() => dispatch({ type: 'PASS_BID', payload: { playerIndex: myIdx } })} className="bg-paper hover:bg-pink-50 text-brand-dark hover:text-pink-600 w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider border-2 border-brand hover:border-pink-500 transition-all shadow-[4px_4px_0px_0px_rgba(16,185,129,0.4)] hover:shadow-[4px_4px_0px_0px_rgba(236,72,153,0.4)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">Pass</button>
                                                    ) : (
                                                        <div className="w-full bg-paper border-2 border-red-500 text-red-500 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-center animate-pulse shadow-[4px_4px_0px_0px_rgba(239,68,68,0.2)]">
                                                            STICK THE DEALER: YOU MUST CALL
                                                        </div>
                                                    )}
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
                                            className="pointer-events-auto p-12 bg-ink/95 rounded-[4rem] border-2 border-brand shadow-2xl text-center backdrop-blur-3xl max-w-md"
                                        >
                                            <h3 className="text-sm font-black text-brand uppercase tracking-[0.4em] mb-4 text-center">Hand Result</h3>
                                            <p className="text-4xl font-black text-white italic tracking-tighter mb-10 leading-tight">
                                                {state.overlayMessage || state.logs[0]}
                                            </p>
                                            <button
                                                onClick={() => dispatch({ type: 'FINISH_HAND' })}
                                                className="w-full bg-paper text-slate-950 font-black py-5 rounded-3xl shadow-xl text-2xl hover:scale-105 active:scale-95 transition-all"
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


                    <div className="h-40 md:h-48 flex items-end justify-center relative mt-auto px-1 md:px-10 pt-2 pb-6 z-[60] w-full pointer-events-none">
                        {(() => {
                            const myIdx = state.players.findIndex(p => p.name === state.currentViewPlayerName);
                            if (myIdx === -1 || ['scoring', 'randomizing_dealer', 'game_over', 'lobby'].includes(state.phase)) return null;

                            const myPlayer = state.players[myIdx];
                            const handSize = myPlayer.hand.length;

                            return (
                                <div className="flex justify-center items-end relative mx-auto pointer-events-auto" style={{ width: '100%', maxWidth: '380px' }}>
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
                                            <div
                                                key={card.id}
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
                                            </div>
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
                            <button onClick={handleNextStep} className="w-full font-black py-4 bg-paper/20 hover:bg-paper/30 rounded-2xl transition transform active:scale-95">NEXT ACTION →</button>
                        </div>
                    )}
                </div>


            </div >
        </LayoutGroup >
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
            className="w-screen h-screen bg-transparent text-ink selection:bg-emerald-200 overflow-hidden font-hand relative"
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
                    <div className="bg-brand/20 backdrop-blur-sm rounded-full p-2">
                        <svg
                            className={`w-6 h-6 text-brand-dim ${pullDistance > 60 ? 'animate-spin' : ''}`}
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
