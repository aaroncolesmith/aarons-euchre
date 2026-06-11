import { useState, useEffect } from 'react';
import { useGame, getSavedGames, deleteActiveGame } from '../../store/GameStore';
import { supabase } from '../../lib/supabase';
import { fetchUserCloudGames, mergeLocalAndCloudGames } from '../../utils/cloudGames';
import { hasUserPlayedDaily, getPlayerDailyStreak } from '../../utils/supabaseStats';
import { getDailyChallengeDate, isDailyChallengeExpired, getTodayHandNumber, getDateStringFromHandNumber } from '../../utils/dailyUtils';
import { APP_VERSION } from '../../version';

const PRACTICE_TOTAL = 100;
const PRACTICE_PAGE = 10;

export const LandingPage = () => {
    const { state, dispatch } = useGame();
    const [showJoin, setShowJoin] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return !!params.get('join');
    });
    const [code, setCode] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('join') || '';
    });
    const [showFriends, setShowFriends] = useState(false);
    const [_refreshKey, setRefreshKey] = useState(0);
    const [cloudGames, setCloudGames] = useState<any[]>([]);
    const [gameFilter, setGameFilter] = useState<'in-progress' | 'completed'>('in-progress');
    const [hasPlayedDaily, setHasPlayedDaily] = useState(false);
    const [streak, setStreak] = useState<{ current: number; longest: number }>({ current: 0, longest: 0 });
    const [showPractice, setShowPractice] = useState(false);
    const [practiceVisible, setPracticeVisible] = useState(PRACTICE_PAGE);

    const todayHandNum = getTodayHandNumber();
    const todayDateString = getDailyChallengeDate();

    useEffect(() => {
        const loadAll = async () => {
            if (!state.currentUser) return;

            const [games, played, streakData] = await Promise.all([
                fetchUserCloudGames(state.currentUser),
                hasUserPlayedDaily(state.currentUser, todayDateString, todayHandNum),
                getPlayerDailyStreak(state.currentUser, todayHandNum),
            ]);

            setCloudGames(games);
            setHasPlayedDaily(played);
            setStreak(streakData);
        };
        loadAll();
    }, [state.currentUser, _refreshKey]);

    const savedGamesRaw = getSavedGames();
    const localGames = Object.values(savedGamesRaw)
        .filter(g =>
            g.currentUser === state.currentUser ||
            g.players.some(p => p.name === state.currentUser)
        );

    const savedGames = mergeLocalAndCloudGames(localGames, cloudGames);

    const getTimeAgo = (game: any) => {
        if (!game.lastActive) return 'Recently';
        const diff = Date.now() - game.lastActive;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    const handleCodeChange = (value: string) => {
        let cleaned = value.replace(/[^\d-]/g, '').replace(/-/g, '');
        if (cleaned.length > 3) cleaned = cleaned.slice(0, 3) + '-' + cleaned.slice(3, 6);
        setCode(cleaned);
    };

    const handleJoinTable = async () => {
        if (!code) return;
        if (window.location.search) window.history.replaceState({}, '', window.location.pathname);

        const { data } = await supabase
            .from('games')
            .select('state')
            .eq('code', code)
            .single();

        if (data?.state) {
            dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: data.state } });
            dispatch({ type: 'JOIN_TABLE', payload: { code, userName: state.currentUser! } });
        } else {
            dispatch({ type: 'JOIN_TABLE', payload: { code, userName: state.currentUser! } });
        }
    };

    const handleDelete = async (tableCode: string | null) => {
        if (!tableCode) return;
        if (confirm('Are you sure you want to delete this game?')) {
            await deleteActiveGame(tableCode);
            setRefreshKey(prev => prev + 1);
        }
    };

    const startOrResumeDaily = (dateStr: string) => {
        const tableCode = `DAILY-${dateStr}-${state.currentUser}`;
        const existing = savedGames.find(g => g.tableCode === tableCode);
        if (existing) {
            dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: existing } });
        } else {
            dispatch({ type: 'START_DAILY_CHALLENGE', payload: { userName: state.currentUser!, dateString: dateStr } });
        }
    };

    const startOrResumePractice = (eukleNumber: number) => {
        const tableCode = `EUKLE-${eukleNumber}-${state.currentUser}`;
        const existing = savedGames.find(g => g.tableCode === tableCode);
        if (existing) {
            dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: existing } });
        } else {
            dispatch({ type: 'START_EUKLE', payload: { userName: state.currentUser!, eukleNumber } });
        }
    };

    // Derive local practice game status from savedGames
    const practiceStatus = (eukleNumber: number): 'not-started' | 'in-progress' | 'won' | 'lost' => {
        const tableCode = `EUKLE-${eukleNumber}-${state.currentUser}`;
        const game = savedGames.find(g => g.tableCode === tableCode);
        if (!game) return 'not-started';
        if (game.phase !== 'game_over') return 'in-progress';
        const userIdx = game.players.findIndex((p: any) => p.name === state.currentUser);
        const isTeam1 = userIdx === 0 || userIdx === 2;
        return (isTeam1 ? game.scores.team1 : game.scores.team2) >= 10 ? 'won' : 'lost';
    };

    return (
        <div className="flex flex-col items-center justify-start h-full w-full max-w-2xl mx-auto p-4 md:p-8 pt-6 md:pt-12 animate-in fade-in zoom-in duration-700 overflow-y-auto no-scrollbar">
            <div className="w-full mb-8">

                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <div className="flex items-baseline gap-2">
                            <h1 className="text-6xl font-black text-ink tracking-wide uppercase italic">EUCHRE</h1>
                            <span className="text-[10px] font-black text-brand-dim uppercase tracking-widest opacity-50">v{APP_VERSION}</span>
                        </div>
                        <p className="text-xs font-bold text-brand tracking-[0.2em] mt-1 ml-1 uppercase">
                            Hello, {state.currentUser}
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                        <button
                            onClick={() => dispatch({ type: 'SET_TAB', payload: { tab: 'stats' } })}
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

                {/* ── HERO: Hand of the Day ───────────────────────────── */}
                <div className="mb-6">
                    <button
                        disabled={hasPlayedDaily}
                        onClick={() => {
                            if (!hasPlayedDaily) startOrResumeDaily(todayDateString);
                        }}
                        className={`group w-full p-8 rounded-2xl border-4 border-ink shadow-sketch-ink-lg transition-all text-left relative overflow-hidden ${
                            hasPlayedDaily
                                ? 'bg-slate-100 opacity-80 cursor-default grayscale'
                                : 'bg-gradient-to-br from-amber-400 to-amber-500 hover:shadow-[4px_4px_0px_0px_rgba(251,191,36,0.5)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none cursor-pointer'
                        }`}
                    >
                        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-200 rounded-full blur-3xl opacity-30 transform translate-x-12 -translate-y-12 group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
                        <div className="relative z-10">
                            <div className="flex items-start justify-between mb-1">
                                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">
                                    {hasPlayedDaily ? 'Complete' : 'Daily Seeded Eukle'}
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-white/60 tabular-nums">
                                    #{todayHandNum}
                                </div>
                            </div>
                            <div className="text-3xl font-black uppercase text-white tracking-widest leading-none mb-3 group-hover:scale-[1.02] transition-transform origin-left">
                                Eukle of the Day
                            </div>

                            {hasPlayedDaily ? (
                                <div
                                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SET_TAB', payload: { tab: 'stats' } }); }}
                                    className="inline-block text-[10px] text-white bg-amber-700/50 px-4 py-2 rounded-full font-black uppercase tracking-widest hover:bg-amber-700 transition-colors cursor-pointer"
                                >
                                    View Leaderboard →
                                </div>
                            ) : (
                                <div className="text-[11px] text-white/90 font-bold uppercase tracking-wider">
                                    Play today's seeded Eukle — compete globally.
                                </div>
                            )}
                        </div>
                    </button>

                    {/* Streak indicator */}
                    {streak.current > 0 && (
                        <div className="flex items-center gap-3 mt-3 px-1">
                            <span className="text-sm font-black text-ink uppercase tracking-widest">
                                🔥 {streak.current}-day streak
                            </span>
                            {streak.longest > streak.current && (
                                <span className="text-[10px] font-bold text-ink-dim uppercase tracking-widest">
                                    Best: {streak.longest}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Numbered Eukles toggle */}
                    <button
                        onClick={() => setShowPractice(v => !v)}
                        className="mt-3 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-ink-dim hover:text-ink transition-colors"
                    >
                        <svg className={`w-3 h-3 transition-transform ${showPractice ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                        </svg>
                        Numbered Eukles (100)
                    </button>

                    {showPractice && (
                        <div className="mt-2 space-y-1 animate-in slide-in-from-top-2 duration-200">
                            {Array.from({ length: Math.min(practiceVisible, PRACTICE_TOTAL) }, (_, i) => i + 1).map(n => {
                                const status = practiceStatus(n);
                                return (
                                    <div
                                        key={n}
                                        className="flex items-center justify-between bg-paper border border-ink-dim/30 rounded-xl px-4 py-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black text-ink-dim tabular-nums w-8">#{n}</span>
                                            {status === 'won' && <span className="text-[9px] font-black text-brand uppercase tracking-widest">✓ Win</span>}
                                            {status === 'lost' && <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">✗ Loss</span>}
                                            {status === 'in-progress' && <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">In Progress</span>}
                                        </div>
                                        <button
                                            onClick={() => startOrResumePractice(n)}
                                            className="text-[10px] font-black text-brand hover:text-brand-dark uppercase tracking-widest transition-colors"
                                        >
                                            {status === 'not-started' ? 'Play →' : status === 'in-progress' ? 'Resume →' : 'Replay →'}
                                        </button>
                                    </div>
                                );
                            })}
                            {practiceVisible < PRACTICE_TOTAL && (
                                <button
                                    onClick={() => setPracticeVisible(v => Math.min(v + PRACTICE_PAGE, PRACTICE_TOTAL))}
                                    className="w-full text-[10px] font-black uppercase tracking-widest text-ink-dim hover:text-ink py-2 transition-colors"
                                >
                                    Show more ({PRACTICE_TOTAL - practiceVisible} remaining)
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Play with Friends ───────────────────────────────── */}
                <div className="mb-8">
                    <button
                        onClick={() => setShowFriends(v => !v)}
                        className="w-full flex items-center justify-between bg-paper border-2 border-ink rounded-xl px-5 py-4 font-black text-ink uppercase tracking-widest text-sm shadow-sketch-ink hover:bg-paper-dim transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    >
                        Play with Friends
                        <svg className={`w-4 h-4 transition-transform ${showFriends ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showFriends && !showJoin && (
                        <div className="mt-2 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2 duration-200">
                            <button
                                onClick={() => dispatch({ type: 'CREATE_TABLE', payload: { userName: state.currentUser! } })}
                                className="bg-paper text-ink font-black py-4 rounded-xl text-sm border-2 border-ink shadow-sketch-ink hover:bg-paper-dim active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all uppercase tracking-widest"
                            >
                                Create Game
                            </button>
                            <button
                                onClick={() => setShowJoin(true)}
                                className="bg-brand-dim text-ink font-black py-4 rounded-xl text-sm border-2 border-ink shadow-sketch-ink hover:bg-paper-dim active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all uppercase tracking-widest"
                            >
                                Join Table
                            </button>
                        </div>
                    )}

                    {showFriends && showJoin && (
                        <div className="mt-2 bg-paper p-5 rounded-[1.5rem] border-2 border-ink shadow-sketch-ink animate-in slide-in-from-top-2 duration-200">
                            <div className="space-y-3">
                                <label className="text-xs font-black text-ink-dim uppercase tracking-widest ml-1">Enter 6-Digit Code</label>
                                <input
                                    autoFocus
                                    value={code}
                                    onChange={(e) => handleCodeChange(e.target.value)}
                                    maxLength={7}
                                    className="w-full bg-paper-dim border-2 border-ink rounded-2xl px-6 py-3 text-3xl font-black text-ink text-center focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all placeholder:text-ink-dim/50 tracking-widest shadow-inner"
                                    placeholder="000-000"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <button
                                    onClick={() => { setShowJoin(false); setCode(''); }}
                                    className="bg-paper-dim text-slate-600 font-black py-3 rounded-xl border-2 border-ink-dim hover:bg-slate-200 transition-all uppercase tracking-widest text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleJoinTable}
                                    className="bg-brand text-white font-black py-3 rounded-xl border-2 border-brand-dark shadow-[4px_4px_0px_0px_rgba(6,95,70,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(6,95,70,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all uppercase tracking-widest text-sm"
                                >
                                    Join
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Saved Games ────────────────────────────────────── */}
                {savedGames.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex gap-6 border-b-2 border-ink-dim/50 pb-px px-2">
                            <button
                                onClick={() => setGameFilter('in-progress')}
                                className={`text-xs font-black uppercase tracking-widest pb-3 transition-all relative ${gameFilter === 'in-progress' ? 'text-brand' : 'text-ink-dim hover:text-slate-600'}`}
                            >
                                In Progress ({savedGames.filter(g => g.phase !== 'game_over').length})
                                {gameFilter === 'in-progress' && <span className="absolute bottom-[-2px] left-0 w-full h-[3px] bg-brand rounded-full" />}
                            </button>
                            <button
                                onClick={() => setGameFilter('completed')}
                                className={`text-xs font-black uppercase tracking-widest pb-3 transition-all relative ${gameFilter === 'completed' ? 'text-brand' : 'text-ink-dim hover:text-slate-600'}`}
                            >
                                Completed ({savedGames.filter(g => g.phase === 'game_over').length})
                                {gameFilter === 'completed' && <span className="absolute bottom-[-2px] left-0 w-full h-[3px] bg-brand rounded-full" />}
                            </button>
                            <button
                                onClick={() => setRefreshKey(prev => prev + 1)}
                                className="ml-auto text-ink-dim hover:text-brand transition-colors"
                                title="Sync with Cloud"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h5M20 20v-5h-5M20 5.138A9 9 0 004.862 13M4 18.862A9 9 0 0019.138 11" />
                                </svg>
                            </button>
                        </div>

                        <div className="space-y-3 pb-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                            {savedGames
                                .filter(g => gameFilter === 'in-progress' ? g.phase !== 'game_over' : g.phase === 'game_over')
                                .map(game => {
                                    const isDaily = game.tableCode?.startsWith('DAILY-');
                                    let isExpired = false;
                                    if (isDaily) {
                                        const dateStr = game.tableCode!.split('-').slice(1, 4).join('-');
                                        // Handle both old format (YYYY-MM-DD) and detect hand-number format
                                        const expDateStr = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
                                            ? dateStr
                                            : getDateStringFromHandNumber(Number(game.tableCode!.split('-')[1]));
                                        isExpired = isDailyChallengeExpired(expDateStr);
                                    }

                                    return (
                                        <div
                                            key={game.tableCode}
                                            className={`group relative bg-paper border-2 border-dashed border-ink-dim hover:border-solid hover:border-brand rounded-xl p-4 transition-all hover:shadow-sketch-brand cursor-pointer overflow-hidden ${isExpired ? 'opacity-70 bg-slate-50 border-slate-300' : ''}`}
                                            onClick={() => {
                                                if (isExpired && game.phase !== 'game_over') return;
                                                dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: game } });
                                            }}
                                        >
                                            {isExpired && game.phase !== 'game_over' && (
                                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[1px] pointer-events-none">
                                                    <span className="text-4xl font-black text-ink/40 uppercase tracking-widest italic -rotate-12 select-none">expired</span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${isExpired ? 'bg-slate-200 text-slate-500 border-slate-300' : 'bg-brand/20 text-brand-dark border-brand-dim'}`}>
                                                            {game.tableCode}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-ink-dim uppercase tracking-wider">{getTimeAgo(game)}</div>
                                                    </div>
                                                    <div className="text-lg font-black text-ink leading-tight mb-1">{game.tableName || 'Untitled Game'}</div>
                                                    <div className="text-xs font-bold text-ink-dim flex items-center gap-3">
                                                        <span className={game.scores.team1 >= 10 ? 'text-brand' : ''}>Team A: {game.scores.team1}</span>
                                                        <span className="text-ink-dim/50">•</span>
                                                        <span className={game.scores.team2 >= 10 ? 'text-brand' : ''}>Team B: {game.scores.team2}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 pl-4 border-l-2 border-paper-dim relative z-20">
                                                    {(!game.tableCode?.startsWith('DAILY-') || (isExpired && game.phase !== 'game_over')) && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(game.tableCode); }}
                                                            className="p-2 text-ink-dim/50 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    {(!isExpired || game.phase === 'game_over') && (
                                                        <button className="bg-brand/10 text-brand hover:bg-brand hover:text-white border-2 border-brand-dim hover:border-brand p-2 rounded-lg transition-all">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
