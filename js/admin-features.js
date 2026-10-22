/* ============================================================
   ADMIN FEATURES: PROFILE UPLOAD, SOCIAL LINKS, CV, SETTINGS, GALLERY
   Verified: long-press 1s reorder (#7), Supabase sync (#8),
             read button (#9), admin theme icon (#10), GitHub sync (#12)
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('adminDashboard')) return;
    initProfileSettings();
    loadAllSettings();
    ensureSaveButton();
    initDriveConnectButton();
    applyAdminSidebarAvatar();
    initAdminThemeToggle();

    const ids = await getHiddenGalleryIds();
    Utils.setStorage('sh_hidden_gallery', ids);

    await syncGalleryFromSupabase();
    await syncExtraContent();
});

// ── Admin Theme Toggle (issue #10) ──────────────────────────
function initAdminThemeToggle() {
    const topbar = document.querySelector('.topbar-actions');
    if (!topbar || document.getElementById('adminThemeToggle')) return;

    const btn = document.createElement('button');
    btn.className = 'topbar-btn';
    btn.id = 'adminThemeToggle';
    btn.title = 'Cycle Theme';
    btn.innerHTML = '<i class="fas fa-moon"></i>';
    topbar.insertBefore(btn, document.getElementById('refreshBtn'));

    btn.addEventListener('click', () => {
        if (typeof window.cycleTheme === 'function') {
            window.cycleTheme();
            const theme = document.documentElement.getAttribute('data-theme');
            const icons = { dark:'fa-moon', light:'fa-sun', ocean:'fa-water', forest:'fa-tree', sunset:'fa-fire' };
            btn.innerHTML = `<i class="fas ${icons[theme] || 'fa-moon'}"></i>`;
            Utils.showToast('Theme: ' + theme, 'success', 1000);
        }
    });
}

// ── Sync extra content from GitHub (issue #12) ──────────────
async function syncExtraContent() {
    if (!window.GitHubContent) return;
    const sections = ['education', 'experience', 'hero-stats', 'about-domains',
                      'interests', 'contact-cards', 'matrix', 'notes'];
    const keyMap = {
        'education': 'sh_education', 'experience': 'sh_experience',
        'hero-stats': 'sh_hero_stats', 'about-domains': 'sh_domains',
        'interests': 'sh_interests', 'contact-cards': 'sh_contact_cards',
        'matrix': 'sh_matrix', 'notes': 'sh_notes'
    };
    for (const s of sections) {
        try {
            const data = await window.GitHubContent.read(`data/${s}.json`);
            if (data && Array.isArray(data.json)) {
                Utils.setStorage(keyMap[s], data.json);
                console.log(`⬇️ synced ${s} from GitHub`);
            }
        } catch (e) { /* file may not exist yet */ }
    }
}

// ── Sync gallery from Supabase (issue #8) ───────────────────
async function syncGalleryFromSupabase() {
    try {
        const client = await initSupabase();
        const { data } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'gallery_items')
            .maybeSingle();
        if (Array.isArray(data?.value) && data.value.length) {
            Utils.setStorage('sh_gallery', data.value);
            console.log(`⬇️ ${data.value.length} gallery items loaded from Supabase`);
        }
    } catch (e) {
        console.warn('Gallery sync failed:', e);
    }
}

