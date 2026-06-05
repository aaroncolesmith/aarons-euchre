import React, { useState } from 'react';
import { useGame } from '../../store/GameStore';

const NAME_REGEX = /^[a-zA-Z0-9 \-]+$/;

export const LoginPage = () => {
    const { dispatch } = useGame();
    const [name, setName] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();

        if (trimmed.length < 2) {
            setError('Name must be at least 2 characters.');
            return;
        }
        if (trimmed.length > 20) {
            setError('Name must be 20 characters or fewer.');
            return;
        }
        if (!NAME_REGEX.test(trimmed)) {
            setError('Only letters, numbers, spaces, and hyphens allowed.');
            return;
        }

        dispatch({ type: 'LOGIN', payload: { userName: trimmed } });
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full max-w-lg mx-auto p-8 animate-in fade-in zoom-in duration-700">
            <h1 className="text-7xl font-black text-ink italic leading-none mb-16 tracking-widest uppercase transform -rotate-2">
                EUCHRE
            </h1>

            <div className="w-full bg-paper p-10 rounded-[2rem] border-2 border-ink shadow-sketch-ink transform rotate-1">
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(''); }}
                            className="w-full bg-paper border-2 border-ink rounded-2xl px-8 py-5 text-xl font-black text-ink focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all placeholder:text-ink-dim uppercase shadow-[4px_4px_0px_0px_#cbd5e1]"
                            placeholder="Enter Username"
                            maxLength={20}
                        />
                        {error && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest ml-4 mt-2">Error: {error}</p>}
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-brand-dim text-ink font-black py-6 rounded-2xl text-xl border-2 border-slate-900 shadow-sketch-ink active:shadow-none active:translate-x-[6px] active:translate-y-[6px] transition-all hover:-translate-y-1 hover:shadow-sketch-ink uppercase tracking-widest"
                    >
                        PLAY
                    </button>
                </form>
            </div>
        </div>
    );
};
