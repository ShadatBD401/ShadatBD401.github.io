/* ============================================================
   FEATURES: THEMES, GLOBAL SEARCH, CUSTOM CURSOR,
             TICKET TRACKING, CV, GALLERY
   ============================================================ */

const THEMES = ['dark', 'light', 'ocean', 'forest', 'sunset'];

// ── Theme Management ─────────────────────────────────────────
function initThemeSwitcher() {
    const switcher = document.getElementById('themeSwitcher');
    const toggle = document.getElementById('themeSwitcherToggle');
    const swatches = document.querySelectorAll('.theme-swatch');
    const themeToggle = document.getElementById('themeToggle');

    const savedTheme = Utils.getStorage(Utils.STORAGE_KEYS.THEME, 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateSwatchUI(savedTheme);
    updateThemeIcon(savedTheme);

    toggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        switcher?.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (switcher && !switcher.contains(e.target)) {
            switcher.classList.remove('open');
        }
    });

    swatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            applyTheme(swatch.dataset.theme);
        });
    });

    themeToggle?.addEventListener('click', (e) => {
        e.preventDefault();
        const current = Utils.getStorage(Utils.STORAGE_KEYS.THEME, 'dark');
        const idx = THEMES.indexOf(current);
        const next = THEMES[(idx + 1) % THEMES.length];
        applyTheme(next);
        // Utils.showToast(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`, 'info');
    });
}

function applyTheme(theme) {
    if (!THEMES.includes(theme)) theme = 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    Utils.setStorage(Utils.STORAGE_KEYS.THEME, theme);
    updateSwatchUI(theme);
    updateThemeIcon(theme);
}

function updateSwatchUI(theme) {
    document.querySelectorAll('.theme-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.theme === theme);
    });
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#themeToggle i');
    if (!icon) return;
    const icons = {
        dark: 'fa-moon',
        light: 'fa-sun',
        ocean: 'fa-water',
        forest: 'fa-tree',
        sunset: 'fa-fire'
    };
    icon.className = `fas ${icons[theme] || 'fa-palette'}`;
}

