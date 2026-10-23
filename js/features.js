/* ============================================================
   FEATURES: THEMES, SEARCH, PERFECT CURSOR, TICKET, CV
   ============================================================ */

window.SH_THEMES = ['dark', 'light', 'ocean', 'forest', 'sunset'];

window.applyTheme = function (theme) {
    if (!window.SH_THEMES.includes(theme)) theme = 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = (theme === 'light') ? 'light' : 'dark';
    try { Utils.setStorage('sh_theme', theme); } catch (e) {}

    const icon = document.querySelector('#themeToggle i');
    if (icon) {
        const icons = { dark: 'fa-moon', light: 'fa-sun', ocean: 'fa-water', forest: 'fa-tree', sunset: 'fa-fire' };
        icon.className = 'fas ' + (icons[theme] || 'fa-palette');
    }
};

window.cycleTheme = function () {
    const current = Utils.getStorage('sh_theme', 'dark');
    const idx = window.SH_THEMES.indexOf(current);
    const next = window.SH_THEMES[(idx + 1) % window.SH_THEMES.length];
    window.applyTheme(next);
};

// ── Global Search ────────────────────────────────────────────
function shInitGlobalSearch() {
    const trigger = document.getElementById('searchTrigger');
    const modal = document.getElementById('globalSearch');
    const input = document.getElementById('globalSearchInput');
    const results = document.getElementById('globalSearchResults');
    if (!modal) return;

    let searchIndex = [];

    function buildIndex() {
        searchIndex = [
            { title: 'Home', type: 'Section', icon: 'fa-home', action: () => goTo('home') },
            { title: 'About Me', type: 'Section', icon: 'fa-user', action: () => goTo('about') },
            { title: 'Experience', type: 'Section', icon: 'fa-briefcase', action: () => goTo('experience') },
            { title: 'Technical Skills', type: 'Section', icon: 'fa-cogs', action: () => goTo('technical') },
            { title: 'Projects', type: 'Section', icon: 'fa-project-diagram', action: () => goTo('projects') },
            { title: 'Certifications', type: 'Section', icon: 'fa-certificate', action: () => goTo('certifications') },
            { title: 'Education', type: 'Section', icon: 'fa-graduation-cap', action: () => goTo('education') },
            { title: 'Learning Blog', type: 'Section', icon: 'fa-book', action: () => goTo('learning') },
            { title: 'Gallery', type: 'Section', icon: 'fa-images', action: () => goTo('gallery') },
            { title: 'Contact', type: 'Section', icon: 'fa-envelope', action: () => goTo('contact') }
        ];
    }

    function goTo(sectionId) {
        closeSearch();
        if (sectionId === 'gallery') { window.location.href = 'gallery.html'; return; }
        const target = document.getElementById(sectionId);
        if (target) {
            const navHeight = document.getElementById('navbar')?.offsetHeight || 80;
            window.scrollTo({ top: target.offsetTop - navHeight, behavior: 'smooth' });
        }
    }

    function openSearch() {
        buildIndex();
        modal.classList.add('open');
        document.body.classList.add('modal-open');
        setTimeout(() => input?.focus(), 100);
        renderResults('');
    }

    function closeSearch() {
        modal.classList.remove('open');
        document.body.classList.remove('modal-open');
        if (input) input.value = '';
    }

    function renderResults(query) {
        if (!results) return;
        const q = query.toLowerCase().trim();
        const items = q
            ? searchIndex.filter(it => it.title.toLowerCase().includes(q)).slice(0, 10)
            : searchIndex.slice(0, 6);

        if (!items.length) {
            results.innerHTML = '<div class="search-no-results"><p>No results found</p></div>';
            return;
        }
        results.innerHTML = items.map((it, i) =>
            '<div class="search-result-item" data-idx="' + i + '">' +
                '<div class="search-result-icon"><i class="fas ' + it.icon + '"></i></div>' +
                '<div class="search-result-content">' +
                    '<div class="search-result-title">' + Utils.esc(it.title) + '</div>' +
                    '<div class="search-result-type">' + it.type + '</div>' +
                '</div>' +
            '</div>'
        ).join('');

        results.querySelectorAll('.search-result-item').forEach(el => {
            el.addEventListener('click', () => items[+el.dataset.idx].action());
        });
    }

    trigger?.addEventListener('click', openSearch);
    input?.addEventListener('input', Utils.debounce(e => renderResults(e.target.value), 150));

    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            modal.classList.contains('open') ? closeSearch() : openSearch();
        }
        if (e.key === 'Escape' && modal.classList.contains('open')) closeSearch();
    });

    modal.addEventListener('click', e => {
        if (e.target === modal) closeSearch();
    });
}

