import React from 'react';
import { PlayerStats } from '../../types/game';
import { Trophy, Medal, Users } from 'lucide-react';

interface LeagueTableProps {
    allStats: { [name: string]: PlayerStats };
}

export const LeagueTable: React.FC<LeagueTableProps> = ({ allStats }) => {
    const sortedPlayers = Object.entries(allStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => {
            // Sort by win rate if games played > 0, otherwise by games played
            const winRateA = a.handsPlayed > 0 ? a.handsWon / a.handsPlayed : 0;
            const winRateB = b.handsPlayed > 0 ? b.handsWon / b.handsPlayed : 0;
            
            if (winRateA !== winRateB) return winRateB - winRateA;
            return b.handsPlayed - a.handsPlayed;
        });

    return (
        <div className="space-y-4 font-hand">
            <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-brand" />
                <h3 className="text-2xl font-black uppercase tracking-widest text-brand">Global League standings</h3>
            </div>

            <div className="bg-paper border-2 border-ink rounded-xl overflow-hidden shadow-sketch-ink overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="border-b-2 border-ink bg-ink/5">
                            <th className="p-3 text-[10px] font-black uppercase tracking-widest text-ink text-center">Rnk</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-widest text-ink">Player</th>
                            <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Hands</th>
                            <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Win %</th>
                            <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Pts/Hand</th>
                            <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Loner Win</th>
                            <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink">Calls Won</th>
                            <th className="p-3 text-[10px] font-black text-right uppercase tracking-widest text-ink text-brand">Sweeps</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedPlayers.map((player, index) => {
                            const winPct = player.handsPlayed > 0 ? Math.round((player.handsWon / player.handsPlayed) * 100) : 0;
                            const ptsPerHand = player.handsPlayed > 0 ? (player.pointsScored / player.handsPlayed).toFixed(1) : '0';
                            const callWinPct = player.callsMade > 0 ? Math.round((player.callsWon / player.callsMade) * 100) : 0;

                            return (
                                <tr key={player.name} className="border-b border-ink/20 hover:bg-ink/5 transition-colors">
                                    <td className="p-3 font-bold text-ink flex justify-center">
                                        {index === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
                                        {index === 1 && <Medal className="w-4 h-4 text-gray-400" />}
                                        {index === 2 && <Medal className="w-4 h-4 text-amber-700" />}
                                        {index > 2 && <span className="text-ink-dim text-xs">#{index + 1}</span>}
                                    </td>
                                    <td className="p-3 font-black text-ink uppercase tracking-wider text-xs">{player.name}</td>
                                    <td className="p-3 text-right font-bold text-ink text-sm">{player.handsPlayed}</td>
                                    <td className={`p-3 text-right font-black text-sm ${winPct >= 50 ? 'text-brand' : 'text-red-500'}`}>{winPct}%</td>
                                    <td className="p-3 text-right font-bold text-ink-dim text-sm">{ptsPerHand}</td>
                                    <td className="p-3 text-right font-bold text-amber-600 text-sm">{player.lonersWon}</td>
                                    <td className="p-3 text-right font-bold text-cyan-600 text-sm">{callWinPct}%</td>
                                    <td className="p-3 text-right font-black text-brand text-sm">{player.sweeps}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