// ── Global Search ────────────────────────────────────────────
function initGlobalSearch() {
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

        Utils.getItems(Utils.STORAGE_KEYS.PROJECTS).forEach(p => {
            searchIndex.push({
                title: p.title,
                description: Utils.truncate((p.description || '').replace(/[•\n]/g, ' ').trim(), 70),
                type: 'Project', icon: 'fa-project-diagram', action: () => goTo('projects')
            });
        });

        Utils.getItems(Utils.STORAGE_KEYS.CERTS).forEach(c => {
            searchIndex.push({
                title: c.title, description: c.description || '',
                type: 'Certification', icon: 'fa-certificate', action: () => goTo('certifications')
            });
        });

        Utils.getItems(Utils.STORAGE_KEYS.SKILLS).forEach(s => {
            searchIndex.push({
                title: s.title, description: Utils.truncate(s.desc || '', 70),
                type: 'Skill', icon: 'fa-cog', action: () => goTo('technical')
            });
        });

        Utils.getItems(Utils.STORAGE_KEYS.POSTS).forEach(p => {
            searchIndex.push({
                title: p.title, description: Utils.truncate(p.summary || p.content || '', 70),
                type: 'Blog Post', icon: 'fa-blog', action: () => goTo('learning')
            });
        });
    }

    function goTo(sectionId) {
        closeSearch();
        if (sectionId === 'gallery') {
            window.location.href = 'gallery/';
            return;
        }
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

        let items;
        if (!q) {
            items = searchIndex.slice(0, 6);
        } else {
            items = searchIndex.filter(it =>
                it.title.toLowerCase().includes(q) ||
                (it.description && it.description.toLowerCase().includes(q)) ||
                it.type.toLowerCase().includes(q)
            ).slice(0, 10);
        }

        if (!items.length) {
            results.innerHTML = `<div class="search-no-results">
                <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No results found${q ? ` for "${Utils.esc(query)}"` : ''}</p>
            </div>`;
            return;
        }

        results.innerHTML = items.map((it, i) => `
            <div class="search-result-item" data-idx="${i}">
                <div class="search-result-icon"><i class="fas ${it.icon}"></i></div>
                <div class="search-result-content">
                    <div class="search-result-title">${Utils.esc(it.title)}</div>
                    ${it.description ? `<div class="search-result-type">${Utils.esc(it.description)}</div>` : ''}
                    <div class="search-result-type">${it.type}</div>
                </div>
            </div>
        `).join('');

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

// ── Custom Mouse Cursor (Smokey) ─────────────────────────────
function initCustomCursor() {
    if (window.matchMedia('(hover: none)').matches) return;
    if (document.querySelector('.custom-cursor')) return;
    document.body.classList.add('custom-cursor-active');   // ← ADD THIS LINE
   
    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';

    const follower = document.createElement('div');
    follower.className = 'cursor-follower';

    const smoke = document.createElement('div');
    smoke.className = 'cursor-smoke';

    document.body.appendChild(cursor);
    document.body.appendChild(follower);
    document.body.appendChild(smoke);

    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let cX = mouseX, cY = mouseY;
    let fX = mouseX, fY = mouseY;
    let sX = mouseX, sY = mouseY;
    let smokeTimer = null;

    document.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        smoke.classList.add('active');
        clearTimeout(smokeTimer);
        smokeTimer = setTimeout(() => smoke.classList.remove('active'), 600);
    });

    function animate() {
        cX += (mouseX - cX) * 0.85;   // was 0.5
        cY += (mouseY - cY) * 0.85;
        cursor.style.transform = `translate(${cX - 6}px, ${cY - 6}px)`;

        fX += (mouseX - fX) * 0.45;   // was 0.15
        fY += (mouseY - fY) * 0.45;
        follower.style.transform = `translate(${fX - 20}px, ${fY - 20}px)`;

        sX += (mouseX - sX) * 0.25;   // was 0.08
        sY += (mouseY - sY) * 0.25;
        smoke.style.transform = `translate(${sX - 100}px, ${sY - 100}px)`;

        requestAnimationFrame(animate);
    }
    animate();

    const selector = 'a, button, [role="button"], input, textarea, select, .clickable, .project-card, .skill-card, .cert-card, .learning-card, .ticket-card, .admin-item-card, .sidebar-link, .theme-swatch';

    document.addEventListener('mouseover', e => {
        if (e.target.closest(selector)) {
            cursor.classList.add('hovering');
            follower.classList.add('hovering');
        }
    });
    document.addEventListener('mouseout', e => {
        if (e.target.closest(selector)) {
            cursor.classList.remove('hovering');
            follower.classList.remove('hovering');
        }
    });
    document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
    document.addEventListener('mouseup', () => cursor.classList.remove('clicking'));

    // Hide cursor when window loses focus, tab hidden, or mouse idle
    function hideCursor() {
        cursor.style.opacity = '0';
        follower.style.opacity = '0';
        smoke.style.opacity = '0';
        // REMOVE these three lines:
        // cursor.style.display = 'none';
        // follower.style.display = 'none';
        // smoke.style.display = 'none';
    }

    function showCursor() {
        cursor.style.display = '';
        follower.style.display = '';
        smoke.style.display = '';
        cursor.style.opacity = '';
        follower.style.opacity = '';
        smoke.style.opacity = '';
    }

    window.addEventListener('blur', hideCursor);
    window.addEventListener('focus', showCursor);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) hideCursor();
        else showCursor();
    });

    // Idle hide — 2s of no mouse movement hides the cursor.
    let idleTimer = null;
    document.addEventListener('mousemove', () => {
        showCursor();
        clearTimeout(idleTimer);
        idleTimer = setTimeout(hideCursor, 2000);
    });

    // Belt-and-suspenders: hide on print
    window.addEventListener('beforeprint', hideCursor);
    window.addEventListener('afterprint', showCursor);
}

