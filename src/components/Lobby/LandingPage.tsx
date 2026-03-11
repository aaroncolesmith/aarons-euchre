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
                onClick={() => dispatch({ type: 'LOGOUT' })}
                className="mt-16 text-[10px] font-black uppercase tracking-[0.3em] text-ink-dim hover:text-red-500 transition-colors"
            >
                Log out
            </button>
        </div>
    );
};
