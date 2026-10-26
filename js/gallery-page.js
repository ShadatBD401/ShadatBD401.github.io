/* ============================================================
   GALLERY PAGE — Loads photos + videos from Google Drive
   FIXED: refresh no longer blanks the grid, no toast spam
   ============================================================ */

const galleryPageState = { items: [], filter: 'all' };
let refreshInFlight = false;

document.addEventListener('DOMContentLoaded', async () => {
    document.documentElement.setAttribute('data-theme', Utils.getStorage('sh_theme', 'dark'));
    initModal();

    try {
        const client = await initSupabase();

        const { data: hiddenData } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'hidden_gallery')
            .maybeSingle();
        if (Array.isArray(hiddenData?.value)) {
            Utils.setStorage('sh_hidden_gallery', hiddenData.value);
        }

        const { data: orderData } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'gallery_order')
            .maybeSingle();
        if (Array.isArray(orderData?.value)) {
            Utils.setStorage('sh_gallery_order', orderData.value);
        }
    } catch (e) {
        console.warn('Could not load gallery settings:', e);
    }

    const box = document.getElementById('galleryFilters');
    box?.addEventListener('click', e => {
        // Only react to real filter buttons (ignore #galleryRefreshBtn and anything else)
        const btn = e.target.closest('.filter-btn[data-gallery-filter]');
        if (!btn) return;

        const newFilter = btn.dataset.galleryFilter;
        if (!newFilter) return;

        box.querySelectorAll('.filter-btn[data-gallery-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        galleryPageState.filter = newFilter;
        renderGalleryPage();
    });

    await new Promise(r => setTimeout(r, 200));
    await loadGalleryPage();
});

async function loadGalleryPage() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    Utils.removeStorage('sh_gallery_dirty');

    // Only show the loading spinner if the grid is currently empty.
    // Otherwise keep the existing items on screen while re-fetching.
    if (!galleryPageState.items.length) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">
                <i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i>
                <p style="margin-top:.75rem;">Loading gallery…</p>
            </div>`;
    }

    let items = null;
    let source = 'none';

    // 1) Supabase
    try {
        const client = await initSupabase();
        const { data, error } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'gallery_items')
            .maybeSingle();
        if (error) throw error;
        if (Array.isArray(data?.value) && data.value.length) {
            items = data.value;
            source = 'supabase';
        }
    } catch (e) {
        console.warn('Supabase gallery failed:', e);
    }

    // 2) localStorage cache
    if (!items || !items.length) {
        const cached = Utils.getItems('sh_gallery');
        if (Array.isArray(cached) && cached.length) {
            items = cached;
            source = 'cache';
        }
    }

    // 3) Google Drive live list
    if (!items || !items.length) {
        try {
            if (window.GDrivePublic) {
                const driveItems = await window.GDrivePublic.listGalleryItems();
                if (Array.isArray(driveItems) && driveItems.length) {
                    items = driveItems;
                    source = 'drive';
                }
            }
        } catch (e) {
            console.warn('Drive list failed:', e);
        }
    }

    // 4) Success — persist and render
    if (Array.isArray(items) && items.length) {
        Utils.saveItems('sh_gallery', items);
        galleryPageState.items = items;
        renderGalleryPage();
        console.log(`Gallery rendered: ${items.length} items from ${source}`);
        return;
    }

    // 5) Everything failed — keep showing whatever we already had
    if (Array.isArray(galleryPageState.items) && galleryPageState.items.length) {
        renderGalleryPage();
        console.warn('Refresh could not reach server — keeping current gallery');
        return;
    }

    // 6) Truly nothing to show
    grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">
            <i class="fas fa-images" style="font-size:3rem;opacity:.5;margin-bottom:1rem;"></i>
            <p>No gallery items found.</p>
        </div>`;
}