// ── Ticket Tracking ──────────────────────────────────────────
function initTicketTracking() {
    const trackBtn = document.getElementById('trackTicketBtn');
    const trackInput = document.getElementById('trackTicketInput');
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
        // Try Supabase first
            if (window.SupabaseTickets) {
                const row = await window.SupabaseTickets.findByTicketId(id);
                if (row) {
                    ticket = {
                        id: row.ticket_id,
                        name: row.name,
                        email: row.email,
                        subject: row.subject,
                        message: row.message,
                        status: row.status,
                        priority: row.priority,
                        category: row.category,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                        replies: row.replies || []
                    };
                }
            }
        } catch (err) {
            console.warn('Supabase ticket lookup failed:', err);
        }

        // Fallback to localStorage
        if (!ticket) {
            const tickets = Utils.getItems(Utils.STORAGE_KEYS.TICKETS);
            ticket = tickets.find(t => t.id.toUpperCase() === id.toUpperCase());
        }

        trackBtn.innerHTML = '<i class="fas fa-search"></i> Track';
        trackBtn.disabled = false;

        if (!ticket) {
            resultBox.innerHTML = `
                <div class="ticket-status-card" style="border-left: 3px solid var(--accent-danger);">
                    <div style="display: flex; align-items: center; gap: var(--space-md);">
                        <i class="fas fa-times-circle" style="color: var(--accent-danger); font-size: 1.5rem;"></i>
                        <div>
                            <p style="font-weight: 600;">Ticket Not Found</p>
                            <p style="color: var(--text-muted); font-size: 0.875rem;">
                                No ticket with ID "${Utils.esc(id)}".
                            </p>
                        </div>
                    </div>
                </div>`;
            return;
        }

        const statuses = (window.TicketSystem && TicketSystem.TICKET_STATUSES) || {
            open: { label: 'Open', color: '#3b82f6', icon: 'fa-folder-open' }
        };
        const priorities = (window.TicketSystem && TicketSystem.TICKET_PRIORITIES) || {
            medium: { label: 'Medium', color: '#3b82f6', icon: 'fa-minus' }
        };
        const st = statuses[ticket.status] || statuses.open;
        const pr = priorities[ticket.priority] || priorities.medium;

        resultBox.innerHTML = `
            <div class="ticket-status-card">
                <div class="ticket-status-header">
                    <span class="ticket-status-id">${Utils.esc(ticket.id)}</span>
                    <span class="ticket-status-badge" style="background: ${st.color}20; color: ${st.color};">
                        <i class="fas ${st.icon}"></i> ${st.label}
                    </span>
                </div>
                <h4 style="margin-bottom: var(--space-sm);">${Utils.esc(ticket.subject)}</h4>
                <div style="display: flex; gap: var(--space-lg); font-size: 0.8125rem; color: var(--text-muted); margin-bottom: var(--space-md); flex-wrap: wrap;">
                    <span><i class="fas fa-calendar"></i> ${Utils.formatDate(ticket.createdAt)}</span>
                    <span><i class="fas fa-clock"></i> ${Utils.timeAgo(ticket.updatedAt || ticket.createdAt)}</span>
                    <span style="color: ${pr.color};"><i class="fas ${pr.icon}"></i> ${pr.label}</span>
                </div>
                ${ticket.replies && ticket.replies.length ? `
                    <div class="ticket-timeline">
                        <p style="font-weight: 500; margin-bottom: var(--space-sm);">Replies:</p>
                        ${ticket.replies.map(r => `
                            <div class="ticket-timeline-item">
                                <span class="ticket-timeline-time">${Utils.formatDateTime(r.timestamp)}</span>
                                <span>${r.isAdmin ? '🛡️ Admin replied' : '📝 Your message'}</span>
                        </div>`).join('')}
                </div>` : `
                <p style="color: var(--text-muted); font-size: 0.875rem;">
                    <i class="fas fa-info-circle"></i> No replies yet. We'll respond soon.
                </p>`}
        </div>`;
    }
   
    trackBtn.addEventListener('click', track);
    trackInput.addEventListener('keypress', e => { if (e.key === 'Enter') track(); });
}


