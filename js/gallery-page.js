/* ============================================================
   GALLERY PAGE — Loads photos + videos from Google Drive
   ============================================================ */

const galleryPageState = { items: [], filter: 'all' };

document.addEventListener('DOMContentLoaded', async () => {
    document.documentElement.setAttribute('data-theme', Utils.getStorage('sh_theme', 'dark'));
    initModal();

    const box = document.getElementById('galleryFilters');
    box?.addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (!btn) return;
        box.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        galleryPageState.filter = btn.dataset.galleryFilter;
        renderGalleryPage();
    });

    await loadGalleryPage();
});

async function loadGalleryPage() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    try {
        if (!window.GDrive) throw new Error('GDrive not loaded');
        await window.GDrive.init();
        const items = await window.GDrive.listGalleryItems();
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

function renderGalleryPage() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    const items = galleryPageState.filter === 'all'
        ? galleryPageState.items
        : galleryPageState.items.filter(i => i.type === galleryPageState.filter);

    if (!items.length) {
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">
                <i class="fas fa-images" style="font-size:3rem;opacity:.5;margin-bottom:1rem;"></i>
                <p>No items to show.</p>
            </div>`;
        return;
    }

    grid.innerHTML = items.map(item => {
        if (item.type === 'video') {
            return `
                <div class="gallery-item" data-id="${item.id}">
                    <div class="placeholder-video"><i class="fas fa-play-circle"></i></div>
                    <div class="gallery-video-badge"><i class="fas fa-video"></i> Video</div>
                    <div class="gallery-overlay">
                        <div class="gallery-caption">${Utils.esc(item.caption || 'Untitled')}</div>
                        <div class="gallery-date">${Utils.formatDate(item.createdAt)}</div>
                    </div>
                </div>`;
        }
        return `
            <div class="gallery-item" data-id="${item.id}">
                <img src="${item.src}" alt="${Utils.esc(item.caption || '')}" loading="lazy">
                <div class="gallery-overlay">
                    <div class="gallery-caption">${Utils.esc(item.caption || 'Untitled')}</div>
                    <div class="gallery-date">${Utils.formatDate(item.createdAt)}</div>
                </div>
            </div>`;
    }).join('');

    grid.querySelectorAll('.gallery-item').forEach(el => {
        el.addEventListener('click', () => {
            const it = items.find(i => i.id === el.dataset.id);
            if (it) openGalleryItem(it);
        });
    });
}

function openGalleryItem(item) {
    const media = item.type === 'video'
        ? `<iframe src="${item.src}" width="100%" height="480" allowfullscreen
                  style="border:none;border-radius:var(--radius-lg);"></iframe>`
        : `<img src="${item.src}" style="width:100%;max-height:75vh;object-fit:contain;border-radius:var(--radius-lg);">`;

    Utils.openModal(item.caption || 'Gallery', `
        <div style="text-align:center;">
            ${media}
            <p style="margin-top:1rem;color:var(--text-muted);font-size:.75rem;">
                ${Utils.formatDate(item.createdAt)}
            </p>
        </div>`);
}

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