async function renderGalleryPage() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    const hiddenIds = Utils.getStorage('sh_hidden_gallery', []);
    let items = galleryPageState.items;

    // Apply hidden filter (safely — if it would blank everything, skip it)
    if (hiddenIds.length) {
        const filtered = items.filter(i => {
            const key = i.driveId || i.id;
            return !hiddenIds.includes(key);
        });
        // Guard: if filtering removed everything, the hidden list is stale — ignore it
        if (filtered.length > 0 || items.length === 0) {
            items = filtered;
        } else {
            console.warn('hidden_gallery would blank the grid — ignoring it');
        }
    }

    const savedOrder = Utils.getStorage('sh_gallery_order', []);
    if (savedOrder.length) {
        items = [...items].sort((a, b) => {
            const aKey = a.driveId || a.id;
            const bKey = b.driveId || b.id;
            const idxA = savedOrder.indexOf(aKey);
            const idxB = savedOrder.indexOf(bKey);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
    }

    const displayItems = galleryPageState.filter === 'all'
        ? items
        : items.filter(i => i.type === galleryPageState.filter);

    if (!displayItems.length) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">
                <i class="fas fa-images" style="font-size:3rem;opacity:.5;margin-bottom:1rem;"></i>
                <p>No items to show.</p>
            </div>`;
        return;
    }

    grid.innerHTML = displayItems.map(item => {
        const title = item.title || item.caption || 'Untitled';
        const desc  = (item.description || '').replace(/\\n/g, '\n');
        const date  = Utils.formatDate(item.createdAt);

        if (item.type === 'video') {
            return `
                <div class="gallery-item" data-id="${item.id}">
                    <div class="gallery-media">
                        <div class="placeholder-video"><i class="fas fa-play-circle"></i></div>
                        <div class="gallery-video-badge"><i class="fas fa-video"></i> Video</div>
                    </div>
                    <div class="gallery-caption-block">
                        <h3 class="gallery-caption-title">${Utils.esc(title)}</h3>
                        ${desc ? `<p class="gallery-caption-desc">${Utils.esc(Utils.truncate(desc, 120))}</p>` : ''}
                        <div class="gallery-caption-meta">
                            <i class="fas fa-calendar"></i>
                            <span>${date}</span>
                        </div>
                    </div>
                </div>`;
        }
        return `
            <div class="gallery-item" data-id="${item.id}">
                <div class="gallery-media">
                    <img src="${item.src}" alt="${Utils.esc(title)}" loading="lazy">
                </div>
                <div class="gallery-caption-block">
                    <h3 class="gallery-caption-title">${Utils.esc(title)}</h3>
                    ${desc ? `<p class="gallery-caption-desc">${Utils.esc(Utils.truncate(desc, 120))}</p>` : ''}
                    <div class="gallery-caption-meta">
                        <i class="fas fa-calendar"></i>
                        <span>${date}</span>
                    </div>
                </div>
            </div>`;
    }).join('');

    grid.querySelectorAll('.gallery-item').forEach(el => {
        el.addEventListener('click', () => {
            const it = displayItems.find(i => i.id === el.dataset.id);
            if (it) openGalleryItem(it);
        });
    });
}

/* ✅ Fixed: Public modal now shows the description perfectly */
function openGalleryItem(item) {
    const title = item.title || item.caption || 'Untitled';
    const desc  = (item.description || '').replace(/\\n/g, '\n').trim();
    const shareUrl = window.location.href;

    const descHtml = desc
        ? desc
            .split(/\n\s*\n/)
            .map(para => `<p>${Utils.esc(para).replace(/\n/g, '<br>')}</p>`)
            .join('')
        : '';

    const mediaHtml = item.type === 'video'
        ? `<iframe src="${item.src}" allowfullscreen></iframe>`
        : `<img src="${item.src}" alt="${Utils.esc(title)}">`;

    const mediaStyle = item.type === 'image' ? `style="--bg-img: url('${item.src}');"` : '';

    const content = `
        <div class="gallery-modal-content">
            <div class="gallery-modal-media" ${mediaStyle}>${mediaHtml}</div>

            <div class="gallery-modal-info">
                <div class="gallery-modal-badges">
                    <span class="gallery-badge-type">
                        <i class="fas fa-${item.type === 'video' ? 'video' : 'image'}"></i>
                        ${item.type === 'video' ? 'Video' : 'Photo'}
                    </span>
                    <span class="gallery-badge-date">
                        <i class="fas fa-calendar"></i>
                        ${Utils.formatDate(item.createdAt)}
                    </span>
                </div>

                <h2 class="gallery-modal-title">${Utils.esc(title)}</h2>

                ${descHtml ? `<div class="gallery-modal-description">${descHtml}</div>` : ''}

                <div class="gallery-modal-actions">
                    <a href="${item.src}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">
                        <i class="fas fa-expand"></i> Open Full Size
                    </a>
                    <button class="btn btn-outline btn-sm" id="galleryNativeShare">
                        <i class="fas fa-share-alt"></i> Share
                    </button>
                    <button class="btn btn-outline btn-sm" id="galleryCopyLink">
                        <i class="fas fa-link"></i> Copy Link
                    </button>
                </div>
            </div>
        </div>`;

    Utils.openModal('', content);

    const modalBody = document.getElementById('modalBody');
    if (modalBody) {
        const liveNative = modalBody.querySelector('#galleryNativeShare');
        const liveCopy   = modalBody.querySelector('#galleryCopyLink');

        if (liveNative) liveNative.addEventListener('click', () => {
            if (navigator.share) navigator.share({ title, url: shareUrl }).catch(() => {});
            else window.copyGalleryLink(shareUrl);
        });
        if (liveCopy) liveCopy.addEventListener('click', () => window.copyGalleryLink(shareUrl));
    }

    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.maxWidth = '90vw';
        modal.style.width = 'auto';
        modal.style.minWidth = '300px';
    }

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.style.display = 'none';

    const closeBtn = document.getElementById('modalClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modalTitle) modalTitle.style.display = '';
            if (modal) {
                modal.style.maxWidth = '';
                modal.style.width = '';
                modal.style.minWidth = '';
            }
        }, { once: true });
    }
}

window.copyGalleryLink = function(url) {
    navigator.clipboard.writeText(url).then(() => {
        Utils.showToast('Link copied!', 'success');
    }).catch(() => Utils.showToast('Copy failed', 'error'));
};

function initModal() {
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    closeBtn?.addEventListener('click', Utils.closeModal);
    overlay?.addEventListener('click', e => {
        if (e.target === overlay) Utils.closeModal();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') Utils.closeModal();
    });
}

/* ✅ REFRESH — keeps the currently selected filter, no toast, no grid wipe */
document.getElementById('galleryRefreshBtn')?.addEventListener('click', async (e) => {
    if (refreshInFlight) return;
    refreshInFlight = true;

    const btn = e.currentTarget;
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';

    Utils.removeStorage('sh_gallery_dirty');

    try {
        const client = await initSupabase();

        const { data: orderData } = await client
            .from('site_settings').select('value').eq('key', 'gallery_order').maybeSingle();
        if (Array.isArray(orderData?.value)) {
            Utils.setStorage('sh_gallery_order', orderData.value);
        }

        const { data: hiddenData } = await client
            .from('site_settings').select('value').eq('key', 'hidden_gallery').maybeSingle();
        if (Array.isArray(hiddenData?.value)) {
            Utils.setStorage('sh_hidden_gallery', hiddenData.value);
        }
    } catch (err) {
        console.warn('Refresh: could not reload settings', err);
    }

    // Preserve the currently selected filter across the reload
    if (!galleryPageState.filter) {
        galleryPageState.filter = 'all';
    }

    await loadGalleryPage();

    // Re-sync the active class on the filter buttons (so the right one stays highlighted)
    const box = document.getElementById('galleryFilters');
    if (box) {
        box.querySelectorAll('.filter-btn[data-gallery-filter]').forEach(b => {
            b.classList.toggle('active', b.dataset.galleryFilter === galleryPageState.filter);
        });
    }

    btn.disabled = false;
    btn.innerHTML = originalHTML;
    refreshInFlight = false;
});