// ── PERFECT CURSOR (dot + ring + smoke) ──────────────────────
function shInitSmokeCursor() {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
    if (document.querySelector('.custom-cursor')) return; 

    const dot = document.createElement('div');
    dot.className = 'custom-cursor';
    
    const follower = document.createElement('div');
    follower.className = 'cursor-follower';

    const smoke = document.createElement('div');
    smoke.className = 'smokey-cursor';

    document.body.appendChild(dot);
    document.body.appendChild(follower);
    document.body.appendChild(smoke);

    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let dotX = mouseX, dotY = mouseY;
    let fX = mouseX, fY = mouseY;
    let sX = mouseX, sY = mouseY;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    }, { passive: true });

    const hoverTargets = 'a, button, input, textarea, select, .gallery-item, .project-card, .skill-card, .cert-card, .learning-card, .note-card, .contact-card, .filter-btn, .nav-link';
    document.addEventListener('mouseover', (e) => {
        if (e.target.closest(hoverTargets)) {
            dot.classList.add('hovering');
            follower.classList.add('hovering');
        }
    });
    document.addEventListener('mouseout', (e) => {
        if (e.target.closest(hoverTargets)) {
            dot.classList.remove('hovering');
            follower.classList.remove('hovering');
        }
    });

    function animate() {
        dotX += (mouseX - dotX) * 0.6;
        dotY += (mouseY - dotY) * 0.6;
        dot.style.transform = `translate(${dotX}px, ${dotY}px) translate(-50%, -50%)`;

        fX += (mouseX - fX) * 0.25;
        fY += (mouseY - fY) * 0.25;
        follower.style.transform = `translate(${fX}px, ${fY}px) translate(-50%, -50%)`;

        sX += (mouseX - sX) * 0.1;
        sY += (mouseY - sY) * 0.1;
        smoke.style.transform = `translate(${sX}px, ${sY}px) translate(-50%, -50%)`;

        requestAnimationFrame(animate);
    }
    animate();

    // ── Idle: hide after 3s of no activity, reappear instantly on activity ──
    const IDLE_MS = 3000;
    const idleElements = [dot, follower, smoke];

    const originalOpacity = new Map();
    idleElements.forEach(el => {
        originalOpacity.set(el, el.style.opacity || '');
    });

    let idleTimer = null;

    const hideCursor = () => {
        idleElements.forEach(el => { el.style.opacity = '0'; });
    };

    const showCursor = () => {
        idleElements.forEach(el => {
            el.style.opacity = originalOpacity.get(el);
        });
    };

    const startIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(hideCursor, IDLE_MS);
    };

    const onActivity = () => {
        showCursor();
        startIdle();
    };

    document.addEventListener('mousemove', onActivity, { passive: true });
    document.addEventListener('mousedown', onActivity);
    document.addEventListener('scroll', onActivity, { passive: true });
    document.addEventListener('keydown', onActivity);
    document.addEventListener('touchstart', onActivity, { passive: true });

    startIdle();
}

