/* ============================================================
   PUBLIC GOOGLE DRIVE CONFIG
   Hardcoded public values — safe to commit.
   Used by the public gallery page (no auth required).
   ============================================================ */

const GDrivePublic = {
    apiKey: 'AIzaSyBw4k5l0FIKDvKFjuyt5oTjEOAn8Ip9ots',
    folders: {
        gallery: '17DB7TkZ9sj8kWdlKOiSXvznoTw4w979D',
        videos:  '1yQaFes32qV3bDHtHhVPBlpXXdMogpsPw'
    },

    // CDN URL — most reliable for <img> tags.
    // =s0 returns the TRUE ORIGINAL (no resize, no re-encode).
    imgUrl(fid) { return `https://lh3.googleusercontent.com/d/${fid}=s0`; },
    // Embed URL — for <iframe> video player
    embedUrl(fid) { return `https://drive.google.com/file/d/${fid}/preview`; },

    async listPublic(folderId) {
        if (!this.apiKey || this.apiKey.startsWith('PASTE_')) {
            throw new Error('API key not configured');
        }
        if (!folderId) throw new Error('Folder ID missing');

        const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
        const fields = 'files(id,name,mimeType,createdTime)';
        const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&key=${this.apiKey}&orderBy=createdTime desc&pageSize=200`;

        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.text();
            console.error('Drive list error:', err);
            throw new Error(`Drive list failed: ${res.status}`);
        }
        const data = await res.json();
        return data.files || [];
    },

    async listGalleryItems() {
        const [photos, videos] = await Promise.all([
            this.listPublic(this.folders.gallery).catch(() => []),
            this.listPublic(this.folders.videos).catch(() => [])
        ]);

        const items = [];
        const parseName = (name) => {
            const clean = name.replace(/^\d+_/, '').replace(/\.[^.]+$/, '');
            const parts = clean.split('__');
            if (parts.length >= 2) {
                return {
                    title: parts[0].replace(/_/g, ' ') || 'Untitled',
                    description: parts[1] === 'no-desc' ? '' : parts[1].replace(/_/g, ' ')
                };
            }
            return { title: clean.replace(/_/g, ' '), description: '' };
        };

        photos.forEach(f => {
            if (f.mimeType?.startsWith('image/')) {
                const meta = parseName(f.name);
                items.push({
                    id: f.id,
                    type: 'image',
                    src: this.imgUrl(f.id),
                    title: meta.title,
                    description: meta.description,
                    createdAt: f.createdTime
                });
            }
        });

        videos.forEach(f => {
            if (f.mimeType?.startsWith('video/')) {
                const meta = parseName(f.name);
                items.push({
                    id: f.id,
                    type: 'video',
                    src: this.embedUrl(f.id),
                    title: meta.title,
                    description: meta.description,
                    createdAt: f.createdTime
                });
            }
        });

        return items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
};

window.GDrivePublic = GDrivePublic;
