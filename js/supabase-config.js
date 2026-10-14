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

// ── Tickets (Supabase-backed) ─────────────────────────────────
window.SupabaseTickets = {
    async create(ticket) {
        const client = await initSupabase();
        const row = {
            ticket_id: ticket.id,
            name:      ticket.name,
            email:     ticket.email,
            subject:   ticket.subject,
            message:   ticket.message,
            status:    ticket.status   || 'open',
            priority:  ticket.priority || 'medium',
            category:  ticket.category || 'general'
        };
        console.log('📤 Inserting ticket to Supabase:', row);
        const { data, error } = await client
            .from('tickets').insert(row).select().single();

        if (error) {
            console.error('❌ Supabase insert error:', {
                message: error.message,
                details: error.details,
                hint:    error.hint,
                code:    error.code
            });
            throw error;
        }
        console.log('✅ Ticket inserted:', data);
        return data;
    },
   
    async findByTicketId(ticketId) {
        const client = await initSupabase();
        // Use the RPC function so anonymous visitors can query by exact ID
        const { data, error } = await client
            .rpc('lookup_ticket', { p_ticket_id: ticketId.toUpperCase() });

        if (error) {
            console.error('RPC lookup failed:', error);
            throw error;
        }
        // RPC returns array; return first row or null
        return Array.isArray(data) ? (data[0] || null) : (data || null);
    },
 
    async listAll() {
        const client = await initSupabase();
        const { data, error } = await client
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async updateStatus(ticketId, status, note = '') {
        const client = await initSupabase();
        const { data, error } = await client
            .from('tickets')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('ticket_id', ticketId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async addReply(ticketId, message, isAdmin = false) {
        const client = await initSupabase();
        const { data: current, error: readErr } = await client
            .from('tickets')
            .select('replies')
            .eq('ticket_id', ticketId)
            .single();
        if (readErr) throw readErr;

        const replies = current.replies || [];
        replies.push({
            id: Date.now().toString(36),
            message,
            isAdmin,
            timestamp: new Date().toISOString()
        });

        const { data, error } = await client
            .from('tickets')
            .update({ replies, updated_at: new Date().toISOString() })
            .eq('ticket_id', ticketId)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
};


// ── Expose to window (needed for admin.js and inline console) ─
window.initSupabase = initSupabase;
window.SupabaseAuth = SupabaseAuth;
window.SupabaseSecrets = SupabaseSecrets;
