import { useEffect, useState, useMemo } from 'react';
import { getDailyLeaderboard } from '../../utils/supabaseStats';
import { Trophy, Medal, ChevronUp, ChevronDown } from 'lucide-react';

interface DailyScore {
    id: string;
    date_string: string;
    player_name: string;
    team_points: number;
    team_tricks: number;
    individual_tricks: number;
    opp_points: number;
    opp_tricks: number;
    created_at: string;
}

type SortKey = 'player_name' | 'team_points' | 'opp_points' | 'points_per_hand' | 'score_diff' | 'team_tricks' | 'individual_tricks' | 'win_pct' | 'challenges_played';

interface SortConfig {
    key: SortKey;
    direction: 'asc' | 'desc';
}

export const DailyLeaderboard = ({ hideHeader = false }: { hideHeader?: boolean }) => {
    const [scores, setScores] = useState<DailyScore[]>([]);
    const [allTimeScores, setAllTimeScores] = useState<any[]>([]);
    const [tab, setTab] = useState<'today' | 'all'>('today');
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'score_diff', direction: 'desc' });
    
    const dateString = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const fetchScores = async () => {
            setLoading(true);
            
            // 1. Fetch Today's scores specifically to be bulletproof
            const todayData = await getDailyLeaderboard(dateString);
            setScores(todayData as DailyScore[]);

            // 2. Fetch All for aggregates (up to limit)
            const allData = await getDailyLeaderboard('all');
            const dataScores = allData as DailyScore[];
            
            // Calculate All-Time totals from the larger set
            const playerTotals: Record<string, any> = {};
            dataScores.forEach(s => {
                if (!playerTotals[s.player_name]) {
                    playerTotals[s.player_name] = {
                        player_name: s.player_name,
                        challenges_played: 0,
                        team_points: 0,
                        opp_points: 0,
                        team_tricks: 0,
                        individual_tricks: 0,
                        opp_tricks: 0
                    };
                }
                playerTotals[s.player_name].challenges_played += 1;
                playerTotals[s.player_name].team_points += s.team_points;
                playerTotals[s.player_name].opp_points += (s.opp_points || 0);
                playerTotals[s.player_name].team_tricks += s.team_tricks;
                playerTotals[s.player_name].individual_tricks += s.individual_tricks;
                playerTotals[s.player_name].opp_tricks += (s.opp_tricks || (20 - s.team_tricks));
            });

            const allTime = Object.values(playerTotals);
            setAllTimeScores(allTime);
            setLoading(false);
        };
        fetchScores();
    }, [dateString]);

    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const getProcessedScores = (rawScores: any[]) => {
        const processed = rawScores.map(score => {
            const scoreDiff = score.team_points - (score.opp_points || 0);
            const totalTricks = score.team_tricks + (score.opp_tricks || (20 - score.team_tricks));
            const hPlayed = Math.max(1, totalTricks / 5);
            const ptsPerHand = score.team_points / hPlayed;
            const winPct = totalTricks > 0 ? (score.individual_tricks / totalTricks) * 100 : 0;
            const teamTrickPct = totalTricks > 0 ? (score.team_tricks / totalTricks) * 100 : 0;

            return {
                ...score,
                score_diff: scoreDiff,
                points_per_hand: ptsPerHand,
                win_pct: winPct,
                totalTricks,
                teamTrickPct
            };
        });

        return processed.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];

            if (typeof valA === 'string') {
                return sortConfig.direction === 'asc' 
                    ? valA.localeCompare(valB) 
                    : valB.localeCompare(valA);
            }

            return sortConfig.direction === 'asc' 
                ? (valA || 0) - (valB || 0) 
                : (valB || 0) - (valA || 0);
        });
    };

    const sortedData = useMemo(() => {
        return getProcessedScores(tab === 'today' ? scores : allTimeScores);
    }, [scores, allTimeScores, tab, sortConfig]);

    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortConfig.key !== column) return <div className="w-4 h-4 opacity-0" />;
        return sortConfig.direction === 'desc' 
            ? <ChevronDown className="w-4 h-4 text-brand inline ml-1" />
            : <ChevronUp className="w-4 h-4 text-brand inline ml-1" />;
    };

    const Th = ({ label, sortKey, align = 'left', className = '' }: { label: string, sortKey: SortKey, align?: 'left' | 'right' | 'center', className?: string }) => (
        <th 
            onClick={() => handleSort(sortKey)}
            className={`p-3 text-[10px] font-black uppercase tracking-widest text-ink cursor-pointer hover:bg-ink/10 transition-colors ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${className}`}
        >
            <div className={`flex items-center ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
                {label}
                <SortIcon column={sortKey} />
            </div>
        </th>
    );

    return (
        <div className="space-y-4 font-hand">
            {!hideHeader && (
                <div className="text-center mb-8">
                    <h3 className="text-2xl font-black uppercase tracking-widest text-brand">Daily Challenge Stats</h3>
                    
                    <div className="flex justify-center gap-4 mt-4 text-xs font-black uppercase tracking-widest">
                        <button 
                            onClick={() => { setTab('today'); setSortConfig({ key: 'score_diff', direction: 'desc' }); }}
                            className={`pb-1 border-b-2 transition-all ${tab === 'today' ? 'text-brand border-brand' : 'text-ink-dim border-transparent hover:text-brand-dim'}`}
                        >
                            Today ({dateString})
                        </button>
                        <button 
                            onClick={() => { setTab('all'); setSortConfig({ key: 'score_diff', direction: 'desc' }); }}
                            className={`pb-1 border-b-2 transition-all ${tab === 'all' ? 'text-brand border-brand' : 'text-ink-dim border-transparent hover:text-brand-dim'}`}
                        >
                            All-Time Aggregates
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="p-8 text-center text-ink-dim animate-pulse font-bold tracking-widest uppercase">Loading stats...</div>
            ) : (
                sortedData.length === 0 ? (
                    <div className="p-12 text-center text-ink-dim font-bold tracking-widest uppercase italic border-2 border-dashed border-ink-dim/30 rounded-2xl">
                        {tab === 'today' ? 'No scores submitted for today yet. Play a game!' : 'No historical scores found.'}
                    </div>
                ) : (
                    <div className="bg-paper border-2 border-ink rounded-xl overflow-hidden shadow-sketch-ink overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="border-b-2 border-ink bg-ink/5">
                                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-ink text-center">Rnk</th>
                                    <Th label="Player" sortKey="player_name" />
                                    {tab === 'all' && <Th label="Games" sortKey="challenges_played" align="right" />}
                                    <Th label="Team Pts" sortKey="team_points" align="right" />
                                    <Th label="Opp Pts" sortKey="opp_points" align="right" />
                                    <Th label="Pts/Hnd" sortKey="points_per_hand" align="right" />
                                    <Th label="Score Diff" sortKey="score_diff" align="right" />
                                    <Th label="Tricks Won (Team)" sortKey="team_tricks" align="right" />
                                    <Th label="Tricks Won (Player)" sortKey="individual_tricks" align="right" />
                                    <Th label="Plr Win %" sortKey="win_pct" align="right" className="text-brand" />
                                </tr>
                            </thead>
                            <tbody>
                                {sortedData.map((score, index) => {
                                    return (
                                        <tr key={tab === 'today' ? score.id : score.player_name} className="border-b border-ink/20 hover:bg-ink/5 transition-colors">
                                            <td className="p-3 font-bold text-ink flex justify-center items-center">
                                                {index === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
                                                {index === 1 && <Medal className="w-4 h-4 text-gray-400" />}
                                                {index === 2 && <Medal className="w-4 h-4 text-amber-700" />}
                                                {index > 2 && <span className="text-ink-dim text-xs">#{index + 1}</span>}
                                            </td>
                                            <td className="p-3 font-black text-ink uppercase tracking-wider text-xs">{score.player_name}</td>
                                            {tab === 'all' && <td className="p-3 text-right font-black text-ink text-sm">{score.challenges_played}</td>}
                                            <td className="p-3 text-right font-black text-brand text-sm">{score.team_points}</td>
                                            <td className="p-3 text-right font-bold text-ink-dim text-sm">{score.opp_points || 0}</td>
                                            <td className="p-3 text-right font-bold text-ink-dim text-sm">{score.points_per_hand.toFixed(2)}</td>
                                            <td className={`p-3 text-right font-black text-sm ${score.score_diff > 0 ? 'text-brand' : score.score_diff < 0 ? 'text-red-500' : 'text-ink'}`}>
                                                {score.score_diff > 0 ? `+${score.score_diff}` : score.score_diff}
                                            </td>
                                            <td className="p-3 text-right font-bold text-ink-dim text-sm italic">
                                                {score.team_tricks} <span className="text-[10px] opacity-70">({score.teamTrickPct.toFixed(1)}%)</span>
                                            </td>
                                            <td className="p-3 text-right font-bold text-purple-600 text-sm">{score.individual_tricks}</td>
                                            <td className="p-3 text-right font-black text-brand text-sm">{Math.round(score.win_pct)}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            )}
        </div>
    );
};