// ── Ticket Tracking ──────────────────────────────────────────
function shInitTicketTracking() {
    const trackBtn = document.getElementById('trackTicketBtn');
    const trackInput = document.getElementById('ticketTrackInput');
    const resultBox = document.getElementById('ticketTrackResult');
    if (!trackBtn || !trackInput || !resultBox) return;

    trackInput.addEventListener('input', e => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    });

    async function track() {
        const id = trackInput.value.trim();
        if (!id) { Utils.showToast('Please enter a ticket ID', 'error'); return; }

        trackBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
        trackBtn.disabled = true;

        let ticket = null;
        try {
            if (window.SupabaseTickets) {
                const row = await window.SupabaseTickets.findByTicketId(id);
                if (row) {
                    ticket = {
                        id: row.ticket_id, name: row.name, email: row.email,
                        subject: row.subject, message: row.message,
                        status: row.status, priority: row.priority,
                        category: row.category, createdAt: row.created_at,
                        updatedAt: row.updated_at, replies: row.replies || []
                    };
                }
            }
        } catch (err) { console.warn('Supabase lookup failed:', err); }

        if (!ticket) {
            const tickets = Utils.getItems('sh_tickets');
            ticket = tickets.find(t => t.id.toUpperCase() === id.toUpperCase());
        }

        trackBtn.innerHTML = '<i class="fas fa-search"></i> Track';
        trackBtn.disabled = false;

        if (!ticket) {
            resultBox.innerHTML =
                '<div class="ticket-status-card" style="border-left: 3px solid var(--accent-danger);">' +
                    '<div style="display: flex; align-items: center; gap: var(--space-md);">' +
                        '<i class="fas fa-times-circle" style="color: var(--accent-danger); font-size: 1.5rem;"></i>' +
                        '<div>' +
                            '<p style="font-weight: 600; color: var(--text-primary);">Ticket Not Found</p>' +
                            '<p style="color: var(--text-muted); font-size: 0.875rem;">No ticket with ID "' + Utils.esc(id) + '".</p>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            return;
        }

        const statuses = (window.TicketSystem && window.TicketSystem.TICKET_STATUSES) || {};
        const priorities = (window.TicketSystem && window.TicketSystem.TICKET_PRIORITIES) || {};
        const st = statuses[ticket.status] || { label: ticket.status, color: '#3b82f6', icon: 'fa-folder-open' };
        const pr = priorities[ticket.priority] || { label: ticket.priority, color: '#3b82f6', icon: 'fa-minus' };

        let repliesHtml = '';
        if (ticket.replies && ticket.replies.length > 0) {
            repliesHtml =
                '<div style="margin-top: var(--space-lg);">' +
                    '<h5 style="margin: 0 0 var(--space-sm) 0; font-size: 0.875rem; color: var(--text-primary);">' +
                        '<i class="fas fa-comments"></i> Conversation (' + ticket.replies.length + ')' +
                    '</h5>' +
                    ticket.replies.map(function (r) {
                        const isAdmin = r.isAdmin === true;
                        return '' +
                            '<div style="padding: 12px; margin-bottom: 8px; border-radius: var(--radius-md);' +
                                'background: ' + (isAdmin ? 'rgba(59,130,246,0.08)' : 'var(--bg-secondary)') + ';' +
                                'border-left: 3px solid ' + (isAdmin ? 'var(--accent-primary)' : 'var(--text-muted)') + ';">' +
                                '<div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.75rem;">' +
                                    '<span style="font-weight: 600; color: ' + (isAdmin ? 'var(--accent-primary)' : 'var(--text-secondary)') + ';">' +
                                        '<i class="fas ' + (isAdmin ? 'fa-shield-alt' : 'fa-user') + '"></i> ' +
                                        (isAdmin ? 'Support Team' : 'You') +
                                    '</span>' +
                                    '<span style="color: var(--text-muted);">' +
                                        (r.timestamp ? Utils.timeAgo(r.timestamp) : '') +
                                    '</span>' +
                                '</div>' +
                                '<p style="margin: 0; color: var(--text-secondary); font-size: 0.875rem; line-height: 1.55;">' +
                                    Utils.esc(r.message).replace(/\n/g, '<br>') +
                                '</p>' +
                            '</div>';
                    }).join('') +
                '</div>';
        } else {
            repliesHtml =
                '<div style="margin-top: var(--space-lg); padding: 12px; background: var(--bg-secondary);' +
                    'border-radius: var(--radius-md); text-align: center; color: var(--text-muted); font-size: 0.8125rem;">' +
                    '<i class="fas fa-hourglass-half"></i> No replies yet. We will get back to you soon.' +
                '</div>';
        }

        resultBox.innerHTML =
            '<div class="ticket-status-card">' +
                '<div class="ticket-status-header">' +
                    '<span class="ticket-status-id">' + Utils.esc(ticket.id) + '</span>' +
                    '<span class="ticket-status-badge" style="background: ' + st.color + '20; color: ' + st.color + ';">' +
                        '<i class="fas ' + st.icon + '"></i> ' + st.label +
                    '</span>' +
                '</div>' +
                '<h4 style="margin: var(--space-sm) 0; color: var(--text-primary);">' +
                    Utils.esc(ticket.subject) +
                '</h4>' +
                '<div style="display: flex; gap: var(--space-md); font-size: 0.8125rem;' +
                    'color: var(--text-muted); margin-bottom: var(--space-md); flex-wrap: wrap;">' +
                    '<span><i class="fas fa-calendar"></i> ' + Utils.formatDate(ticket.createdAt) + '</span>' +
                    '<span><i class="fas fa-clock"></i> ' + Utils.timeAgo(ticket.updatedAt || ticket.createdAt) + '</span>' +
                    '<span style="color: ' + pr.color + ';">' +
                        '<i class="fas ' + pr.icon + '"></i> ' + pr.label + ' Priority' +
                    '</span>' +
                    (ticket.category ?
                        '<span><i class="fas fa-tag"></i> ' + Utils.esc(ticket.category) + '</span>'
                        : '') +
                '</div>' +
                '<div style="padding: 12px; background: var(--bg-secondary); border-radius: var(--radius-md);' +
                    'border-left: 3px solid var(--accent-primary);">' +
                    '<div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted);' +
                        'text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">' +
                        'Original Message' +
                    '</div>' +
                    '<p style="margin: 0; color: var(--text-secondary); font-size: 0.875rem; line-height: 1.6;">' +
                        Utils.esc(ticket.message).replace(/\n/g, '<br>') +
                    '</p>' +
                '</div>' +
                repliesHtml +
            '</div>';
    }

    trackBtn.addEventListener('click', track);
    trackInput.addEventListener('keypress', e => { if (e.key === 'Enter') track(); });
}

