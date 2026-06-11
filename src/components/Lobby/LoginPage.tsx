import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

const NAME_REGEX = /^[a-zA-Z0-9 \-]+$/;

function usernameToEmail(username: string): string {
    return `${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}@players.euchre.app`;
}

export const LoginPage = () => {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();

        if (trimmed.length < 2) { setError('Name must be at least 2 characters.'); return; }
        if (trimmed.length > 20) { setError('Name must be 20 characters or fewer.'); return; }
        if (!NAME_REGEX.test(trimmed)) { setError('Only letters, numbers, spaces, and hyphens allowed.'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

        setLoading(true);
        setError('');

        const email = usernameToEmail(trimmed);

        // Try sign in first
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

        if (!signInError) {
            // onAuthStateChange in GameStore dispatches LOGIN — nothing else needed here
            setLoading(false);
            return;
        }

        // Wrong credentials → maybe a new account; try sign up
        if (signInError.message.toLowerCase().includes('invalid login credentials')) {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { username: trimmed } },
            });

            if (!signUpError) {
                setLoading(false);
                return;
            }

            setError(
                signUpError.message.toLowerCase().includes('already registered')
                    ? 'Wrong password. Try again.'
                    : signUpError.message
            );
        } else {
            setError(signInError.message);
        }

        setLoading(false);
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full max-w-lg mx-auto p-8 animate-in fade-in zoom-in duration-700">
            <h1 className="text-7xl font-black text-ink italic leading-none mb-16 tracking-widest uppercase transform -rotate-2">
                EUCHRE
            </h1>

            <div className="w-full bg-paper p-10 rounded-[2rem] border-2 border-ink shadow-sketch-ink transform rotate-1">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => { setName(e.target.value); setError(''); }}
                        className="w-full bg-paper border-2 border-ink rounded-2xl px-8 py-5 text-xl font-black text-ink focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all placeholder:text-ink-dim uppercase shadow-[4px_4px_0px_0px_#cbd5e1]"
                        placeholder="Username"
                        maxLength={20}
                        autoComplete="username"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        className="w-full bg-paper border-2 border-ink rounded-2xl px-8 py-5 text-xl font-black text-ink focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all placeholder:text-ink-dim shadow-[4px_4px_0px_0px_#cbd5e1]"
                        placeholder="Password"
                        autoComplete="current-password"
                    />
                    {error && (
                        <p className="text-red-500 text-[10px] font-black uppercase tracking-widest ml-4">
                            {error}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-brand-dim text-ink font-black py-6 rounded-2xl text-xl border-2 border-slate-900 shadow-sketch-ink active:shadow-none active:translate-x-[6px] active:translate-y-[6px] transition-all hover:-translate-y-1 hover:shadow-sketch-ink uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {loading ? 'ONE SEC...' : 'PLAY'}
                    </button>
                    <p className="text-center text-ink-dim text-[10px] font-black uppercase tracking-widest pt-1">
                        New here? Enter a name + password to create your account.
                    </p>
                </form>
            </div>
        </div>
    );
};
