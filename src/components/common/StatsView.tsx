import { useState, useEffect } from 'react';
import { useGame } from '../../store/GameStore';
import { PlayerStats } from '../../types/game';
import { getLeaderboardStats, getPlayersStats, mergeAllStats, LOCAL_STORAGE_KEY, refreshPlayerStatsFromEvents } from '../../utils/supabaseStats';
import { getFreezeStats } from '../../utils/cloudFreezeLogger';
import { TrumpCallsTable } from '../Stats/TrumpCallsTable';
import { DailyLeaderboard } from './DailyLeaderboard';
import { LeagueTable } from '../Stats/LeagueTable';
import { BotAuditView } from '../Table/BotAuditView';

export const StatsView = ({
    initialTab = 'me'
}: {
    initialTab?: 'me' | 'league' | 'daily_challenge' | 'trump_analytics' | 'bot_audit' | 'freeze_incidents' | 'state_management' | 'commentary';
}) => {
    const { state } = useGame();
    const [allStats, setAllStats] = useState<{ [name: string]: PlayerStats }>({});
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        const localRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
        const localStats = localRaw ? JSON.parse(localRaw) : {};

        Promise.all([
            getLeaderboardStats(50),
            state.currentViewPlayerName ? getPlayersStats([state.currentViewPlayerName]) : Promise.resolve({})
        ]).then(([leaderboard, myCloud]) => {
            const merged = mergeAllStats(localStats, leaderboard);
            const mergedWithMe = mergeAllStats(merged, myCloud);
            setAllStats(mergedWithMe);
            setIsLoading(false);
        }).catch(err => {
            console.error('[STATS VIEW] Failed to load stats:', err);
            setAllStats(localStats);
            setIsLoading(false);
        });
    }, []);

    const isAdmin = (state.currentUser || '').toLowerCase() === 'aaron';
    const handleRebuildStats = async () => {
        setIsLoading(true);
        const ok = await refreshPlayerStatsFromEvents();
        if (!ok) {
            console.error('[STATS VIEW] Failed to rebuild stats from events.');
        }
        const localRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
        const localStats = localRaw ? JSON.parse(localRaw) : {};
        const [leaderboard, myCloud] = await Promise.all([
            getLeaderboardStats(50),
            state.currentViewPlayerName ? getPlayersStats([state.currentViewPlayerName]) : Promise.resolve({})
        ]);
        const merged = mergeAllStats(localStats, leaderboard);
        setAllStats(mergeAllStats(merged, myCloud));
        setIsLoading(false);
    };

    const myStats = allStats[state.currentViewPlayerName!] || {
        gamesPlayed: 0,
        gamesWon: 0,
        handsPlayed: 0,
        handsWon: 0,
        tricksPlayed: 0,
        tricksTaken: 0,
        tricksWonTeam: 0,
        callsMade: 0,
        callsWon: 0,
        lonersAttempted: 0,
        lonersWon: 0,
        pointsScored: 0,
        euchresMade: 0,
        euchred: 0,
        sweeps: 0,
        swept: 0
    };

    return (
        <div className="flex flex-col h-full bg-paper">
            {/* Fixed Top Section: Header + Tabs */}
            <div className="flex-none bg-paper z-30 border-b-4 border-ink">
                {/* Header */}
                <div className="p-6 md:p-8 bg-brand/5 space-y-2">
                    <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter">Match Analytics</h2>
                    <div className="flex items-center gap-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-dim">Persistence engine v4.0 (Active)</p>
                        {isAdmin && (
                            <button
                                onClick={handleRebuildStats}
                                className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border-2 border-brand text-brand hover:bg-brand/10 transition-all"
                            >
                                Rebuild Stats
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs Navigation (Sticky/Fixed in flex-col) */}
                <div className="flex overflow-x-auto no-scrollbar bg-paper">
                    {(['me', 'league', 'daily_challenge', 'trump_analytics', 'bot_audit', 'freeze_incidents', 'state_management', 'commentary'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 md:px-8 py-4 text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-4 ${activeTab === tab ? 'border-brand text-brand bg-brand/5' : 'border-transparent text-ink-dim hover:text-ink hover:bg-paper-dim'}`}
                        >
                            {tab.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto bg-paper custom-scrollbar z-10 p-4 md:p-8">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-brand">Syncing with Supabase...</div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
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
                        
                        {activeTab === 'league' && (
                            <LeagueTable allStats={allStats} />
                        )}

                        {activeTab === 'trump_analytics' && (
                            <TrumpCallsTable />
                        )}

                        {activeTab === 'daily_challenge' && (
                            <DailyLeaderboard />
                        )}

                        {activeTab === 'bot_audit' && (
                            <BotAuditView inline />
                        )}

                        {activeTab === 'freeze_incidents' && (
                            <FreezeIncidentsList />
                        )}

                        {activeTab === 'state_management' && (
                            <div className="space-y-4">
                                <div className="p-6 bg-slate-900 rounded-3xl border-4 border-slate-800 font-mono text-[10px] text-emerald-400 overflow-x-auto overflow-y-auto max-h-[600px]">
                                    <pre>{JSON.stringify(state, (key, value) => ['eventLog', 'history', 'logs'].includes(key) ? undefined : value, 2)}</pre>
                                </div>
                                <div className="text-center p-4 bg-amber-50 rounded-2xl border-2 border-amber-200">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 italic">Caution: Live Engine State. Sensitive logs and history are hidden for performance.</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'commentary' && (
                            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-2xl border-2 border-slate-200 italic font-hand">"?"</div>
                                <div className="space-y-1">
                                    <div className="text-lg font-black uppercase tracking-tight text-slate-400">Match Commentary</div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Semantic analysis engine v1.0 offline</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Version Footer Padding (so it doesn't overlap the bottom nav) */}
            <div className="h-20" />
        </div>
    );
};

const FreezeIncidentsList = () => {
    const [incidents, setIncidents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getFreezeStats().then(data => {
            setIncidents(data || []);
            setLoading(false);
        });
    }, []);

    if (loading) return <div className="animate-pulse text-center p-12 text-[10px] font-black uppercase tracking-[0.3em] text-brand">Scanning for anomalies...</div>;

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-4">Anomalous Activity Log</h3>
            {incidents.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-black uppercase tracking-widest border-2 border-dashed border-slate-200 rounded-3xl">No incidents detected in current cycle</div>
            ) : (
                <div className="space-y-4">
                    {incidents.map((incident, i) => (
                        <div key={i} className="bg-paper border-2 border-slate-100 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${incident.recovered ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    <div className="text-sm font-black uppercase tracking-tight text-slate-900">{incident.freeze_type}</div>
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Game: {incident.game_code} • {new Date(incident.created_at).toLocaleString()}</div>
                            </div>
                            <div className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-100">
                                Result: {incident.recovered ? 'RECOVERED' : 'ABORTED'}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
