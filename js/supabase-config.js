/* ============================================================
   SUPABASE CONFIG — New API Key Format (2024+)
   Uses: Publishable key (sb_publishable_...) — NOT legacy anon JWT
   ============================================================ */

// ⚠️ REPLACE THESE TWO VALUES
const SUPABASE_URL = 'https://feimrdohogrraspqpzmk.supabase.co';
//                    ↑ get from Settings → Data API → Project URL

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fFa1X3qXxJ2osovGD6R1Tg_shdtXzwx';
//                               ↑ your publishable key from the screenshot

let supabaseClient = null;

async function initSupabase() {
    if (supabaseClient) return supabaseClient;

    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

    // New API: the publishable key goes in the second argument
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
window.SupabaseAuth = {
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

// ── Secrets Vault (RLS-protected) ────────────────────────────
window.SupabaseSecrets = {
    async get(key) {
        const client = await initSupabase();
        const { data, error } = await client
            .from('secrets')
            .select('value')
            .eq('key', key)
            .single();
        if (error) throw error;
        return data.value;
    },

    async set(key, value) {
        const client = await initSupabase();
        const { error } = await client
            .from('secrets')
            .upsert(
                { key, value, updated_at: new Date().toISOString() },
                { onConflict: 'key' }
            );
        if (error) throw error;
    },

    async list() {
        const client = await initSupabase();
        const { data, error } = await client.from('secrets').select('key');
        if (error) throw error;
        return data.map(r => r.key);
    }
};

window.initSupabase = initSupabase;
