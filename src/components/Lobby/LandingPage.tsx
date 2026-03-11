import { useState } from 'react';
import { useGame } from '../../store/GameStore';

export const LandingPage = () => {
    const { dispatch } = useGame();
    const [tableCode, setTableCode] = useState('');
    const [view, setView] = useState<'options' | 'join'>('options');

    if (view === 'join') {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full max-w-lg mx-auto p-8 animate-in slide-in-from-right-12 duration-500">
                <button
                    onClick={() => setView('options')}
                    className="self-start mb-8 text-[10px] font-black uppercase tracking-widest text-ink-dim hover:text-ink flex items-center gap-2"
                >
                    ← Back
                </button>
                <div className="w-full bg-paper p-10 rounded-[2rem] border-2 border-ink shadow-sketch-ink">
                    <h2 className="text-3xl font-black mb-8 uppercase tracking-tighter italic">Join a Table</h2>
                    <div className="space-y-6">
                        <input
                            autoFocus
                            value={tableCode}
                            onChange={(e) => setTableCode(e.target.value.toUpperCase())}
                            className="w-full bg-paper border-2 border-ink rounded-2xl px-6 py-4 text-2xl font-black text-ink uppercase tracking-[0.3em] text-center"
                            placeholder="CODE"
                            maxLength={8}
                        />
                        <button
                            onClick={() => tableCode && dispatch({ type: 'JOIN_TABLE', payload: { code: tableCode, userName: '' } })} // UserName is preserved in GameStore
                            disabled={!tableCode}
                            className="w-full bg-brand text-white font-black py-5 rounded-2xl text-xl border-2 border-ink shadow-sketch-brand hover:-translate-y-1 hover:shadow-sketch-brand transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 uppercase tracking-widest"
                        >
                            Connect
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto p-8 animate-in fade-in duration-700">
            <h1 className="text-8xl font-black text-ink italic leading-none mb-4 tracking-tighter uppercase transform -rotate-1">
                EUCHRE
            </h1>
            <p className="text-sm font-black text-brand uppercase tracking-[0.5em] mb-16">The Game of Jacks</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                <button
                    onClick={() => dispatch({ type: 'CREATE_TABLE', payload: { userName: '' } })}
                    className="group bg-paper p-10 rounded-[2rem] border-2 border-ink shadow-sketch-ink hover:-translate-y-2 hover:shadow-sketch-brand transition-all text-left flex flex-col justify-between h-64"
                >
                    <div className="text-xs font-black uppercase tracking-[0.3em] text-brand-dim mb-4">Host New Game</div>
                    <div>
                        <div className="text-3xl font-black uppercase mb-2 group-hover:text-brand transition-colors">Create Table</div>
                        <div className="text-xs text-ink-dim font-bold uppercase tracking-wide">Start a fresh match with friends or bots.</div>
                    </div>
                </button>

                <button
                    onClick={() => setView('join')}
                    className="group bg-paper p-10 rounded-[2rem] border-2 border-ink shadow-sketch-ink hover:-translate-y-2 hover:shadow-sketch-brand transition-all text-left flex flex-col justify-between h-64"
                >
                    <div className="text-xs font-black uppercase tracking-[0.3em] text-cyan-600 mb-4">Multiplayer</div>
                    <div>
                        <div className="text-3xl font-black uppercase mb-2 group-hover:text-cyan-600 transition-colors">Join Table</div>
                        <div className="text-xs text-ink-dim font-bold uppercase tracking-wide">Enter a table code to play with others.</div>
                    </div>
                </button>
            </div>

            <button
                onClick={() => {
                    const dateString = new Date().toISOString().split('T')[0];
                    dispatch({ type: 'START_DAILY_CHALLENGE', payload: { userName: '', dateString } });
                }}
                className="group mt-8 w-full max-w-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-8 rounded-[2rem] border-2 border-ink shadow-sketch-ink hover:-translate-y-2 hover:shadow-[4px_4px_0px_0px_rgba(251,191,36,0.5)] transition-all text-center flex flex-col justify-center overflow-hidden relative"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200 rounded-full blur-3xl opacity-30 transform translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-700"></div>
                <div className="relative z-10 text-xs font-black uppercase tracking-[0.3em] text-white/80 mb-2">Daily Leaderboard</div>
                <div className="relative z-10 text-4xl font-black uppercase text-white mb-2 group-hover:scale-105 transition-transform">Hand of the Day</div>
                <div className="relative z-10 text-xs text-white/90 font-bold uppercase tracking-wide">Play today's exact seeded game and compete globally.</div>
            </button>

            <button
                onClick={() => dispatch({ type: 'LOGOUT' })}
                className="mt-16 text-[10px] font-black uppercase tracking-[0.3em] text-ink-dim hover:text-red-500 transition-colors"
            >
                Log out
            </button>
        </div>
    );
};
