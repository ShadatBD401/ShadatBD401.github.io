/* ============================================================
   GALLERY PAGE — Loads photos + videos from Google Drive
   ============================================================ */

const galleryPageState = { items: [], filter: 'all' };

document.addEventListener('DOMContentLoaded', async () => {
    document.documentElement.setAttribute('data-theme', Utils.getStorage('sh_theme', 'dark'));
    initModal();

    // Load hidden gallery IDs AND gallery order from Supabase
    try {
        const client = await initSupabase();

        // 1. Fetch hidden items
        const { data: hiddenData } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'hidden_gallery')
            .maybeSingle();
        if (Array.isArray(hiddenData?.value)) {
            Utils.setStorage('sh_hidden_gallery', hiddenData.value);
        }

        // 2. Fetch custom order
        const { data: orderData } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'gallery_order')
            .maybeSingle();
        if (Array.isArray(orderData?.value)) {
            Utils.setStorage('sh_gallery_order', orderData.value);
        }

        console.log('⬇️ Loaded gallery settings from Supabase');
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

function renderGalleryPage() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    // 1. Filter hidden items
    const hiddenIds = Utils.getStorage('sh_hidden_gallery', []);
    let items = galleryPageState.items.filter(i => !hiddenIds.includes(i.id));

    // 2. Apply Custom Order
    const savedOrder = Utils.getStorage('sh_gallery_order', []);
    if (savedOrder.length) {
        items.sort((a, b) => {
            const idxA = savedOrder.indexOf(a.id);
            const idxB = savedOrder.indexOf(b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1; // Put new items at the end
            if (idxB === -1) return -1;
            return idxA - idxB;
        });
    }

    // 3. Apply Filter (Photos/Videos)
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
