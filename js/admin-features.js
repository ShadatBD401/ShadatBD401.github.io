/* ============================================================
   ADMIN FEATURES: PROFILE UPLOAD, SOCIAL LINKS, CV, SETTINGS, GALLERY
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('adminDashboard')) return;
    initProfileSettings();
    loadAllSettings();
    ensureSaveButton();
    initDriveConnectButton();
    applyAdminSidebarAvatar();

    // Preload hidden gallery list
    const ids = await getHiddenGalleryIds();
    Utils.setStorage('sh_hidden_gallery', ids);
});

// ── Show profile pic in admin sidebar ────────────────────────
function applyAdminSidebarAvatar() {
    const el = document.getElementById('adminSidebarAvatar');
    if (!el) return;
    const s = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
    if (s.profileImage) {
        const src = s.profileImageId
            ? `https://drive.google.com/thumbnail?id=${s.profileImageId}&sz=w80`
            : s.profileImage;
        el.innerHTML = `<img src="${src}" alt=""
            style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
    }
}

// ── Hidden Gallery Logic ─────────────────────────────
async function getHiddenGalleryIds() {
    try {
        const client = await initSupabase();
        const { data } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'hidden_gallery')
            .maybeSingle();
        return Array.isArray(data?.value) ? data.value : [];
    } catch (e) {
        return Utils.getStorage('sh_hidden_gallery', []);
    }
}

function isGalleryHidden(idOrDriveId) {
    const list = Utils.getStorage('sh_hidden_gallery', []);
    const items = Utils.getItems('sh_gallery');
    const item = items.find(i => i.id === idOrDriveId || i.driveId === idOrDriveId);
    const driveId = item?.driveId || idOrDriveId;
    return list.includes(driveId);
}

async function setHiddenGalleryIds(ids) {
    Utils.setStorage('sh_hidden_gallery', ids);
    try {
        const client = await initSupabase();
        await client.from('site_settings').upsert(
            { key: 'hidden_gallery', value: ids, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
        );
    } catch (e) {
        console.warn('Failed to publish hidden gallery list:', e);
    }
}

window.toggleGalleryVisibility = async function (idOrDriveId) {
    // Normalise: always use the Google Drive file ID
    const items = Utils.getItems('sh_gallery');
    const item = items.find(i => i.id === idOrDriveId || i.driveId === idOrDriveId);
    const driveId = item?.driveId || idOrDriveId;

    const hidden = await getHiddenGalleryIds();
    const idx = hidden.indexOf(driveId);

    let updated;
    if (idx === -1) {
        updated = [...hidden, driveId];
        Utils.showToast('Item hidden from visitors', 'success');
    } else {
        updated = hidden.filter(x => x !== driveId);
        Utils.showToast('Item visible to visitors', 'success');
    }

    await setHiddenGalleryIds(updated);
    renderAdminGallery();
    renderAdminVideos();
};

async function reorderGallery(newOrderIds) {
    Utils.setStorage('sh_gallery_order', newOrderIds);
    Utils.setStorage('sh_gallery_dirty', true); // Tell the public page to refresh
    try {
        const client = await initSupabase();
        const { error } = await client.from('site_settings').upsert(
            { key: 'gallery_order', value: newOrderIds, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
        );
        if (error) throw error;
        Utils.showToast('Gallery order saved!', 'success');
    } catch (e) {
        console.error('Failed to save gallery order:', e);
        Utils.showToast('Failed to save order: ' + e.message, 'error');
    }
}

function initDriveConnectButton() {
    const container = document.querySelector('.settings-container');
    if (!container || document.getElementById('driveConnectBtn')) return;

    const banner = document.createElement('div');
    banner.className = 'settings-section';
    banner.style.background = 'rgba(59,130,246,0.05)';
    banner.innerHTML = `
        <h2>Google Drive Connection</h2>
        <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:var(--space-md);">
            You must authorize Google Drive before uploading images or CV files.
            Click below to sign in with Google — this only needs to be done once per session.
        </p>
        <div style="display:flex;align-items:center;gap:var(--space-md);">
            <button class="btn btn-primary" id="driveConnectBtn">
                <i class="fab fa-google-drive"></i>
                <span id="driveConnectLabel">Connect Google Drive</span>
            </button>
            <span id="driveStatus" style="font-size:0.875rem;color:var(--text-muted);">Not connected</span>
        </div>
    `;
    container.insertBefore(banner, container.firstChild);

    const btn = document.getElementById('driveConnectBtn');
    const label = document.getElementById('driveConnectLabel');
    const status = document.getElementById('driveStatus');

    // Check if token already exists on load
    const saved = sessionStorage.getItem('gdrive_access_token');
    const savedExp = parseInt(sessionStorage.getItem('gdrive_token_expiry') || '0');
    if (saved && Date.now() < savedExp - 60000) {
        status.textContent = '✓ Connected to Google Drive';
        status.style.color = 'var(--accent-success)';
        label.textContent = 'Reconnect Google Drive';
    }

    btn.addEventListener('click', async () => {
        btn.disabled = true;
        label.textContent = 'Connecting...';
        try {
            await window.GDrive.signIn();
            status.textContent = '✓ Connected to Google Drive';
            status.style.color = 'var(--accent-success)';
            label.textContent = 'Reconnect Google Drive';
            Utils.showToast('Google Drive connected ✓', 'success');
        } catch (err) {
            console.error(err);
            status.textContent = '✗ Failed: ' + (err.error || err.message || 'unknown');
            status.style.color = 'var(--accent-danger)';
            label.textContent = 'Connect Google Drive';
            Utils.showToast('Google Drive connect failed', 'error');
        } finally {
            btn.disabled = false;
        }
    });
}

async function initProfileSettings() {
    const profileInput = document.getElementById('profileImageInput');
    const profilePreview = document.getElementById('profilePreview');
    const removeBtn = document.getElementById('removeProfileBtn');
    const heroInput = document.getElementById('heroImageInput');
    const heroPreview = document.getElementById('heroImagePreview');
    const removeHeroBtn = document.getElementById('removeHeroImageBtn');
    const cvInput = document.getElementById('cvFileInput');
    const cvFileName = document.getElementById('cvFileName');

    // Load existing settings from Supabase (falls back to localStorage)
    let settings = {};
    try {
        // Read from public site_settings table (same one visitors read)
        const client = await initSupabase();
        const { data } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'main')
            .maybeSingle();
        if (data?.value) {
            settings = data.value;
        } else {
            // Fallback: try legacy secrets table
            const remote = await window.SupabaseSecrets.get('site_settings').catch(() => null);
            settings = remote ? JSON.parse(remote) : Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
        }
    } catch (e) {
        settings = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
    }

    // Cache into localStorage for public-site reads
    Utils.setStorage(Utils.STORAGE_KEYS.SETTINGS, settings);

    // Restore visuals
    if (settings.profileImage && profilePreview) {
        profilePreview.innerHTML = `<img src="${settings.profileImage}" alt="Profile">`;
        profilePreview.classList.add('has-image');
    }
    if (settings.heroImage && heroPreview) {
        heroPreview.innerHTML = `<img src="${settings.heroImage}" alt="Hero">`;
        heroPreview.classList.add('has-image');
    }
    if (settings.cvFileName && cvFileName) {
        cvFileName.textContent = settings.cvFileName;
    }

    async function persist() {
        Utils.setStorage(Utils.STORAGE_KEYS.SETTINGS, settings);
        try {
            // Write to public site_settings table
            const client = await initSupabase();
            await client.from('site_settings').upsert(
                { key: 'main', value: settings, updated_at: new Date().toISOString() },
                { onConflict: 'key' }
            );
        } catch (e) {
            console.warn('Supabase settings save failed:', e);
        }
    }

    // ── Navbar avatar ────────────────────────────────────────
    profileInput?.addEventListener('change', async (e) => {
        let file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            Utils.showToast('Image must be under 5MB', 'error');
            return;
        }

        // Open photo editor
        const edited = await window.PhotoEditor.open(file);
        if (!edited) { e.target.value = ''; return; }
        file = edited;

        try {
            Utils.showToast('Uploading to Google Drive...', 'info');
            const result = await window.GDrive.upload(file, 'profile');
            profilePreview.innerHTML = `<img src="${result.directUrl}" alt="Profile">`;
            profilePreview.classList.add('has-image');
            settings.profileImage = result.directUrl;
            settings.profileImageId = result.id;
            await persist();
            Utils.showToast('Avatar uploaded ✓', 'success');
        } catch (err) {
            console.error(err);
            Utils.showToast('Upload failed: ' + err.message, 'error');
        }
        e.target.value = '';
    });
   
    removeBtn?.addEventListener('click', async () => {
        if (settings.profileImageId) {
            try { await window.GDrive.delete(settings.profileImageId); } catch (e) {}
        }
        profilePreview.innerHTML = '<span class="nav-avatar-logo"><span class="logo-bracket">&lt;</span><span class="logo-text">SH</span><span class="logo-bracket">/&gt;</span></span>';
        profilePreview.classList.remove('has-image');
        delete settings.profileImage;
        delete settings.profileImageId;
        await persist();
        Utils.showToast('Avatar removed', 'success');
    });

    // ── Hero picture ─────────────────────────────────────────
    heroInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) {
            Utils.showToast('Image must be under 3MB', 'error');
            return;
        }
        try {
            Utils.showToast('Uploading...', 'info');
            const result = await window.GDrive.upload(file, 'profile');
            heroPreview.innerHTML = `<img src="${result.directUrl}" alt="Hero">`;
            heroPreview.classList.add('has-image');
            settings.heroImage = result.directUrl;
            settings.heroImageId = result.id;
            await persist();
            Utils.showToast('Hero picture uploaded ✓', 'success');
        } catch (err) {
            console.error(err);
            Utils.showToast('Upload failed: ' + err.message, 'error');
        }
    });

    removeHeroBtn?.addEventListener('click', async () => {
        if (settings.heroImageId) {
            try { await window.GDrive.delete(settings.heroImageId); } catch (e) {}
        }
        heroPreview.innerHTML = '<i class="fas fa-user-circle"></i>';
        heroPreview.classList.remove('has-image');
        delete settings.heroImage;
        delete settings.heroImageId;
        await persist();
        Utils.showToast('Hero picture removed', 'success');
    });

    // ── CV upload ────────────────────────────────────────────
    cvInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            Utils.showToast('CV must be under 5MB', 'error');
            return;
        }
        try {
            Utils.showToast('Uploading CV...', 'info');
            const result = await window.GDrive.upload(file, 'cv');
            cvFileName.textContent = file.name;
            settings.cvFile = result.directUrl;
            settings.cvFileId = result.id;
            settings.cvFileName = file.name;
            await persist();
            Utils.showToast('CV uploaded ✓', 'success');
        } catch (err) {
            console.error(err);
            Utils.showToast('Upload failed: ' + err.message, 'error');
        }
    });
}

function loadAllSettings() {
    const s = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
    // Load visibility toggles
    ['about','experience','technical','projects','certifications','education','learning','gallery','contact','notes'].forEach(sec => {
        const el = document.getElementById('vis_' + sec);
        if (el) el.checked = (s.visibility || {})[sec] !== false;   // default true
    });
    const map = {
        settingSiteTitle: s.siteTitle || 'Shadat Hossain',
        settingSiteDesc: s.siteDesc || 'Network & Security Engineer Portfolio',
        settingDisplayName: s.displayName || 'Shadat Hossain',
        settingTitle: s.title || 'Network & Security Engineer',
        settingTagline: s.tagline || 'Available for opportunities',
        settingCvButtonText: s.cvButtonText || 'View CV',
        settingGithub: s.github || '',
        settingLinkedin: s.linkedin || '',
        settingTwitter: s.twitter || '',
        settingFacebook: s.facebook || '',
        settingWhatsapp: s.whatsapp || '',
        settingEmail: s.email || 'sahadat.bda35@gmail.com',
        settingPhone: s.phone || '+880 1575 382663',
        settingNotifyEmail: s.notifyEmail || 'sahadat.bda35@gmail.com',
        settingDefaultTheme: s.defaultTheme || 'dark'
    };
    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });
    const autoReply = document.getElementById('settingAutoReply');
    if (autoReply) autoReply.checked = s.autoReply !== false;
}

function ensureSaveButton() {
    if (document.getElementById('saveSettingsBtn')) return;
    const container = document.querySelector('#page-settings .settings-container');
    if (!container) return;

    // Make it sticky so it's always reachable
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:sticky;bottom:0;padding:var(--space-md) 0;' +
        'background:var(--bg-primary);border-top:1px solid var(--border-color);' +
        'margin-top:var(--space-lg);display:flex;justify-content:flex-end;z-index:5;';

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.id = 'saveSettingsBtn';
    btn.innerHTML = '<i class="fas fa-save"></i> Save All Settings';
    btn.addEventListener('click', saveAllSettings);
    wrapper.appendChild(btn);
    container.appendChild(wrapper);
}

function saveAllSettings() {
    const s = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});

    // Save visibility
    s.visibility = s.visibility || {};
    ['about','experience','technical','projects','certifications','education','learning','gallery','contact','notes'].forEach(sec => {
        const el = document.getElementById('vis_' + sec);
        if (el) s.visibility[sec] = el.checked;
    });

    const fields = [
        'settingSiteTitle', 'settingSiteDesc', 'settingDisplayName', 'settingTitle',
        'settingTagline', 'settingCvButtonText', 'settingGithub', 'settingLinkedin',
        'settingTwitter', 'settingFacebook', 'settingWhatsapp', 'settingEmail',
        'settingPhone', 'settingNotifyEmail', 'settingDefaultTheme'
    ];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const key = id.replace('setting', '').replace(/^./, c => c.toLowerCase());
        s[key] = el.value;
    });
    const autoReply = document.getElementById('settingAutoReply');
    if (autoReply) s.autoReply = autoReply.checked;

    Utils.setStorage(Utils.STORAGE_KEYS.SETTINGS, s);
    // Persist to public table so visitors can read
    (async () => {
        try {
            const client = await initSupabase();
            await client.from('site_settings').upsert(
                { key: 'main', value: s, updated_at: new Date().toISOString() },
                { onConflict: 'key' }
            );
            console.log('✅ Settings published to public table');
        } catch (e) {
            console.warn('Public settings save failed:', e);
        }
    })();

    Utils.showToast('All settings saved successfully', 'success');
}

/* ============================================================
   ADMIN GALLERY & POC VIDEOS
   ============================================================ */