// ── CV Viewer (Preview + Download) ───────────────────────────
function initCvViewer() {
    const btn = document.getElementById('viewCvBtn');
    const btnText = document.getElementById('cvBtnText');
    if (!btn) return;

    const settings = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
    if (btnText && settings.cvButtonText) btnText.textContent = settings.cvButtonText;

    btn.addEventListener('click', () => {
        const s = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
        if (!s.cvFile) { Utils.showToast('CV not uploaded yet', 'warning'); return; }

        const fileName = s.cvFileName || 'CV.pdf';
        const isPdf = fileName.toLowerCase().endsWith('.pdf');

        const previewHtml = isPdf
            ? `<iframe src="${s.cvFile}" style="width:100%;height:75vh;border:none;border-radius:var(--radius-md);background:#fff;" title="CV Preview"></iframe>`
            : `<div style="text-align:center;padding:3rem 1rem;">
                <i class="fas fa-file-alt" style="font-size:4rem;color:var(--accent-primary);margin-bottom:1rem;"></i>
                <p style="color:var(--text-secondary);">Preview not available for this file type.</p>
                <p style="color:var(--text-muted);font-size:0.875rem;">${Utils.esc(fileName)}</p>
              </div>`;

        Utils.openModal('Curriculum Vitae', `
            <div style="position:relative;">
                ${previewHtml}
                <div style="position:absolute;top:-8px;right:-8px;display:flex;gap:0.5rem;">
                    <a href="${s.cvFile}" download="${Utils.esc(fileName)}"
                       class="btn btn-primary btn-sm"
                       style="box-shadow:var(--shadow-lg);"
                       title="Download CV">
                        <i class="fas fa-download"></i> Download
                    </a>
                </div>
            </div>
        `);

        const modal = document.getElementById('modal');
        if (modal) {
            modal.style.maxWidth = '900px';
            const closeBtn = document.getElementById('modalClose');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.maxWidth = '';
                }, { once: true });
            }
        }
    });
}

