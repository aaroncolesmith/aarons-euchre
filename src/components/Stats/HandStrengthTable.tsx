import { useEffect, useState } from 'react';
import { getAllTrumpCalls } from '../../utils/supabaseStats';
import { TrumpCallLog } from '../../utils/trumpCallLogger';

type StrengthSummary = {
    player: string;
    avgUpcard: string;
    avgBestSuit: string;
    avgCalledTrump: string;
    avgStuck: string;
    avgLoner: string;
};

function formatAverage(values: number[]): string {
    if (values.length === 0) return 'n/a';
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return avg.toFixed(1);
}

function isStuckCall(call: TrumpCallLog): boolean {
    return (call.round || 0) === 2 && call.dealer.startsWith('Self - ');
}

export const HandStrengthTable = () => {
    const [rows, setRows] = useState<StrengthSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            const calls: TrumpCallLog[] = await getAllTrumpCalls();

            const grouped = new Map<string, TrumpCallLog[]>();
            calls.forEach((call) => {
                const existing = grouped.get(call.whoCalled) || [];
                existing.push(call);
                grouped.set(call.whoCalled, existing);
            });

            const summaries = Array.from(grouped.entries())
                .map(([player, playerCalls]) => ({
                    player,
                    avgUpcard: formatAverage(playerCalls.map((call) => call.handStrengthUpcard || 0)),
                    avgBestSuit: formatAverage(playerCalls.map((call) => call.handStrengthBestSuit || 0)),
                    avgCalledTrump: formatAverage(playerCalls.map((call) => call.handStrengthCalledTrump || 0)),
                    avgStuck: formatAverage(playerCalls.filter(isStuckCall).map((call) => call.handStrengthCalledTrump || 0)),
                    avgLoner: formatAverage(playerCalls.filter((call) => call.isLoner).map((call) => call.handStrengthCalledTrump || 0)),
                }))
                .sort((a, b) => a.player.localeCompare(b.player));

            setRows(summaries);
            setIsLoading(false);
        };

        load();
    }, []);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-brand">Loading Hand Strength...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-paper-dim rounded-2xl border-2 border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[980px]">
                    <thead className="bg-slate-100">
                        <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200">
                            <th className="py-3 px-4">Player</th>
                            <th className="py-3 px-4 text-center">Avg Hand Strength (Upcard)</th>
                            <th className="py-3 px-4 text-center">Avg Hand Strength (Best Suit)</th>
                            <th className="py-3 px-4 text-center">Avg Hand Strength (Called Trump)</th>
                            <th className="py-3 px-4 text-center">Avg Hand Strength (Stuck)</th>
                            <th className="py-3 px-4 text-center">Avg Hand Strength (Loner)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-slate-400 font-bold italic">
                                    No hand strength data found.
                                </td>
                            </tr>
                        ) : rows.map((row) => (
                            <tr key={row.player} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-800">{row.player}</td>
                                <td className="py-3 px-4 text-center font-black text-violet-700">{row.avgUpcard}</td>
                                <td className="py-3 px-4 text-center font-black text-sky-700">{row.avgBestSuit}</td>
                                <td className="py-3 px-4 text-center font-black text-emerald-700">{row.avgCalledTrump}</td>
                                <td className="py-3 px-4 text-center font-black text-amber-700">{row.avgStuck}</td>
                                <td className="py-3 px-4 text-center font-black text-pink-700">{row.avgLoner}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