// ── CV Viewer ────────────────────────────────────────────────
function shInitCvViewer() {
    const btn = document.getElementById('viewCvBtn');
    if (!btn) return;

    const settings = Utils.getStorage('sh_settings', {});
    const btnText = document.getElementById('cvBtnText');
    if (btnText && settings.cvButtonText) btnText.textContent = settings.cvButtonText;

    btn.addEventListener('click', () => {
        const s = Utils.getStorage('sh_settings', {});
        if (!s.cvFile) { Utils.showToast('CV not uploaded yet', 'warning'); return; }

        const fileName = s.cvFileName || 'CV.pdf';
        const isPdf = fileName.toLowerCase().endsWith('.pdf');
        const fileId = s.cvFileId;

        const previewSrc = fileId
            ? 'https://drive.google.com/file/d/' + fileId + '/preview'
            : s.cvFile;
        const viewSrc = fileId
            ? 'https://drive.google.com/file/d/' + fileId + '/view'
            : s.cvFile;
        const downloadSrc = fileId
            ? 'https://drive.google.com/uc?export=download&id=' + fileId
            : s.cvFile;

        const previewHtml = isPdf
            ? '<iframe src="' + previewSrc + '" style="width:100%;height:75vh;border:none;border-radius:var(--radius-md);background:#fff;" allowfullscreen></iframe>'
            : '<div style="text-align:center;padding:3rem 1rem;">' +
                '<i class="fas fa-file-alt" style="font-size:4rem;color:var(--accent-primary);margin-bottom:1rem;"></i>' +
                '<p style="color:var(--text-secondary);">Preview not available.</p>' +
              '</div>';

        Utils.openModal('Curriculum Vitae',
            '<div style="display:flex;flex-direction:column;gap:12px;">' +
                '<div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">' +
                    '<a href="' + viewSrc + '" target="_blank" rel="noopener" class="btn btn-outline btn-sm">' +
                        '<i class="fas fa-external-link-alt"></i> View in Drive' +
                    '</a>' +
                    '<a href="' + downloadSrc + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm">' +
                        '<i class="fas fa-download"></i> Download CV' +
                    '</a>' +
                '</div>' +
                '<div style="width:100%;">' + previewHtml + '</div>' +
            '</div>'
        );

        const modal = document.getElementById('modal');
        if (modal) {
            modal.style.maxWidth = '95vw';
            modal.style.width = '95vw';
            modal.style.height = '95vh';
        }
    });
}