// ── Apply Admin Settings on Public Site ──────────────────────
function applySiteSettings() {
    const s = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
    if (!Object.keys(s).length) return;

    // Navbar avatar (uses profileImage)
    // Navbar avatar (uses profileImage)
    const navAvatar = document.getElementById('navAvatar');
    if (navAvatar) {
        if (s.profileImage) {
            navAvatar.innerHTML = `<span class="nav-avatar-logo"><span class="logo-bracket">&lt;</span><span class="logo-text">SH</span><span class="logo-bracket">/&gt;</span></span><img src="${s.profileImage}" alt="Profile">`;
        } else {
            navAvatar.innerHTML = `<span class="nav-avatar-logo"><span class="logo-bracket">&lt;</span><span class="logo-text">SH</span><span class="logo-bracket">/&gt;</span></span>`;
        }
    }

    // Hero terminal floating avatar (uses heroImage)
    const heroTerminal = document.querySelector('.hero-terminal');
    if (heroTerminal) {
        let heroAvatar = document.getElementById('heroProfileImg');
        if (s.heroImage) {
            if (!heroAvatar) {
                heroAvatar = document.createElement('div');
                heroAvatar.id = 'heroProfileImg';
                heroAvatar.title = 'Double-click for a surprise 🚀';
                heroTerminal.style.position = 'relative';
                heroTerminal.appendChild(heroAvatar);
                // Attach the rocket launcher once
                heroAvatar.addEventListener('dblclick', launchRocket);
            }
            // Preserve the rocket icon element if it exists
            if (!heroAvatar.querySelector('.rocket-icon')) {
                heroAvatar.innerHTML = `<img src="${s.heroImage}" alt="Profile">`;
            } else {
                // just update the image
                const img = heroAvatar.querySelector('img');
                if (img) img.src = s.heroImage;
            }
        } else if (heroAvatar) {
            heroAvatar.remove();
        }
    }

    // Navbar social links (right side)
    const navSocial = document.querySelector('.nav-social');
    if (navSocial) {
        const links = [];
        if (s.email) links.push(`<a href="mailto:${Utils.esc(s.email)}" title="Email"><i class="fas fa-envelope"></i></a>`);
        if (s.facebook) links.push(`<a href="${Utils.esc(s.facebook)}" target="_blank" rel="noopener" title="Facebook"><i class="fab fa-facebook-f"></i></a>`);
        if (s.linkedin) links.push(`<a href="${Utils.esc(s.linkedin)}" target="_blank" rel="noopener" title="LinkedIn"><i class="fab fa-linkedin-in"></i></a>`);
        if (s.twitter) links.push(`<a href="${Utils.esc(s.twitter)}" target="_blank" rel="noopener" title="Twitter"><i class="fab fa-twitter"></i></a>`);
        if (s.github) links.push(`<a href="${Utils.esc(s.github)}" target="_blank" rel="noopener" title="GitHub"><i class="fab fa-github"></i></a>`);
        if (links.length) navSocial.innerHTML = links.join('');
    }

    // Dynamic contact links
    const dyn = document.getElementById('dynamicContactLinks');
    if (dyn) {
        const extra = [];
        if (s.linkedin) extra.push(contactCard('LinkedIn', 'fab fa-linkedin-in', s.linkedin));
        if (s.facebook) extra.push(contactCard('Facebook', 'fab fa-facebook-f', s.facebook));
        if (s.twitter) extra.push(contactCard('Twitter', 'fab fa-twitter', s.twitter));
        if (s.github) extra.push(contactCard('GitHub', 'fab fa-github', s.github));
        dyn.innerHTML = extra.join('');
    }

    // Hero badge tagline
    if (s.tagline) {
        const badge = document.querySelector('.hero-badge span:last-child');
        if (badge) badge.textContent = s.tagline;
    }

    // Apply visibility toggles
    const visibility = s.visibility || {};
    const sectionMap = {
        about: 'about',
        experience: 'experience',
        technical: 'technical',
        projects: 'projects',
        certifications: 'certifications',
        education: 'education',
        learning: 'learning',
        gallery: 'gallery',
        contact: 'contact'
    };
    Object.entries(sectionMap).forEach(([key, id]) => {
        const section = document.getElementById(id);
        const navLink = document.querySelector(`.nav-link[data-section="${id}"]`);
        if (visibility[key] === false) {
            if (section) section.style.display = 'none';
            if (navLink) navLink.style.display = 'none';
        } else {
            if (section) section.style.display = '';
            if (navLink) navLink.style.display = '';
        }
    });
}

function contactCard(label, icon, url) {
    return `<a href="${Utils.esc(url)}" class="contact-card" target="_blank" rel="noopener">
        <div class="contact-icon"><i class="${icon}"></i></div>
        <div class="contact-details">
            <div class="contact-label">${label}</div>
            <div class="contact-value">${Utils.esc(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</div>
        </div>
    </a>`;
}

/* ============================================================
   CINEMATIC ROCKET LAUNCH
   Physics-driven, particle-rich, with screen shake + turbulence
   ============================================================ */