async function pushGalleryToSupabase(items) {
    try {
        const client = await initSupabase();
        await client.from('site_settings').upsert(
            { key: 'gallery_items', value: items, updated_at: new Date().toISOString() },
            { onConflict: 'key' }
        );
        console.log('✅ Gallery pushed to Supabase');
    } catch (e) {
        console.warn('Gallery push failed:', e);
    }
}

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
    Utils.setStorage('sh_gallery_dirty', true);
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

    let settings = {};
    try {
        const client = await initSupabase();
        const { data } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'main')
            .maybeSingle();
        if (data?.value) {
            settings = data.value;
        } else {
            const remote = await window.SupabaseSecrets.get('site_settings').catch(() => null);
            settings = remote ? JSON.parse(remote) : Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
        }
    } catch (e) {
        settings = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
    }

    Utils.setStorage(Utils.STORAGE_KEYS.SETTINGS, settings);

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
            const client = await initSupabase();
            await client.from('site_settings').upsert(
                { key: 'main', value: settings, updated_at: new Date().toISOString() },
                { onConflict: 'key' }
            );
        } catch (e) {
            console.warn('Supabase settings save failed:', e);
        }
    }

    profileInput?.addEventListener('change', async (e) => {
        let file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { Utils.showToast('Image must be under 5MB', 'error'); return; }
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

    heroInput?.addEventListener('change', async (e) => {
        let file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { Utils.showToast('Image must be under 5MB', 'error'); return; }
        const edited = await window.PhotoEditor.open(file);
        if (!edited) { e.target.value = ''; return; }
        file = edited;
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
        e.target.value = '';
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

    cvInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { Utils.showToast('CV must be under 5MB', 'error'); return; }
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
    ['about','experience','technical','projects','certifications','education','learning','gallery','contact','notes'].forEach(sec => {
        const el = document.getElementById('vis_' + sec);
        if (el) el.checked = (s.visibility || {})[sec] !== false;
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

(function hookNavigation() {
    const orig = window.navigateToPage;
    if (typeof orig !== 'function') return;
    window.navigateToPage = function(page) {
        orig(page);
        if (page === 'gallery') renderAdminGallery();
        if (page === 'videos')  renderAdminVideos();
    };
})();

function renderAdminGallery() {
    const c = document.getElementById('galleryContainer');
    if (!c) return;

    const savedOrder = Utils.getStorage('sh_gallery_order', []);
    let items = Utils.getItems('sh_gallery');

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
                        <button class="admin-item-btn" onclick="readGalleryItem('${item.id}')" title="Read">
                            <i class="fas fa-book-open"></i>
                        </button>
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

    makeGallerySortable();

    const btn = document.getElementById('newGalleryBtn');
    if (btn && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.addEventListener('click', () => openGalleryForm());
    }
}

// ── Read mode (issue #9) ────────────────────────────────────
window.readGalleryItem = function(id) {
    const item = Utils.getItems(GALLERY_KEY).find(i => i.id === id);
    if (!item) return;

    const media = item.type === 'video'
        ? `<iframe src="${item.src}" allowfullscreen></iframe>`
        : `<img src="${item.src}" alt="${Utils.esc(item.title || '')}">`;

    const content = document.createElement('div');
    content.className = 'gallery-modal-content';
    // Inside readGalleryItem, after creating `content`:
    content.innerHTML = `
        <div class="gallery-modal-content">
            <div class="gallery-modal-media" style="flex-shrink: 0; min-height: 200px;">
                ${media}
            </div>
            <div class="gallery-modal-info" style="overflow-y: auto;">
                <h2 class="gallery-modal-title"></h2>
                ${item.description ? `<div class="gallery-modal-description"></div>` : ''}
                <div class="gallery-modal-meta">
                    <span><i class="fas fa-calendar"></i> ${Utils.formatDate(item.createdAt)}</span>
                    <span><i class="fas fa-${item.type === 'video' ? 'video' : 'image'}"></i> ${item.type}</span>
                </div>
            </div>
        </div>`;

    content.querySelector('.gallery-modal-title').textContent = item.title || item.caption || 'Untitled';
    if (item.description) {
        content.querySelector('.gallery-modal-description').textContent = item.description.replace(/\\n/g, '\n');
    }
   
    Utils.openModal('', content.outerHTML);

    const modal = document.getElementById('modal');
    if (modal) { modal.style.maxWidth = '900px'; modal.style.width = '92vw'; }
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.style.display = 'none';
    const closeBtn = document.getElementById('modalClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modalTitle) modalTitle.style.display = '';
            if (modal) { modal.style.maxWidth = ''; modal.style.width = ''; }
        }, { once: true });
    }
};

// ── LONG-PRESS 1s reorder (issue #7) ────────────────────────
function makeGallerySortable() {
    const el = document.getElementById('galleryContainer');
    if (!el || typeof Sortable === 'undefined') return;
    if (el._sortable) el._sortable.destroy();

    el._sortable = new Sortable(el, {
        animation: 200,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        delay: 300,
        delayOnTouchOnly: false,
        touchStartThreshold: 8,
        forceFallback: true,
        fallbackClass: 'sortable-drag',
        fallbackOnBody: true,
        onEnd: async (evt) => {
            if (evt.oldIndex === evt.newIndex) return;

            const newOrder = [...el.querySelectorAll('.admin-item-card')]
                .map(card => card.getAttribute('data-drive-id'))
                .filter(Boolean);

            if (!newOrder.length) return;

            // Update in-memory order FIRST so any re-render during save stays consistent
            Utils.setStorage('sh_gallery_order', newOrder);
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

    const filtered = items.filter(i => i.id !== id);
    Utils.saveItems(GALLERY_KEY, filtered);
    await pushGalleryToSupabase(filtered);
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

    if (!title) { Utils.showToast('Title is required', 'error'); return; }

    let src = url;
    let driveId = null;

    // If editing, preserve existing media unless a new file or URL is provided
    if (id) {
        const existingItem = Utils.getItems(GALLERY_KEY).find(i => i.id === id);
        if (existingItem) {
            src = url || existingItem.src;  // Keep old src if url is empty
            driveId = existingItem.driveId;
        }
    }

    if (file) {
        const maxBytes = type === 'video' ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
        if (file.size > maxBytes) {
            Utils.showToast(`File must be under ${maxBytes / 1024 / 1024}MB`, 'error');
            return;
        }
        let toUpload = file;
        if (type === 'image') {
            const edited = await window.PhotoEditor.open(file);
            if (!edited) return;
            toUpload = edited;
        }
        try {
            Utils.showToast('Uploading to Google Drive...', 'info');
            const folder = type === 'video' ? 'videos' : 'gallery';
            const safeTitle = title.replace(/[^\w\s-]/g, '').slice(0, 60).trim();
            const safeDesc  = description.replace(/[^\w\s-]/g, '').slice(0, 100).trim();
            const renamed   = new File(
                [toUpload],
                `${safeTitle}__${safeDesc || 'no-desc'}__${toUpload.name}`,
                { type: toUpload.type }
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

    if (!src) { Utils.showToast('Please provide a URL or upload a file', 'error'); return; }

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
    await pushGalleryToSupabase(items);
    Utils.closeModal();
    Utils.showToast(id ? 'Updated ✓' : 'Uploaded ✓', 'success');
    renderAdminGallery();
};

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
                        <button class="admin-item-btn" onclick="readGalleryItem('${item.id}')" title="Read">
                            <i class="fas fa-book-open"></i>
                        </button>
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
            openGalleryForm({ type: 'video' });
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

    ['about','experience','technical','projects','certifications',
     'education','learning','gallery','contact','notes'].forEach(sec => {
        const el = document.getElementById('vis_' + sec);
        if (el && !el.dataset.wired) {
            el.dataset.wired = '1';
            el.addEventListener('change', autoSave);
        }
    });
});
