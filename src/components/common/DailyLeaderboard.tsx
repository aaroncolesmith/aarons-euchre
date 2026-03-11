import { useEffect, useState } from 'react';
import { getDailyLeaderboard } from '../../utils/supabaseStats';
import { Trophy, Medal } from 'lucide-react';

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

export const DailyLeaderboard = () => {
    const [scores, setScores] = useState<DailyScore[]>([]);
    const [allTimeScores, setAllTimeScores] = useState<any[]>([]);
    const [tab, setTab] = useState<'today' | 'all'>('today');
    const [loading, setLoading] = useState(true);
    const dateString = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const fetchScores = async () => {
            setLoading(true);
            const data = await getDailyLeaderboard('all');
            const dataScores = data as DailyScore[];
            
            // Format today's scores
            const todayScores = dataScores.filter(s => s.date_string === dateString);
            setScores(todayScores);

            // Calculate All-Time totals
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
                playerTotals[s.player_name].opp_tricks += (s.opp_tricks || (20 - s.team_tricks)); // Fallback approximation for old data
            });

            const allTime = Object.values(playerTotals).sort((a: any, b: any) => {
                const diffA = a.team_points - a.opp_points;
                const diffB = b.team_points - b.opp_points;
                if (diffA !== diffB) return diffB - diffA;
                return b.team_points - a.team_points;
            });
            
            setAllTimeScores(allTime);
            setLoading(false);
        };
        fetchScores();
    }, [dateString]);

    return (
        <div className="space-y-4 font-hand">
            <div className="text-center mb-8">
                <h3 className="text-2xl font-black uppercase tracking-widest text-brand">Daily Challenge Stats</h3>
                
                <div className="flex justify-center gap-4 mt-4 text-xs font-black uppercase tracking-widest">
                    <button 
                        onClick={() => setTab('today')}
                        className={`pb-1 border-b-2 transition-all ${tab === 'today' ? 'text-brand border-brand' : 'text-ink-dim border-transparent hover:text-brand-dim'}`}
                    >
                        Today ({dateString})
                    </button>
                    <button 
                        onClick={() => setTab('all')}
                        className={`pb-1 border-b-2 transition-all ${tab === 'all' ? 'text-brand border-brand' : 'text-ink-dim border-transparent hover:text-brand-dim'}`}
                    >
                        All-Time Aggregates
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-8 text-center text-ink-dim animate-pulse font-bold tracking-widest uppercase">Loading stats...</div>
            ) : tab === 'today' ? (
                scores.length === 0 ? (
                    <div className="p-12 text-center text-ink-dim font-bold tracking-widest uppercase italic border-2 border-dashed border-ink-dim/30 rounded-2xl">
                        No scores submitted for today yet. Play a game!
                    </div>
                ) : (
                    <div className="bg-paper border-2 border-ink rounded-xl overflow-hidden shadow-sketch-ink overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="border-b-2 border-ink bg-ink/5">
                                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-ink text-center">Rnk</th>
                                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-ink">Player</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Team Pts</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Opp Pts</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Score Diff</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Team Trk</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Plr Trk</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink text-brand">Plr Win %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scores.sort((a,b) => (b.team_points - (b.opp_points||0)) - (a.team_points - (a.opp_points||0)) || b.team_points - a.team_points).map((score, index) => {
                                    const diff = score.team_points - (score.opp_points || 0);
                                    const totalTricks = score.team_tricks + (score.opp_tricks || (20 - score.team_tricks));
                                    const winPct = totalTricks > 0 ? Math.round((score.individual_tricks / totalTricks) * 100) : 0;
                                    
                                    return (
                                        <tr key={score.id} className="border-b border-ink/20 hover:bg-ink/5 transition-colors">
                                            <td className="p-3 font-bold text-ink flex justify-center">
                                                {index === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
                                                {index === 1 && <Medal className="w-4 h-4 text-gray-400" />}
                                                {index === 2 && <Medal className="w-4 h-4 text-amber-700" />}
                                                {index > 2 && <span className="text-ink-dim text-xs">#{index + 1}</span>}
                                            </td>
                                            <td className="p-3 font-black text-ink uppercase tracking-wider text-xs">{score.player_name}</td>
                                            <td className="p-3 text-right font-black text-brand text-sm">{score.team_points}</td>
                                            <td className="p-3 text-right font-bold text-ink-dim text-sm">{score.opp_points || 0}</td>
                                            <td className={`p-3 text-right font-black text-sm ${diff > 0 ? 'text-brand' : diff < 0 ? 'text-red-500' : 'text-ink'}`}>{diff > 0 ? `+${diff}` : diff}</td>
                                            <td className="p-3 text-right font-bold text-ink-dim text-sm">{score.team_tricks}</td>
                                            <td className="p-3 text-right font-bold text-purple-600 text-sm">{score.individual_tricks}</td>
                                            <td className="p-3 text-right font-black text-brand text-sm">{winPct}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            ) : (
                allTimeScores.length === 0 ? (
                    <div className="p-12 text-center text-ink-dim font-bold tracking-widest uppercase italic border-2 border-dashed border-ink-dim/30 rounded-2xl">
                        No historical scores found.
                    </div>
                ) : (
                    <div className="bg-paper border-2 border-ink rounded-xl overflow-hidden shadow-sketch-ink overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="border-b-2 border-ink bg-ink/5">
                                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-ink text-center">Rnk</th>
                                    <th className="p-3 text-[10px] font-black uppercase tracking-widest text-ink">Player</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Games</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Team Pts</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Opp Pts</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Score Diff</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Team Trk</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Plr Trk</th>
                                    <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink text-brand">Plr Win %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allTimeScores.map((score, index) => {
                                    const diff = score.team_points - score.opp_points;
                                    const totalTricks = score.team_tricks + score.opp_tricks;
                                    const winPct = totalTricks > 0 ? Math.round((score.individual_tricks / totalTricks) * 100) : 0;
                                    
                                    return (
                                        <tr key={index} className="border-b border-ink/20 hover:bg-ink/5 transition-colors">
                                            <td className="p-3 font-bold text-ink flex justify-center">
                                                {index === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
                                                {index === 1 && <Medal className="w-4 h-4 text-gray-400" />}
                                                {index === 2 && <Medal className="w-4 h-4 text-amber-700" />}
                                                {index > 2 && <span className="text-ink-dim text-xs">#{index + 1}</span>}
                                            </td>
                                            <td className="p-3 font-black text-ink uppercase tracking-wider text-xs">{score.player_name}</td>
                                            <td className="p-3 text-right font-black text-ink text-sm">{score.challenges_played}</td>
                                            <td className="p-3 text-right font-black text-brand text-sm">{score.team_points}</td>
                                            <td className="p-3 text-right font-bold text-ink-dim text-sm">{score.opp_points}</td>
                                            <td className={`p-3 text-right font-black text-sm ${diff > 0 ? 'text-brand' : diff < 0 ? 'text-red-500' : 'text-ink'}`}>{diff > 0 ? `+${diff}` : diff}</td>
                                            <td className="p-3 text-right font-bold text-ink-dim text-sm">{score.team_tricks}</td>
                                            <td className="p-3 text-right font-bold text-purple-600 text-sm">{score.individual_tricks}</td>
                                            <td className="p-3 text-right font-black text-brand text-sm">{winPct}%</td>
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
