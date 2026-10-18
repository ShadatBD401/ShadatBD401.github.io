/* ============================================================
   GITHUB CONTENT API
   Edits text JSON files directly in your GitHub repo
   ============================================================ */

const GitHubContent = {
    owner: null,
    repo: null,
    branch: 'main',
    token: null,
    apiBase: 'https://api.github.com',
    _inited: false,

    async init(force = false) {
        if (this._inited && !force) return true;
        if (!window.SupabaseSecrets) throw new Error('SupabaseSecrets not loaded');
        try {
            this.token  = await window.SupabaseSecrets.get('github_token');
            this.owner  = await window.SupabaseSecrets.get('github_owner');
            this.repo   = await window.SupabaseSecrets.get('github_repo');
            this.branch = await window.SupabaseSecrets.get('github_branch');
            this._inited = true;
            return true;
        } catch (err) {
            console.error('GitHub init failed:', err);
            return false;
        }
    },

    async _request(method, path, body = null) {
        if (!this._inited) await this.init();
        const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${path}`;
        const headers = {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28'
        };
        if (body) headers['Content-Type'] = 'application/json';

        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);

        const res = await fetch(url, opts);
        if (res.status === 404) return null;
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`GitHub ${res.status}: ${text}`);
        }
        return res.json();
    },

    async read(path) {
        const data = await this._request('GET', `${path}?ref=${this.branch}`);
        if (!data) return null;
        const clean = data.content.replace(/\n/g, '');
        const decoded = decodeURIComponent(escape(atob(clean)));
        return { json: JSON.parse(decoded), sha: data.sha };
    },

    async write(path, content, message = 'Update content') {
        let sha = null;
        try {
            const existing = await this.read(path);
            if (existing) sha = existing.sha;
        } catch (e) { /* new file */ }

        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
        const body = {
            message,
            content: encoded,
            branch: this.branch
        };
        if (sha) body.sha = sha;

        return this._request('PUT', path, body);
    },
   
    async delete(path, message = 'Delete content') {
        const existing = await this.read(path);
        if (!existing) return null;
        return this._request('DELETE', path, {
            message, sha: existing.sha, branch: this.branch
        });
    }
};

// ── High-level site content API ──────────────────────────────
const SiteContent = {
    PATH: 'data/site-content.json',

    async load() {
        try {
            const data = await GitHubContent.read(this.PATH);
            if (data) return data.json;
        } catch (err) { console.warn('No GitHub content yet, using defaults'); }
        return this.getDefaults();
    },

    async save(content, message = 'Update site content') {
        return GitHubContent.write(this.PATH, content, message);
    },

    getDefaults() {
        return {
            home: {
                badge: 'Available for opportunities',
                title: 'Building resilient infrastructure. Thinking like a defender.',
                description: 'Network & System Administration professional...'
            },
            about: { title: 'About Me', subtitle: 'A systems-first technical profile' },
            experience: [],
            skills: [],
            projects: [],
            certifications: [],
            education: [],
            posts: [],
            contact: {
                email: 'sahadat.bda35@gmail.com',
                phone: '+880 1575 382663',
                location: 'Tejgaon, Dhaka 1215, Bangladesh'
            }
        };
    }
};

window.GitHubContent = GitHubContent;
window.SiteContent = SiteContent;
console.log('[OK] github-content.js loaded');
