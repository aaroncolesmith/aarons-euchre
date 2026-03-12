import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof (import.meta as any).env !== 'undefined')
    ? (import.meta as any).env.VITE_SUPABASE_URL
    : (typeof (globalThis as any).Deno !== 'undefined' ? (globalThis as any).Deno.env.get('SUPABASE_URL') : null);

const supabaseAnonKey = (typeof (import.meta as any).env !== 'undefined')
    ? (import.meta as any).env.VITE_SUPABASE_ANON_KEY
    : (typeof (globalThis as any).Deno !== 'undefined' ? (globalThis as any).Deno.env.get('SUPABASE_ANON_KEY') : null);

if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof (globalThis as any).Deno === 'undefined') {
        console.warn('Supabase credentials missing. Multiplayer sync will be disabled.');
    }
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);
