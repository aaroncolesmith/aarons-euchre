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
    created_at: string;
}

export const DailyLeaderboard = () => {
    const [scores, setScores] = useState<DailyScore[]>([]);
    const [loading, setLoading] = useState(true);
    const dateString = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const fetchScores = async () => {
            const data = await getDailyLeaderboard(dateString);
            setScores(data as DailyScore[]);
            setLoading(false);
        };
        fetchScores();
    }, [dateString]);

    if (loading) {
        return <div className="p-8 text-center text-ink-dim animate-pulse font-bold tracking-widest uppercase">Loading today's champions...</div>;
    }

    if (scores.length === 0) {
        return (
            <div className="p-12 text-center text-ink-dim font-bold tracking-widest uppercase italic">
                No scores submitted for today ({dateString}) yet. Be the first!
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="text-center mb-8">
                <h3 className="text-2xl font-black uppercase tracking-widest text-brand">Hand of the Day</h3>
                <div className="text-sm font-bold text-ink-dim uppercase tracking-wider">{dateString}</div>
            </div>

            <div className="bg-paper border-2 border-ink rounded-xl overflow-hidden shadow-sketch-ink">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b-2 border-ink bg-ink/5">
                            <th className="p-4 indent-2 text-xs font-black uppercase tracking-widest text-ink flex items-center gap-2">Rank</th>
                            <th className="p-4 text-xs font-black uppercase tracking-widest text-ink">Player</th>
                            <th className="p-4 text-xs font-black text-right uppercase tracking-widest text-ink">Team Pts</th>
                            <th className="p-4 text-xs font-black text-right uppercase tracking-widest text-ink">Team Tricks</th>
                            <th className="p-4 text-xs font-black text-right uppercase tracking-widest text-ink">Your Tricks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scores.map((score, index) => (
                            <tr key={score.id} className="border-b border-ink/20 hover:bg-ink/5 transition-colors">
                                <td className="p-4 font-bold text-ink flex items-center gap-3">
                                    {index === 0 && <Trophy className="w-5 h-5 text-amber-500" />}
                                    {index === 1 && <Medal className="w-5 h-5 text-gray-400" />}
                                    {index === 2 && <Medal className="w-5 h-5 text-amber-700" />}
                                    {index > 2 && <span className="w-5 inline-block text-center text-ink-dim">#{index + 1}</span>}
                                </td>
                                <td className="p-4 font-black text-ink uppercase tracking-wider">{score.player_name}</td>
                                <td className="p-4 text-right font-black text-brand text-lg">{score.team_points}</td>
                                <td className="p-4 text-right font-bold text-ink-dim">{score.team_tricks}</td>
                                <td className="p-4 text-right font-bold text-ink-dim">{score.individual_tricks}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