const GALLERY_KEY = 'sh_gallery';

// Wrap existing navigateToPage
(function hookNavigation() {
    const orig = window.navigateToPage;
    if (typeof orig !== 'function') return;
    window.navigateToPage = function(page) {
        orig(page);
        if (page === 'gallery') renderAdminGallery();
        if (page === 'videos')  renderAdminVideos();
    };
})();

// ── Gallery ──────────────────────────────────────────────────
function renderAdminGallery() {
    const c = document.getElementById('galleryContainer');
    if (!c) return;

    const savedOrder = Utils.getStorage('sh_gallery_order', []);
    let items = Utils.getItems('sh_gallery');

    // Sort by custom order (Google Drive IDs), fallback to newest
    if (savedOrder.length > 0) {
        items.sort((a, b) => {
            const aKey = a.driveId || a.id;
            const bKey = b.driveId || b.id;
            const ia = savedOrder.indexOf(aKey);
            const ib = savedOrder.indexOf(bKey);
            if (ia === -1 && ib === -1) return 0;
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });
    }

    if (!items.length) {
        c.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">
            <i class="fas fa-images"></i>
            <h3>No gallery items</h3>
            <p>Click "New Item" to upload a photo or video.</p>
        </div>`;
    } else {
        c.innerHTML = items.map(item => `
            <div class="admin-item-card" data-id="${item.id}"
                 data-drive-id="${item.driveId || item.id}"
                 style="${isGalleryHidden(item.driveId || item.id) ? 'opacity: 0.55;' : ''}">
                <div class="admin-item-header">
                    <div class="admin-item-icon" style="padding:0;overflow:hidden;background:var(--bg-tertiary);">
                        ${item.type === 'video'
                            ? '<i class="fas fa-video"></i>'
                            : `<img src="${Utils.esc(item.src)}" alt="" style="width:100%;height:100%;object-fit:cover;">`}
                    </div>
                    <div class="admin-item-actions">
                        <button class="admin-item-btn" onclick="toggleGalleryVisibility('${item.driveId || item.id}')" title="Hide/Show">
                            <i class="fas ${isGalleryHidden(item.driveId || item.id) ? 'fa-eye-slash' : 'fa-eye'}"></i>
                        </button>
                        <button class="admin-item-btn" onclick="editGalleryItem('${item.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="admin-item-btn delete" onclick="deleteGalleryItem('${item.id}'); renderAdminVideos();" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <h4 class="admin-item-title">
                    ${Utils.esc(item.title || item.caption || 'Untitled')}
                    ${isGalleryHidden(item.driveId || item.id) ? '<span style="font-size:0.625rem;background:var(--accent-warning);color:white;padding:2px 6px;border-radius:4px;margin-left:6px;">HIDDEN</span>' : ''}
                </h4>
            </div>
        `).join('');
    }

    // Enable Drag & Drop — uses data-drive-id so IDs match what the public page sees
    makeGallerySortable();

    const btn = document.getElementById('newGalleryBtn');
    if (btn && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.addEventListener('click', () => openGalleryForm());
    }
}

function makeGallerySortable() {
    const el = document.getElementById('galleryContainer');
    if (!el || typeof Sortable === 'undefined') return;
    if (el._sortable) el._sortable.destroy();

    el._sortable = new Sortable(el, {
        animation: 200,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: async () => {
            const newOrder = [...el.querySelectorAll('.admin-item-card')]
                .map(card => card.dataset.driveId)
                .filter(Boolean);
            if (!newOrder.length) return;
            await reorderGallery(newOrder);
        }
    });
}

function openGalleryForm(item = null) {
    const isEdit = !!item;
    Utils.openModal(isEdit ? 'Edit Gallery Item' : 'New Gallery Item', `
        <div class="admin-form">
            <div class="form-group">
                <label for="galType">Type *</label>
                <select id="galType">
                    <option value="image" ${item?.type === 'image' ? 'selected' : ''}>Image</option>
                    <option value="video" ${item?.type === 'video' ? 'selected' : ''}>Video</option>
                </select>
            </div>
            <div class="form-group">
                <label for="galCaption">Title *</label>
                <input type="text" id="galCaption"
                       value="${item ? Utils.esc(item.title || item.caption || '') : ''}"
                       placeholder="Short title shown under the media">
            </div>
            <div class="form-group">
                <label for="galDescription">Description</label>
                <textarea id="galDescription" rows="3"
                          placeholder="Optional longer description...">${item ? Utils.esc(item.description || '') : ''}</textarea>
            </div>
            <div class="form-group">
                <label for="galUrl">URL (for videos) or Upload File *</label>
                <input type="url" id="galUrl"
                       value="${item && item.type === 'video' ? Utils.esc(item.src) : ''}"
                       placeholder="https://youtube.com/watch?v=...">
                <input type="file" id="galFile" accept="image/*,video/*" style="margin-top:0.5rem;">
                <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.25rem;">
                    ${isEdit ? 'Leave blank to keep current media.' : 'Upload a file OR paste a video URL.'}
                </p>
            </div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveGalleryItem('${item?.id || ''}')">
                    <i class="fas fa-save"></i> ${isEdit ? 'Update' : 'Create'}
                </button>
            </div>
        </div>
    `);
}

window.editGalleryItem = function(id) {
    const item = Utils.getItems(GALLERY_KEY).find(i => i.id === id);
    if (item) openGalleryForm(item);
};

window.deleteGalleryItem = async function(id) {
    if (!confirm('Delete this gallery item from Google Drive?')) return;

    const items = Utils.getItems(GALLERY_KEY);
    const item = items.find(i => i.id === id);

    if (item?.driveId) {
        try {
            await window.GDrive.delete(item.driveId);
            console.log('✅ Deleted from Google Drive:', item.driveId);
        } catch (e) {
            console.warn('⚠️ Drive delete failed:', e);
            Utils.showToast('Warning: Drive file could not be deleted', 'warning');
        }
    }

    Utils.saveItems(GALLERY_KEY, items.filter(i => i.id !== id));
    Utils.showToast('Deleted', 'success');
    renderAdminGallery();
    renderAdminVideos();
};

window.saveGalleryItem = async function(id) {
    const type        = document.getElementById('galType').value;
    const title       = document.getElementById('galCaption').value.trim();
    const description = document.getElementById('galDescription').value.trim();
    const url         = document.getElementById('galUrl').value.trim();
    const fileInput   = document.getElementById('galFile');
    const file        = fileInput?.files[0];

    if (!title) {
        Utils.showToast('Title is required', 'error');
        return;
    }

    let src = url;
    let driveId = null;

    if (file) {
        const maxBytes = type === 'video' ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
        if (file.size > maxBytes) {
            Utils.showToast(`File must be under ${maxBytes / 1024 / 1024}MB`, 'error');
            return;
        }
        try {
            Utils.showToast('Uploading to Google Drive...', 'info');
            const folder = type === 'video' ? 'videos' : 'gallery';
            // Encode title + description into filename so public page can read them
            const safeTitle = title.replace(/[^\w\s-]/g, '').slice(0, 60).trim();
            const safeDesc  = description.replace(/[^\w\s-]/g, '').slice(0, 100).trim();
            const renamed   = new File(
                [file],
                `${safeTitle}__${safeDesc || 'no-desc'}__${file.name}`,
                { type: file.type }
            );
            const result = await window.GDrive.upload(renamed, folder);      
            driveId = result.id;
            src = type === 'video' ? result.embedUrl : result.previewUrl;
        } catch (err) {
            console.error(err);
            Utils.showToast('Drive upload failed: ' + err.message, 'error');
            return;
        }
    }

    if (!src) {
        Utils.showToast('Please provide a URL or upload a file', 'error');
        return;
    }

    const items = Utils.getItems(GALLERY_KEY);
    if (id) {
        const idx = items.findIndex(i => i.id === id);
        if (idx > -1) items[idx] = { ...items[idx], type, title, description, src, driveId };
    } else {
        items.unshift({
            id: Utils.uid(),
            type, title, description, src, driveId,
            createdAt: new Date().toISOString()
        });
    }
    Utils.saveItems(GALLERY_KEY, items);
    Utils.closeModal();
    Utils.showToast(id ? 'Updated ✓' : 'Uploaded ✓', 'success');
    renderAdminGallery();
};

// ── POC Videos (uses same store, filtered to type=video) ─────
function renderAdminVideos() {
    const c = document.getElementById('videosContainer');
    if (!c) return;
    const items = Utils.getItems(GALLERY_KEY)
        .filter(i => i.type === 'video')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!items.length) {
        c.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">
            <i class="fas fa-video"></i>
            <h3>No POC videos</h3>
            <p>Click "New Video" to add a bug bounty proof of concept.</p>
        </div>`;
    } else {
        c.innerHTML = items.map(item => `
            <div class="admin-item-card">
                <div class="admin-item-header">
                    <div class="admin-item-icon"><i class="fas fa-video"></i></div>
                    <div class="admin-item-actions">
                        <button class="admin-item-btn" onclick="toggleGalleryVisibility('${item.id}')"
                                title="${isGalleryHidden(item.id) ? 'Show to visitors' : 'Hide from visitors'}">
                            <i class="fas ${isGalleryHidden(item.id) ? 'fa-eye-slash' : 'fa-eye'}"></i>
                        </button>
                        <button class="admin-item-btn" onclick="editGalleryItem('${item.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="admin-item-btn delete" onclick="deleteGalleryItem('${item.id}'); renderAdminVideos();" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>                    
                </div>
                <h4 class="admin-item-title">
                    ${Utils.esc(item.title || item.caption || 'Untitled')}
                    ${isGalleryHidden(item.id) ? '<span style="font-size:0.625rem;background:var(--accent-warning);color:white;padding:2px 6px;border-radius:4px;margin-left:6px;text-transform:uppercase;font-weight:600;">Hidden</span>' : ''}
                </h4>      
                <p class="admin-item-desc">${Utils.esc(item.src)}</p>
            </div>
        `).join('');
    }

    const btn = document.getElementById('newVideoBtn');
    if (btn && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.addEventListener('click', () => {
            // Force type=video by pre-opening form
            openGalleryForm({ type: 'video', caption: '', src: '' });
            setTimeout(() => {
                const sel = document.getElementById('galType');
                if (sel) sel.value = 'video';
            }, 50);
        });
    }
}

