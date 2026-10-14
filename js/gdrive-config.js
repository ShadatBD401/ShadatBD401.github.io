/* ============================================================
   GOOGLE DRIVE CONFIG
   Media storage: images, PDFs, docs, videos, animations
   ============================================================ */

const GDrive = {
    clientId: null,
    apiKey: null,
    folders: {},
    accessToken: null,
    tokenExpiry: 0,
    _inited: false,

    async init(force = false) {
        if (this._inited && !force) return this;
        if (!window.SupabaseSecrets) throw new Error('SupabaseSecrets not loaded');

        this.clientId = await window.SupabaseSecrets.get('gdrive_client_id');
        this.apiKey   = await window.SupabaseSecrets.get('gdrive_api_key').catch(() => null);

        this.folders = {
            root:    await window.SupabaseSecrets.get('gdrive_folder_root').catch(() => null),
            profile: await window.SupabaseSecrets.get('gdrive_folder_profile').catch(() => null),
            cv:      await window.SupabaseSecrets.get('gdrive_folder_cv').catch(() => null),
            gallery: await window.SupabaseSecrets.get('gdrive_folder_gallery').catch(() => null),
            videos:  await window.SupabaseSecrets.get('gdrive_folder_videos').catch(() => null),
            blog:    await window.SupabaseSecrets.get('gdrive_folder_blog').catch(() => null)
        };
        this._inited = true;
        return this;
    },

    async _loadGis() {
        if (window.google?.accounts?.oauth2) return;
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://accounts.google.com/gsi/client';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    },

    async signIn() {
        // First, try to restore saved token from sessionStorage
        const saved = sessionStorage.getItem('gdrive_access_token');
        const savedExp = parseInt(sessionStorage.getItem('gdrive_token_expiry') || '0');
        if (saved && Date.now() < savedExp - 60000) {
            this.accessToken = saved;
            this.tokenExpiry = savedExp;
            console.log('✅ Restored Drive token from session');
            return { restored: true };
        }

        // Otherwise trigger OAuth
        await this.init();
        await this._loadGis();

        return new Promise((resolve, reject) => {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: this.clientId,
                scope: [
                    'https://www.googleapis.com/auth/drive.file',
                    'https://www.googleapis.com/auth/drive.readonly'
                ].join(' '),
                callback: (resp) => {
                    if (resp.error) return reject(resp);
                    this.accessToken = resp.access_token;
                    this.tokenExpiry = Date.now() + (resp.expires_in * 1000);

                    // Persist to sessionStorage so it survives reloads in the same tab
                    sessionStorage.setItem('gdrive_access_token', this.accessToken);
                    sessionStorage.setItem('gdrive_token_expiry', String(this.tokenExpiry));

                    resolve(resp);
                }
            });
            client.requestAccessToken({ prompt: 'consent' });
        });
    },

    async ensureToken() {
        if (this.accessToken && Date.now() < this.tokenExpiry - 60000) return;
        await this.signIn();
    },

    async upload(file, folderKey = 'gallery') {
        await this.ensureToken();
        if (!this.folders[folderKey]) await this.init(true);
        if (!this.folders[folderKey]) throw new Error(`Unknown folder key: ${folderKey}`);

        const metadata = {
            name: `${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`,
            parents: [this.folders[folderKey]]
        };

        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelim = `\r\n--${boundary}--`;

        const fileData = await new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result.split(',')[1]);
            r.onerror = rej;
            r.readAsDataURL(file);
        });

        const body =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            `Content-Type: ${file.type || 'application/octet-stream'}\r\n` +
            'Content-Transfer-Encoding: base64\r\n\r\n' +
            fileData +
            closeDelim;

        const res = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': `multipart/related; boundary="${boundary}"`
                },
                body
            }
        );

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Drive upload failed: ${err}`);
        }
        const data = await res.json();

        // Make public
        await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'reader', type: 'anyone' })
        });

        return {
            id: data.id,
            name: data.name,
            mimeType: data.mimeType,
            viewUrl: data.webViewLink,
            directUrl: this.directUrl(data.id),
            previewUrl: this.previewUrl(data.id),
            embedUrl: this.embedUrl(data.id)
        };
    },

    async delete(fileId) {
        await this.ensureToken();
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.accessToken}` }
        });
        return res.ok;
    },

    directUrl(fid)   { return `https://drive.google.com/uc?export=view&id=${fid}`; },
    previewUrl(fid)  { return `https://drive.google.com/thumbnail?id=${fid}&sz=w1600`; },
    embedUrl(fid)    { return `https://drive.google.com/file/d/${fid}/preview`; },
    downloadUrl(fid) { return `https://drive.google.com/uc?export=download&id=${fid}`; },

    async listPublic(folderId) {
        await this.init();
        if (!this.apiKey) throw new Error('Missing gdrive_api_key');
        if (!folderId) throw new Error('Missing folder id');

        const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
        const fields = 'files(id,name,mimeType,createdTime,thumbnailLink,webViewLink,size)';
        const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&key=${this.apiKey}&orderBy=createdTime desc&pageSize=200`;

        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Drive list failed: ${err}`);
        }
        const data = await res.json();
        return data.files || [];
    },

    async listGalleryItems() {
        await this.init();
        const [photos, videos] = await Promise.all([
            this.listPublic(this.folders.gallery).catch(() => []),
            this.listPublic(this.folders.videos).catch(() => [])
        ]);

        const items = [];

        photos.forEach(f => {
            if (f.mimeType?.startsWith('image/')) {
                items.push({
                    id: f.id,
                    type: 'image',
                    src: this.previewUrl(f.id),
                    caption: f.name.replace(/^\d+_/, '').replace(/\.[^.]+$/, ''),
                    createdAt: f.createdTime
                });
            }
        });

        videos.forEach(f => {
            if (f.mimeType?.startsWith('video/')) {
                items.push({
                    id: f.id,
                    type: 'video',
                    src: this.embedUrl(f.id),
                    caption: f.name.replace(/^\d+_/, '').replace(/\.[^.]+$/, ''),
                    createdAt: f.createdTime
                });
            }
        });

        return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
};

window.GDrive = GDrive;
console.log('[OK] gdrive-config.js loaded');
