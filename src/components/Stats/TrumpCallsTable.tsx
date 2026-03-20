import { useState, useEffect } from 'react';
import { TrumpCallLog } from '../../utils/trumpCallLogger';
import { getAllTrumpCalls } from '../../utils/supabaseStats';

export const TrumpCallsTable = () => {
    const [calls, setCalls] = useState<TrumpCallLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'All' | 'Bot' | 'Human'>('All');
    const [sort, setSort] = useState<{ field: keyof TrumpCallLog, desc: boolean }>({ field: 'timestamp', desc: true });

    useEffect(() => {
        setIsLoading(true);
        getAllTrumpCalls().then((data: TrumpCallLog[]) => {
            setCalls(data);
            setIsLoading(false);
        });
    }, []);

    const handleSort = (field: keyof TrumpCallLog) => {
        if (sort.field === field) {
            setSort({ field, desc: !sort.desc });
        } else {
            setSort({ field, desc: true });
        }
    };

    const filtered = calls.filter(c => filter === 'All' || c.userType === filter);

    const playerStrengthAverages = Object.values(
        filtered.reduce((acc, call) => {
            if (!acc[call.whoCalled]) {
                acc[call.whoCalled] = {
                    player: call.whoCalled,
                    calls: 0,
                    upcardTotal: 0,
                    bestSuitTotal: 0,
                };
            }

            acc[call.whoCalled].calls += 1;
            acc[call.whoCalled].upcardTotal += call.handStrengthUpcard || 0;
            acc[call.whoCalled].bestSuitTotal += call.handStrengthBestSuit || 0;
            return acc;
        }, {} as Record<string, { player: string; calls: number; upcardTotal: number; bestSuitTotal: number }>)
    ).sort((a, b) => (b.upcardTotal / b.calls) - (a.upcardTotal / a.calls));
    
    const sorted = [...filtered].sort((a, b) => {
        const aVal = a[sort.field] ?? '';
        const bVal = b[sort.field] ?? '';
        if (aVal < bVal) return sort.desc ? 1 : -1;
        if (aVal > bVal) return sort.desc ? -1 : 1;
        return 0;
    });

    const exportCSV = () => {
        if (sorted.length === 0) return;
        
        const headers = ['Date', 'Player', 'Type', 'Dealer/Rel', 'Card Picked', 'Suit', 'Bowers', 'Trump', 'Suits', 'HS Upcard', 'HS Best', 'Hand'];
        const rows = sorted.map(c => [
            new Date(c.timestamp).toLocaleString(),
            c.whoCalled,
            c.userType,
            c.dealer,
            c.cardPickedUp,
            c.suitCalled,
            c.bowerCount,
            c.trumpCount,
            c.suitCount,
            (c.handStrengthUpcard || 0).toFixed(1),
            (c.handStrengthBestSuit || 0).toFixed(1),
            `"${c.handAfterDiscard}"` // Quote to handle commas
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `euchre_trump_calls_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-brand">Loading Analytics...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500">
            {playerStrengthAverages.length > 0 && (
                <div className="bg-paper-dim rounded-2xl border-2 border-slate-200 p-4 shadow-sm">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Average Called Hand Strength By Player</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {playerStrengthAverages.map((entry) => (
                            <div key={entry.player} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                                <div className="font-black text-slate-800">{entry.player}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{entry.calls} calls</div>
                                <div className="mt-2 text-sm font-bold text-emerald-700">Upcard Avg: {(entry.upcardTotal / entry.calls).toFixed(1)}</div>
                                <div className="text-sm font-bold text-cyan-700">Best Suit Avg: {(entry.bestSuitTotal / entry.calls).toFixed(1)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center">
                <div className="flex gap-2">
                    {['All', 'Bot', 'Human'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-3 py-1 text-xs font-black uppercase tracking-widest rounded-lg border-2 transition-all ${filter === f ? 'bg-brand text-white border-brand' : 'text-slate-500 border-slate-200 hover:border-brand/50'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
                <button
                    onClick={exportCSV}
                    className="px-4 py-2 text-xs font-black uppercase tracking-widest bg-slate-800 text-white rounded-xl shadow-sm hover:bg-slate-700 transition-colors"
                >
                    Export CSV
                </button>
            </div>

            <div className="bg-paper-dim rounded-2xl border-2 border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-slate-100">
                        <tr className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200">
                            <th className="py-3 px-4 cursor-pointer hover:text-brand" onClick={() => handleSort('timestamp')}>Date {sort.field === 'timestamp' && (sort.desc ? '↓' : '↑')}</th>
                            <th className="py-3 px-4 cursor-pointer hover:text-brand" onClick={() => handleSort('whoCalled')}>Player {sort.field === 'whoCalled' && (sort.desc ? '↓' : '↑')}</th>
                            <th className="py-3 px-4 text-center cursor-pointer hover:text-brand" onClick={() => handleSort('userType')}>Type {sort.field === 'userType' && (sort.desc ? '↓' : '↑')}</th>
                            <th className="py-3 px-4 text-center cursor-pointer hover:text-brand" onClick={() => handleSort('cardPickedUp')}>Picked {sort.field === 'cardPickedUp' && (sort.desc ? '↓' : '↑')}</th>
                            <th className="py-3 px-4 text-center cursor-pointer hover:text-brand" onClick={() => handleSort('suitCalled')}>Suit {sort.field === 'suitCalled' && (sort.desc ? '↓' : '↑')}</th>
                            <th className="py-3 px-4 text-center cursor-pointer hover:text-brand" title="Bower Count" onClick={() => handleSort('bowerCount')}>B {sort.field === 'bowerCount' && (sort.desc ? '↓' : '↑')}</th>
                            <th className="py-3 px-4 text-center cursor-pointer hover:text-brand" title="Trump Count" onClick={() => handleSort('trumpCount')}>T {sort.field === 'trumpCount' && (sort.desc ? '↓' : '↑')}</th>
                            <th className="py-3 px-4 text-center cursor-pointer hover:text-brand" title="Unique Suits" onClick={() => handleSort('suitCount')}>S {sort.field === 'suitCount' && (sort.desc ? '↓' : '↑')}</th>
                            <th className="py-3 px-4 text-center cursor-pointer hover:text-brand" title="Hand Strength vs Upcard Suit" onClick={() => handleSort('handStrengthUpcard')}>HS-U {sort.field === 'handStrengthUpcard' && (sort.desc ? '↓' : '↑')}</th>
                            <th className="py-3 px-4 text-center cursor-pointer hover:text-brand" title="Best Available Hand Strength" onClick={() => handleSort('handStrengthBestSuit')}>HS-B {sort.field === 'handStrengthBestSuit' && (sort.desc ? '↓' : '↑')}</th>
                            <th className="py-3 px-4">Hand After Discard</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {sorted.length === 0 ? (
                            <tr><td colSpan={11} className="py-8 text-center text-slate-400 font-bold italic">No trump calls found.</td></tr>
                        ) : sorted.map((c, i) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-4 text-xs font-mono text-slate-500">{new Date(c.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="py-3 px-4 font-bold text-slate-800">{c.whoCalled}</td>
                                <td className="py-3 px-4 text-center">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${c.userType === 'Bot' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {c.userType}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center font-black">
                                    <span className={['H', 'D'].some(s => c.cardPickedUp.includes(s)) ? 'text-red-500' : 'text-slate-800'}>
                                        {c.cardPickedUp}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center font-black capitalize">
                                    <span className={['Hearts', 'Diamonds'].includes(c.suitCalled) ? 'text-red-500' : 'text-slate-800'}>
                                        {c.suitCalled}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-center font-black text-emerald-600">{c.bowerCount}</td>
                                <td className="py-3 px-4 text-center font-black text-cyan-600">{c.trumpCount}</td>
                                <td className="py-3 px-4 text-center font-black text-amber-600">{c.suitCount}</td>
                                <td className="py-3 px-4 text-center font-black text-violet-700">{(c.handStrengthUpcard || 0).toFixed(1)}</td>
                                <td className="py-3 px-4 text-center font-black text-sky-700">{(c.handStrengthBestSuit || 0).toFixed(1)}</td>
                                <td className="py-3 px-4 font-hand font-black text-sm tracking-wide text-slate-700 whitespace-nowrap">{c.handAfterDiscard}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {sorted.length > 50 && (
                <div className="text-center text-xs font-bold text-slate-400 mt-2">
                    Showing top {sorted.length} calls
                </div>
            )}
        </div>
    );
};
