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

    previewUrl(fid) { return `https://drive.google.com/thumbnail?id=${fid}&sz=w1600`; },
    embedUrl(fid)   { return `https://drive.google.com/file/d/${fid}/preview`; },

    async listPublic(folderId) {
        if (!this.apiKey || this.apiKey.startsWith('PASTE_')) {
            throw new Error('API key not configured in gdrive-public-config.js');
        }
        if (!folderId) throw new Error('Folder ID missing');

        const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
        const fields = 'files(id,name,mimeType,createdTime)';
        const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&key=${this.apiKey}&orderBy=createdTime desc&pageSize=200`;

        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Drive list failed: ${res.status} ${err}`);
        }
        const data = await res.json();
        return data.files || [];
    },

    async listGalleryItems() {
        const [photos, videos] = await Promise.all([
            this.listPublic(this.folders.gallery).catch(e => { console.warn(e); return []; }),
            this.listPublic(this.folders.videos).catch(e => { console.warn(e); return []; })
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

window.GDrivePublic = GDrivePublic;
