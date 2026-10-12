/* ============================================================
   GALLERY PAGE - Loads from Firebase Storage + Firestore
   ============================================================ */

const galleryState = {
    items: [],
    filter: 'all'
};

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initGalleryPage();
    initModal();
});

function initTheme() {
    const saved = Utils.getStorage('sh_theme', 'dark');
    document.documentElement.setAttribute('data-theme', saved);
}

async function initGalleryPage() {
    const grid = document.getElementById('galleryGrid');
    const filtersBox = document.getElementById('galleryFilters');
    if (!grid) return;

    // Show loading
    grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-primary);"></i>
            <p style="margin-top: 1rem; color: var(--text-secondary);">Loading gallery...</p>
        </div>
    `;

    try {
        // Load from Firebase (see firebase-config.js)
        if (window.FirebaseGallery) {
            galleryState.items = await FirebaseGallery.fetchAll();
        } else {
            // Fallback to localStorage
            galleryState.items = Utils.getItems('sh_gallery');
        }

        renderGallery();

        // Filter buttons
        filtersBox?.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            filtersBox.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            galleryState.filter = btn.dataset.galleryFilter;
            renderGallery();
        });

    } catch (err) {
        console.error('Gallery load error:', err);
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem;"></i>
                <p style="margin-top: 1rem;">Failed to load gallery. Please try again later.</p>
            </div>
        `;
    }
}

function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    const filtered = galleryState.filter === 'all'
        ? galleryState.items
        : galleryState.items.filter(i => i.type === galleryState.filter);

    if (!filtered.length) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <i class="fas fa-images" style="font-size: 3rem; opacity: 0.5; margin-bottom: 1rem;"></i>
                <p>No items in gallery yet.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(item => {
        if (item.type === 'video') {
            const ytId = getYouTubeId(item.src);
            const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
            return `
                <div class="gallery-item" data-id="${item.id}">
                    ${thumb
                        ? `<img src="${thumb}" alt="">`
                        : `<div class="placeholder-video"><i class="fas fa-play-circle"></i></div>`}
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
            const item = galleryState.items.find(i => i.id === el.dataset.id);
            if (item) openGalleryViewer(item);
        });
    });
}

function getYouTubeId(url) {
    const m = (url || '').match(/(?:youtu\.be\/|v=|embed\/)([^&?/\s]+)/);
    return m ? m[1] : null;
}

function openGalleryViewer(item) {
    let mediaHtml;
    if (item.type === 'video') {
        const ytId = getYouTubeId(item.src);
        if (ytId) {
            mediaHtml = `<iframe width="100%" height="450" src="https://www.youtube.com/embed/${ytId}" frameborder="0" allowfullscreen style="border-radius:var(--radius-lg);"></iframe>`;
        } else {
            mediaHtml = `<video src="${item.src}" controls style="width:100%;max-height:500px;border-radius:var(--radius-lg);"></video>`;
        }
    } else {
        mediaHtml = `<img src="${item.src}" alt="" style="width:100%;max-height:70vh;object-fit:contain;border-radius:var(--radius-lg);">`;
    }

    Utils.openModal(item.caption || 'Gallery', `
        <div style="text-align:center;">
            ${mediaHtml}
            ${item.caption ? `<p style="margin-top:1rem;color:var(--text-secondary);">${Utils.esc(item.caption)}</p>` : ''}
            <p style="margin-top:0.5rem;color:var(--text-muted);font-size:0.75rem;">
                ${Utils.formatDate(item.createdAt)}
            </p>
        </div>
    `);
}

function initModal() {
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    closeBtn?.addEventListener('click', Utils.closeModal);
    overlay?.addEventListener('click', (e) => {
        if (e.target === overlay) Utils.closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') Utils.closeModal();
    });
}