function launchRocket() {
    const avatar = document.getElementById('heroProfileImg');
    if (!avatar || avatar.classList.contains('rocket-mode')) return;

    // ── 1. Ignition phase (0.6s) — build tension ────────────
    const flash = document.createElement('div');
    flash.className = 'rocket-ignition-flash';
    avatar.appendChild(flash);

    // Flame element
    const flame = document.createElement('div');
    flame.className = 'rocket-flame';
    avatar.appendChild(flame);

    // Pad smoke ring
    const padSmoke = document.createElement('div');
    padSmoke.className = 'rocket-pad-smoke';
    const avatarRect = avatar.getBoundingClientRect();
    padSmoke.style.left = (avatarRect.left + avatarRect.width / 2 - 60) + 'px';
    padSmoke.style.top  = (avatarRect.top + avatarRect.height + 10) + 'px';
    padSmoke.style.width = '120px';
    padSmoke.style.height = '120px';
    document.body.appendChild(padSmoke);
    setTimeout(() => padSmoke.remove(), 1700);

    // Screen shake at ignition
    document.body.classList.add('rocket-shaking');
    setTimeout(() => document.body.classList.remove('rocket-shaking'), 900);

    // Swap avatar inner: hide old image, insert rocket craft
    const s = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
    avatar.classList.add('rocket-mode');
    avatar.dataset.originalInner = avatar.innerHTML;

    // SVG rocket — sharper than emoji, with fins + window
    avatar.innerHTML = `
        <div class="rocket-craft">
            <svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="#e5e7eb"/>
                        <stop offset="50%" stop-color="#ffffff"/>
                        <stop offset="100%" stop-color="#9ca3af"/>
                    </linearGradient>
                    <linearGradient id="finGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#ef4444"/>
                        <stop offset="100%" stop-color="#7f1d1d"/>
                    </linearGradient>
                </defs>
                <!-- Body -->
                <path d="M50 10 C 65 40, 68 90, 60 140 L 40 140 C 32 90, 35 40, 50 10 Z"
                      fill="url(#bodyGrad)" stroke="#374151" stroke-width="1.5"/>
                <!-- Nose cone -->
                <path d="M50 10 C 58 28, 60 42, 58 50 L 42 50 C 40 42, 42 28, 50 10 Z"
                      fill="#ef4444" opacity="0.9"/>
                <!-- Window -->
                <circle cx="50" cy="80" r="9" fill="#1e3a8a" stroke="#e5e7eb" stroke-width="2"/>
                <circle cx="47" cy="77" r="3" fill="#93c5fd" opacity="0.7"/>
                <!-- Left fin -->
                <path d="M40 110 L 20 155 L 40 145 Z" fill="url(#finGrad)"/>
                <!-- Right fin -->
                <path d="M60 110 L 80 155 L 60 145 Z" fill="url(#finGrad)"/>
                <!-- Bottom nozzle -->
                <rect x="42" y="140" width="16" height="10" rx="2" fill="#4b5563"/>
            </svg>
        </div>
    `;

    // ── 2. Liftoff phase (after ignition) ────────────────────
    const startTime = performance.now();
    const duration = 3200; // ms total flight
    const startRect = avatar.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Pre-compute a flight path with bezier-like control
    // Phase 1: 0-15%  — rise straight up with wobble
    // Phase 2: 15-55% — arc left, climb above viewport top
    // Phase 3: 55-90% — re-enter from right, descend
    // Phase 4: 90-100% — land back at origin
    function getFlightPos(t) {
        // t: 0..1
        const startX = 0, startY = 0;

        if (t < 0.15) {
            const p = t / 0.15;
            return {
                x: Math.sin(p * Math.PI * 4) * 8,   // subtle left-right wobble
                y: -p * 120,                         // rise 120px up
                rot: -20 + p * 20,                    // tilt from -20deg to 0deg
                scale: 1 + p * 0.1,
                blur: p * 1.2
            };
        } else if (t < 0.55) {
            const p = (t - 0.15) / 0.4;
            // Ease-out-quint for smooth acceleration to peak
            const eased = 1 - Math.pow(1 - p, 5);
            return {
                x: eased * (viewportW * 0.9),        // sweep right
                y: -120 - eased * (viewportH * 0.9), // climb high
                rot: eased * 45,
                scale: 1.1 - eased * 0.4,
                blur: 1.2 + eased * 2
            };
        } else if (t < 0.9) {
            const p = (t - 0.55) / 0.35;
            const eased = p * p;
            return {
                x: viewportW * 0.9 - eased * (viewportW * 1.1),
                y: -(viewportH * 0.9) + 120 + eased * (viewportH * 0.6),
                rot: 45 - eased * 30,
                scale: 0.7 + eased * 0.3,
                blur: 3.2 - eased * 2.5
            };
        } else {
            const p = (t - 0.9) / 0.1;
            const eased = 1 - Math.pow(1 - p, 3);
            return {
                x: (viewportW * -0.2) * (1 - eased),
                y: -120 * (1 - eased),
                rot: 15 - eased * 35,
                scale: 1 - eased * 0.05,
                blur: 0.7 - eased * 0.7
            };
        }
    }

    // Rocket tilt based on velocity
    let lastPos = getFlightPos(0);

    function flightLoop(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const pos = getFlightPos(t);

        // Transform the whole avatar
        avatar.style.transform =
            `translate(${pos.x}px, ${pos.y}px) ` +
            `rotate(${pos.rot}deg) scale(${pos.scale})`;

        // Apply motion blur to SVG
        const craft = avatar.querySelector('.rocket-craft');
        if (craft) craft.style.filter =
            `drop-shadow(0 0 8px rgba(255,180,80,0.7)) ` +
            `drop-shadow(0 0 20px rgba(255,90,30,0.5)) ` +
            `blur(${pos.blur}px)`;

        // Spawn particles continuously during flight
        spawnExhaustParticles(avatar, pos, lastPos);
        lastPos = pos;

        if (t < 1) {
            requestAnimationFrame(flightLoop);
        } else {
            // ── Landing cleanup ─────────────────────────────
            avatar.style.transform = '';
            avatar.classList.remove('rocket-mode');

            // Restore original avatar
            const s2 = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
            if (s2.heroImage) {
                avatar.innerHTML = `<img src="${s2.heroImage}" alt="Profile">`;
            } else {
                avatar.innerHTML = `<i class="fas fa-user-circle"></i>`;
            }

            // Re-enable double-click (remove old listener, reattach)
            avatar.removeEventListener('dblclick', launchRocket);
            setTimeout(() => avatar.addEventListener('dblclick', launchRocket), 100);
        }
    }
    requestAnimationFrame(flightLoop);
}