// ── Apply Admin Settings to Public Site ──────────────────────
function shApplySiteSettings() {
    const s = Utils.getStorage('sh_settings', {});
    if (!Object.keys(s).length) return;

    const navSocial = document.querySelector('.nav-social');
    if (navSocial) {
        const links = [];
        if (s.email) links.push('<a href="mailto:' + Utils.esc(s.email) + '" title="Email"><i class="fas fa-envelope"></i></a>');
        if (s.facebook) links.push('<a href="' + Utils.esc(s.facebook) + '" target="_blank" rel="noopener"><i class="fab fa-facebook-f"></i></a>');
        if (s.linkedin) links.push('<a href="' + Utils.esc(s.linkedin) + '" target="_blank" rel="noopener"><i class="fab fa-linkedin-in"></i></a>');
        if (s.twitter) links.push('<a href="' + Utils.esc(s.twitter) + '" target="_blank" rel="noopener"><i class="fab fa-twitter"></i></a>');
        if (s.github) links.push('<a href="' + Utils.esc(s.github) + '" target="_blank" rel="noopener"><i class="fab fa-github"></i></a>');
        if (links.length) navSocial.innerHTML = links.join('');
    }

    if (s.tagline) {
        const badge = document.querySelector('.hero-badge span:last-child');
        if (badge) badge.textContent = s.tagline;
    }

    const visibility = s.visibility || {};
    Object.entries(visibility).forEach(([key, visible]) => {
        const section = document.getElementById(key);
        const navLink = document.querySelector('.nav-link[data-section="' + key + '"]');
        if (visible === false) {
            if (section) section.style.display = 'none';
            if (navLink) navLink.style.display = 'none';
        } else {
            if (section) section.style.display = '';
            if (navLink) navLink.style.display = '';
        }
    });
}

function shBootFeatures() {
    const savedTheme = Utils.getStorage('sh_theme', null);
    const siteSettings = Utils.getStorage('sh_settings', {});
    window.applyTheme(savedTheme || siteSettings.defaultTheme || 'dark');

    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', window.cycleTheme);

    try { shInitGlobalSearch(); } catch (e) { console.error('Search init failed:', e); }
    try { shInitSmokeCursor(); } catch (e) { console.error('Cursor init failed:', e); }
    try { shInitTicketTracking(); } catch (e) { console.error('Tracking init failed:', e); }
    try { shInitCvViewer(); } catch (e) { console.error('CV init failed:', e); }
    try { shApplySiteSettings(); } catch (e) { console.error('Settings apply failed:', e); }
}

// This file is loaded last, so DOMContentLoaded may already have fired.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', shBootFeatures, { once: true });
} else {
    shBootFeatures();
}

console.log('✅ features.js loaded successfully');