/* ============================================================
   AUTO-SAVE SECTION VISIBILITY TOGGLES
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('adminDashboard')) return;

    // Small debounce so rapid toggles don't hammer Supabase
    const autoSave = Utils.debounce(() => {
        const s = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
        s.visibility = s.visibility || {};
        ['about','experience','technical','projects','certifications',
         'education','learning','gallery','contact','notes'].forEach(sec => {
            const el = document.getElementById('vis_' + sec);
            if (el) s.visibility[sec] = el.checked;
        });
        Utils.setStorage(Utils.STORAGE_KEYS.SETTINGS, s);

        (async () => {
            try {
                const client = await initSupabase();
                await client.from('site_settings').upsert(
                    { key: 'main', value: s, updated_at: new Date().toISOString() },
                    { onConflict: 'key' }
                );
                Utils.showToast('Visibility saved', 'success', 1200);
            } catch (e) {
                console.warn('Auto-save failed:', e);
            }
        })();
    }, 400);

    // Wire each vis_* checkbox once it exists
    ['about','experience','technical','projects','certifications',
     'education','learning','gallery','contact','notes'].forEach(sec => {
        const el = document.getElementById('vis_' + sec);
        if (el && !el.dataset.wired) {
            el.dataset.wired = '1';
            el.addEventListener('change', autoSave);
        }
    });
});
