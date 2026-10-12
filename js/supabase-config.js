/* ============================================================
   SUPABASE CONFIG — New API Key Format
   ============================================================ */

const SUPABASE_URL = 'https://feimrdohogrraspqpzmk.supabase.co';        // ← REPLACE
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fFa1X3qXxJ2osovGD6R1Tg_shdtXzwx';

let supabaseClient = null;

async function initSupabase() {
    if (supabaseClient) return supabaseClient;

    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

    supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            storageKey: 'sh_supabase_auth',
            detectSessionInUrl: true
        }
    });

    return supabaseClient;
}

// ── Authentication ───────────────────────────────────────────
const SupabaseAuth = {
    async signIn(email, password) {
        const client = await initSupabase();
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },
    async signOut() {
        const client = await initSupabase();
        return client.auth.signOut();
    },
    async getUser() {
        const client = await initSupabase();
        const { data: { user } } = await client.auth.getUser();
        return user;
    },
    async getSession() {
        const client = await initSupabase();
        const { data: { session } } = await client.auth.getSession();
        return session;
    },
    onAuthChange(callback) {
        initSupabase().then(client => {
            client.auth.onAuthStateChange((_event, session) => callback(session));
        });
    }
};

// ── Secrets Vault ────────────────────────────────────────────
const SupabaseSecrets = {
    async get(key) {
        const client = await initSupabase();
        const { data, error } = await client
            .from('secrets').select('value').eq('key', key).single();
        if (error) throw error;
        return data.value;
    },
    async set(key, value) {
        const client = await initSupabase();
        const { error } = await client
            .from('secrets')
            .upsert({ key, value, updated_at: new Date().toISOString() },
                    { onConflict: 'key' });
        if (error) throw error;
    },
    async list() {
        const client = await initSupabase();
        const { data, error } = await client.from('secrets').select('key');
        if (error) throw error;
        return data.map(r => r.key);
    }
};

// ── Expose to window (needed for admin.js and inline console) ─
window.initSupabase = initSupabase;
window.SupabaseAuth = SupabaseAuth;
window.SupabaseSecrets = SupabaseSecrets;
