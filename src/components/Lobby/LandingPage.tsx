import { useState, useEffect } from 'react';
import { useGame, getSavedGames, deleteActiveGame } from '../../store/GameStore';
import { StatsModal } from '../common/StatsModal';
import { supabase } from '../../lib/supabase';
import { fetchUserCloudGames, mergeLocalAndCloudGames } from '../../utils/cloudGames';

export const LandingPage = () => {
    const { state, dispatch } = useGame();
    const [code, setCode] = useState('');
    const [showJoin, setShowJoin] = useState(false);
    const [_refreshKey, setRefreshKey] = useState(0);
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [statsInitialTab, setStatsInitialTab] = useState<'me' | 'league' | 'daily_challenge' | 'trump_analytics' | 'bot_audit' | 'freeze_incidents' | 'state_management' | 'commentary'>('me');
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
        let cleaned = value.replace(/[^\d-]/g, '');
        cleaned = cleaned.replace(/-/g, '');
        if (cleaned.length > 3) {
            cleaned = cleaned.slice(0, 3) + '-' + cleaned.slice(3, 6);
        }
        setCode(cleaned);
    };

    const handleJoinTable = async () => {
        if (!code) return;

        const { data } = await supabase
            .from('games')
            .select('state')
            .eq('code', code)
            .single();

        if (data && data.state) {
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

    return (
        <div className="flex flex-col items-center justify-start h-full w-full max-w-2xl mx-auto p-4 md:p-8 pt-6 md:pt-12 animate-in fade-in zoom-in duration-700 overflow-y-auto no-scrollbar">
            
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

                        <button
                            onClick={() => {
                                const dateString = new Date().toISOString().split('T')[0];
                                const tableCode = `DAILY-${dateString}-${state.currentUser}`;
                                const existingDaily = savedGames.find(g => g.tableCode === tableCode);
                                if (existingDaily) {
                                    dispatch({ type: 'LOAD_EXISTING_GAME', payload: { gameState: existingDaily } });
                                } else {
                                    dispatch({ type: 'START_DAILY_CHALLENGE', payload: { userName: state.currentUser || '', dateString } });
                                }
                            }}
                            className="group w-full max-w-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-8 rounded-2xl border-4 border-ink shadow-sketch-ink-lg hover:shadow-[4px_4px_0px_0px_rgba(251,191,36,0.5)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all text-center flex flex-col justify-center overflow-hidden relative cursor-pointer"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200 rounded-full blur-3xl opacity-30 transform translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-700"></div>
                            <div className="relative z-10 text-[10px] font-black uppercase tracking-[0.3em] text-white/80 mb-2">Daily Seeded Mode</div>
                            <div className="relative z-10 text-3xl font-black uppercase text-white tracking-widest leading-none mb-2 group-hover:scale-105 transition-transform">Hand of the Day</div>
                            <div className="relative z-10 text-[10px] text-white/90 font-bold uppercase tracking-wider">Play today's exact seeded game and compete globally.</div>
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

                {savedGames.length > 0 && (
                    <div className="space-y-4">
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
                                                {!game.tableCode?.startsWith('DAILY-') && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(game.tableCode); }}
                                                        className="p-2 text-ink-dim/50 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                )}
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
            
            <StatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} initialTab={statsInitialTab} />
        </div>
    );
};