/**
 * Spawn the visual magic — fire, smoke, debris
 * Called every frame during flight.
 */
function spawnExhaustParticles(avatar, pos, lastPos) {
    const rect = avatar.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height;   // bottom of avatar

    // Velocity from last position → determines emission direction
    const vx = pos.x - lastPos.x;
    const vy = pos.y - lastPos.y;
    const speed = Math.hypot(vx, vy) || 1;
    const dirX = -vx / speed;
    const dirY = -vy / speed;

    // ── 1. Fire particles (2-3 per frame) ──────────────────
    const fireCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < fireCount; i++) {
        const p = document.createElement('div');
        p.className = 'rocket-particle';

        const size = 6 + Math.random() * 14;
        const hue  = 20 + Math.random() * 40;  // orange→yellow
        const light = 50 + Math.random() * 30;

        p.style.cssText = `
            left: ${cx + (Math.random() - 0.5) * 12}px;
            top:  ${cy + (Math.random() - 0.5) * 12}px;
            width: ${size}px;
            height: ${size}px;
            background: radial-gradient(circle,
                hsl(${hue}, 100%, 95%) 0%,
                hsl(${hue}, 100%, ${light}%) 40%,
                hsla(${hue}, 100%, 50%, 0.4) 75%,
                transparent 100%);
            filter: blur(1px);
            opacity: 1;
        `;
        document.body.appendChild(p);

        // Physics: initial velocity opposite to rocket + slight spread
        const vMag = 3 + Math.random() * 5;
        const angleJitter = (Math.random() - 0.5) * 0.8;
        const angle = Math.atan2(dirY, dirX) + angleJitter;

        animateParticle(p, {
            vx: Math.cos(angle) * vMag,
            vy: Math.sin(angle) * vMag,
            gravity: 0.15,
            life: 500 + Math.random() * 400,
            expand: 0.04,
            fadeStart: 0.3
        });
    }

    // ── 2. Smoke trail (1 every 3 frames during first phase) ─
    if (Math.random() < 0.35) {
        const smoke = document.createElement('div');
        smoke.className = 'rocket-smoke';
        const size = 40 + Math.random() * 60;
        smoke.style.cssText = `
            left: ${cx - size / 2}px;
            top:  ${cy - size / 2}px;
            width: ${size}px;
            height: ${size}px;
            opacity: ${0.6 + Math.random() * 0.3};
        `;
        document.body.appendChild(smoke);

        animateParticle(smoke, {
            vx: (Math.random() - 0.5) * 2 + dirX,
            vy: (Math.random() - 0.5) * 2 + dirY - 0.5,
            gravity: -0.05,
            life: 1200 + Math.random() * 800,
            expand: 0.15,
            fadeStart: 0.1
        });
    }

    // ── 3. Debris during high-speed sections ────────────────
    if (speed > 6 && Math.random() < 0.3) {
        const debris = document.createElement('div');
        debris.className = 'rocket-debris';
        debris.style.left = cx + 'px';
        debris.style.top  = cy + 'px';
        document.body.appendChild(debris);

        const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * 1.6;
        const vMag = 4 + Math.random() * 6;
        animateParticle(debris, {
            vx: Math.cos(angle) * vMag,
            vy: Math.sin(angle) * vMag,
            gravity: 0.35,
            life: 700 + Math.random() * 400,
            expand: 0,
            fadeStart: 0.5,
            rotate: (Math.random() - 0.5) * 720
        });
    }
}

