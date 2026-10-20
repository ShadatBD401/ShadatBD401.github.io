/* ============================================================
   GALLERY PAGE — Loads photos + videos from Google Drive
   Fixed: modal shows title + description + share,
          preserves newlines, gallery item cards show description
   ============================================================ */

const galleryPageState = { items: [], filter: 'all' };

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
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        box.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        galleryPageState.filter = btn.dataset.galleryFilter;
        renderGalleryPage();
    });

    await new Promise(r => setTimeout(r, 200));
    await loadGalleryPage();
});

async function loadGalleryPage() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    try {
        if (!window.GDrivePublic) throw new Error('GDrivePublic not loaded');
        const items = await window.GDrivePublic.listGalleryItems();
        galleryPageState.items = items;
        renderGalleryPage();
    } catch (err) {
        console.error('Gallery load error:', err);
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">
                <i class="fas fa-exclamation-triangle" style="font-size:2rem;margin-bottom:1rem;"></i>
                <p>Gallery unavailable. ${Utils.esc(err.message)}</p>
            </div>`;
    }
}

async function renderGalleryPage() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    if (Utils.getStorage('sh_gallery_dirty', false)) {
        Utils.removeStorage('sh_gallery_dirty');
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">
            <i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i></div>`;
        await loadGalleryPage();
        return;
    }

    const hiddenIds = Utils.getStorage('sh_hidden_gallery', []);
    let items = galleryPageState.items.filter(i => !hiddenIds.includes(i.id));

    const savedOrder = Utils.getStorage('sh_gallery_order', []);
    if (savedOrder.length) {
        items.sort((a, b) => {
            const idxA = savedOrder.indexOf(a.id);
            const idxB = savedOrder.indexOf(b.id);
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
        const desc  = item.description || '';
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
                        ${desc ? `<p class="gallery-caption-desc">${Utils.esc(desc)}</p>` : ''}
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
                    ${desc ? `<p class="gallery-caption-desc">${Utils.esc(desc)}</p>` : ''}
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

/* ✅ Full-size view + title + description + share.
   Preserves newlines with .replace(/\n/g, '<br>') AND the
   .gallery-modal-description CSS uses white-space: pre-wrap. */
function openGalleryItem(item) {
    const title = item.title || item.caption || 'Untitled';
    const desc  = item.description || '';

    const media = item.type === 'video'
        ? `<iframe src="${item.src}" allowfullscreen></iframe>`
        : `<img src="${item.src}" alt="${Utils.esc(title)}">`;

    const shareUrl = window.location.href;

    const content = document.createElement('div');
    content.className = 'gallery-modal-content';
    content.innerHTML = `
        <div class="gallery-modal-media">${media}</div>
        <div class="gallery-modal-info">
            <h2 class="gallery-modal-title"></h2>
            ${desc ? `<div class="gallery-modal-description"></div>` : ''}
            <div class="gallery-modal-meta">
                <span><i class="fas fa-calendar"></i> ${Utils.formatDate(item.createdAt)}</span>
                <span><i class="fas fa-${item.type === 'video' ? 'video' : 'image'}"></i> ${item.type}</span>
            </div>
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
                <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}"
                   target="_blank" rel="noopener" class="btn btn-outline btn-sm">
                    <i class="fab fa-twitter"></i> Tweet
                </a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}"
                   target="_blank" rel="noopener" class="btn btn-outline btn-sm">
                    <i class="fab fa-facebook"></i> Share
                </a>
            </div>
        </div>`;

    content.querySelector('.gallery-modal-title').textContent = title;
    if (desc) {
        // Preserve newlines by setting innerText/textContent — CSS handles pre-wrap
        content.querySelector('.gallery-modal-description').textContent = desc;
    }

    // Wire share buttons before serializing
    const nativeBtn = content.querySelector('#galleryNativeShare');
    const copyBtn   = content.querySelector('#galleryCopyLink');

    Utils.openModal('', content.outerHTML);

    // Re-wire inside the live modal (listeners lost in outerHTML)
    const modalBody = document.getElementById('modalBody');
    const liveNative = modalBody?.querySelector('#galleryNativeShare');
    const liveCopy   = modalBody?.querySelector('#galleryCopyLink');

    if (liveNative) {
        liveNative.addEventListener('click', () => {
            if (navigator.share) navigator.share({ title, url: shareUrl }).catch(() => {});
            else window.copyGalleryLink(shareUrl);
        });
    }
    if (liveCopy) {
        liveCopy.addEventListener('click', () => window.copyGalleryLink(shareUrl));
    }
    // Also update description text inside the live modal (outerHTML may have stripped)
    const liveTitleEl = modalBody?.querySelector('.gallery-modal-title');
    if (liveTitleEl) liveTitleEl.textContent = title;
    const liveDescEl = modalBody?.querySelector('.gallery-modal-description');
    if (liveDescEl && desc) liveDescEl.textContent = desc;

    const modal = document.getElementById('modal');
    if (modal) {
        modal.style.maxWidth = '900px';
        modal.style.width = '92vw';
    }
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.style.display = 'none';
    const closeBtn = document.getElementById('modalClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modalTitle) modalTitle.style.display = '';
            if (modal) { modal.style.maxWidth = ''; modal.style.width = ''; }
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