/**
 * Generic particle animator — updates every rAF frame.
 */
function animateParticle(el, opts) {
    const start = performance.now();
    let x = 0, y = 0, rotation = 0, scale = 1;

    function tick(now) {
        const elapsed = now - start;
        const t = elapsed / opts.life;

        if (t >= 1) { el.remove(); return; }

        // Euler physics
        opts.vy += opts.gravity;
        x += opts.vx;
        y += opts.vy;

        // Scale up (for flames / smoke)
        if (opts.expand) scale = 1 + opts.expand * elapsed;

        // Rotation
        if (opts.rotate) rotation += opts.rotate * 0.016;

        // Opacity: full until fadeStart, then linear fade to 0
        let opacity = 1;
        if (t > opts.fadeStart) {
            opacity = 1 - (t - opts.fadeStart) / (1 - opts.fadeStart);
        }
        // Ease-in the fade
        opacity = Math.max(0, opacity * opacity);

        el.style.transform =
            `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
        el.style.opacity = opacity;

        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}


// ── Init on DOM ready ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initThemeSwitcher();
    initGlobalSearch();
    initCustomCursor();
    initTicketTracking();

    // Load fresh settings from Supabase before applying
    await loadRemoteSettings();

    initCvViewer();
    applySiteSettings();
});

// ── Load site settings from Supabase → localStorage ──────────
async function loadRemoteSettings() {
    try {
        const client = await initSupabase();
        const { data, error } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'main')
            .maybeSingle();

        if (error) throw error;
        if (!data?.value) return;

        Utils.setStorage(Utils.STORAGE_KEYS.SETTINGS, data.value);
        console.log('⬇️ Loaded public settings from Supabase');
    } catch (e) {
        console.warn('Could not load public settings:', e);
    }
}
