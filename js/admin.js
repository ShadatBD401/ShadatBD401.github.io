/* ============================================================
   ADMIN PANEL LOGIC
   ============================================================ */

// ── Admin State ──────────────────────────────────────────────
const adminState = {
    isAuthenticated: false,
    user: null,
    currentPage: 'dashboard',
    editingItem: null,
    editingType: null
};

// ── GitHub-backed content helpers ────────────────────────────
async function saveContentToGitHub(section, items, commitMsg) {
    const keyMap = {
        POSTS:          Utils.STORAGE_KEYS.POSTS,
        PROJECTS:       Utils.STORAGE_KEYS.PROJECTS,
        CERTIFICATIONS: Utils.STORAGE_KEYS.CERTS,   // ← map
        SKILLS:         Utils.STORAGE_KEYS.SKILLS
    };
    const key = keyMap[section.toUpperCase()];
    if (key) Utils.saveItems(key, items);

    if (!window.GitHubContent) {
        console.warn('[GitHub] not loaded — saving locally');
        return;
    }

    // Serialize saves per section
    window._githubSaveLocks = window._githubSaveLocks || {};
    const prev = window._githubSaveLocks[section] || Promise.resolve();

    window._githubSaveLocks[section] = prev.then(async () => {
        try {
            await window.GitHubContent.write(
                `data/${section}.json`,
                items,
                commitMsg || `Update ${section}`
            );
            console.log(`✅ ${section}.json pushed to GitHub`);
            Utils.showToast(`${section} synced to GitHub!`, 'success');
        } catch (err) {
            console.error(`GitHub save failed for ${section}:`, err);
            Utils.showToast(`Failed to sync ${section} to GitHub. Check console.`, 'error');
        }
    });

    return window._githubSaveLocks[section];
}

async function loadContentFromGitHub(section) {
    if (!window.GitHubContent) return null;
    try {
        const data = await window.GitHubContent.read(`data/${section}.json`);
        return data ? data.json : null;
    } catch (e) { return null; }
}

// ── Initialize ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Force dashboard page on load
    adminState.currentPage = 'dashboard';
    checkSession();
    initLogin();
    initSidebar();
    initModals();
    initPasswordToggle();
});

// ── Session Check ────────────────────────────────────────────
async function checkSession() {
    try {
        const supaSession = await window.SupabaseAuth.getSession();
        if (supaSession) {
            const session = {
                uid: supaSession.user.id,
                email: supaSession.user.email,
                loginAt: Date.now(),
                expiresAt: supaSession.expires_at * 1000
            };
            Utils.setStorage(Utils.STORAGE_KEYS.ADMIN_SESSION, session);
            adminState.isAuthenticated = true;
            adminState.user = session;
            showDashboard();
            return;
        }
    } catch (e) {
        console.warn('Supabase session check failed:', e);
    }

    const local = Utils.getStorage(Utils.STORAGE_KEYS.ADMIN_SESSION);
    if (local && local.expiresAt > Date.now()) {
        adminState.isAuthenticated = true;
        adminState.user = local;
        showDashboard();
    } else {
        showLogin();
    }
}

// ── Show Login ───────────────────────────────────────────────
function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) {
        loginScreen.classList.remove('hidden');
        loginScreen.style.display = '';       // ← reset to CSS default (flex)
    }
    if (dashboard) dashboard.classList.add('hidden');
}

// ── Show Dashboard ───────────────────────────────────────────
async function showDashboard() {
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('adminDashboard')?.classList.remove('hidden');
    
    const adminName = document.getElementById('adminName');
    if (adminName) adminName.textContent = adminState.user?.username || 'Administrator';
    
    // Always start on the dashboard page
    adminState.currentPage = 'dashboard';
    document.querySelectorAll('.sidebar-link').forEach(l => {
        l.classList.toggle('active', l.dataset.page === 'dashboard');
    });
    document.querySelectorAll('.admin-page').forEach(p => {
        p.classList.toggle('active', p.id === 'page-dashboard');
    });
   
    await loadDashboardData();
    setupPageNavigation();
    syncAllContentFromGitHub();   // ← add this line
}

// ── Sync every content file from GitHub into localStorage ────
async function syncAllContentFromGitHub() {
    if (!window.GitHubContent) return;
    const sections = [
        'posts', 'projects', 'certifications', 'skills',
        'education', 'experience', 'hero-stats',
        'about-domains', 'interests', 'contact-cards', 'matrix'
    ];
    for (const s of sections) {
        try {
            const data = await window.GitHubContent.read(`data/${s}.json`);
            if (data && Array.isArray(data.json) && data.json.length) {
                const keyMap = {
                    'posts': 'sh_posts', 'projects': 'sh_projects',
                    'certifications': 'sh_certifications', 'skills': 'sh_skills',
                    'education': 'sh_education', 'experience': 'sh_experience',
                    'hero-stats': 'sh_hero_stats', 'about-domains': 'sh_domains',
                    'interests': 'sh_interests', 'contact-cards': 'sh_contact_cards',
                    'matrix': 'sh_matrix'
                };
                const key = keyMap[s];
                if (key) Utils.setStorage(key, data.json);
                console.log(`⬇️ synced ${s}.json from GitHub`);
            }
        } catch (e) { /* file may not exist yet */ }
    }
}

// ── Login Handling ───────────────────────────────────────────
function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    
    form.addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');

    if (!email || !password) {
        Utils.showToast('Please enter email and password', 'error');
        return;
    }

    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    loginBtn.disabled = true;

    try {
        const data = await window.SupabaseAuth.signIn(email, password);
        const user = data.user;

        const session = {
            uid: user.id,
            email: user.email,
            loginAt: Date.now(),
            expiresAt: data.session.expires_at * 1000
        };

        Utils.setStorage(Utils.STORAGE_KEYS.ADMIN_SESSION, session);
        adminState.isAuthenticated = true;
        adminState.user = session;

        Utils.logActivity('admin_login', { email });
        Utils.showToast('Welcome back!', 'success');
        showDashboard();
    } catch (err) {
        console.error('Login error:', err);
        let msg = 'Login failed';
        if (err.message?.includes('Invalid login credentials')) msg = 'Invalid email or password';
        else if (err.message?.includes('Email not confirmed')) msg = 'Please confirm your email';
        else if (err.message?.includes('Failed to fetch')) msg = 'Network error — check console';
        Utils.showToast(msg, 'error');
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        loginBtn.disabled = false;
    }
}

// ── Logout ───────────────────────────────────────────────────
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to logout?')) return;

    try {
        await window.SupabaseAuth.signOut();
    } catch (e) {
        console.warn('Sign-out error:', e);
    }

    Utils.removeStorage(Utils.STORAGE_KEYS.ADMIN_SESSION);
    adminState.isAuthenticated = false;
    adminState.user = null;

    Utils.logActivity('admin_logout');
    Utils.showToast('Logged out successfully', 'info');

    setTimeout(() => window.location.href = 'index.html', 1000);
});

// ── Password Toggle ──────────────────────────────────────────
function initPasswordToggle() {
    const toggle = document.getElementById('passwordToggle');
    const password = document.getElementById('password');
    
    if (toggle && password) {
        toggle.addEventListener('click', () => {
            const type = password.type === 'password' ? 'text' : 'password';
            password.type = type;
            
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
            }
        });
    }
}

// ── Sidebar ──────────────────────────────────────────────────
function initSidebar() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('adminSidebar');
    
    sidebarToggle?.addEventListener('click', () => {
        sidebar?.classList.toggle('open');
    });
    
    // Close sidebar on outside click (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 &&
            sidebar?.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !sidebarToggle?.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

// ── Page Navigation ──────────────────────────────────────────
function setupPageNavigation() {
    const links = document.querySelectorAll('.sidebar-link');
    
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            if (page) navigateToPage(page);
        });
    });
    
    // Dashboard "View All" links
    document.querySelectorAll('[data-page]').forEach(el => {
        if (!el.classList.contains('sidebar-link')) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                navigateToPage(el.dataset.page);
            });
        }
    });
}

function navigateToPage(page) {
    // Update sidebar
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });
    
    // Update pages
    document.querySelectorAll('.admin-page').forEach(p => {
        p.classList.toggle('active', p.id === `page-${page}`);
    });
    
    adminState.currentPage = page;
    
    // Load page data
    switch (page) {
        case 'dashboard':     loadDashboardData();     break;
        case 'tickets':       loadTicketsPage();       break;
        case 'posts':         loadPostsPage();         break;
        case 'projects':      loadProjectsPage();      break;
        case 'certifications':loadCertificationsPage();break;
        case 'skills':        loadSkillsPage();        break;
        case 'notes':         loadNotesPageAdmin();    break;
        case 'education':     loadEducationPage();     break;
        case 'experience':    loadExperiencePage();    break;
        case 'hero':          loadHeroPage();          break;
        case 'about':         loadAboutPage();         break;
        case 'contact-info':  loadContactCardsPage();  break;
        case 'matrix':        loadMatrixPage();        break;
        case 'activity':      loadActivityPage();      break;
        case 'settings':      loadSettingsPage();      break;
        case 'gallery':       renderAdminGallery?.();  break;
        case 'videos':        renderAdminVideos?.();   break;
    }
   
    // Close sidebar on mobile
    if (window.innerWidth <= 1024) {
        document.getElementById('adminSidebar')?.classList.remove('open');
    }
}

// ── Dashboard Data ───────────────────────────────────────────
async function loadDashboardData() {
    // Load tickets from Supabase FIRST, then compute stats
    try {
        if (window.SupabaseTickets) {
            const rows = await window.SupabaseTickets.listAll();
            TicketSystem.ticketState.tickets = rows.map(r => ({
                id: r.ticket_id,
                name: r.name,
                email: r.email,
                subject: r.subject,
                message: r.message,
                status: r.status,
                priority: r.priority,
                category: r.category,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
                replies: r.replies || [],
                history: []
            }));
        } else {
            await TicketSystem.loadTickets();
        }
    } catch (err) {
        console.warn('Dashboard ticket load failed, using cache:', err);
        await TicketSystem.loadTickets();
    }

    const stats = TicketSystem.getTicketStats();   

    // ── Update sidebar Tickets badge ──────────────────────────
    const badge = document.getElementById('ticketsBadge');
    if (badge) {
        badge.textContent = stats.total;
        // Hide badge if 0, show if > 0
        badge.style.display = stats.total > 0 ? '' : 'none';
    }
   
    // Update stats grid
    const statsGrid = document.getElementById('statsGrid');

    if (statsGrid) {
        statsGrid.innerHTML = `
            ${createStatCard('Total Tickets', stats.total, 'fa-ticket-alt', 'blue', 'tickets', 'all')}
            ${createStatCard('Open', stats.open, 'fa-folder-open', 'green', 'tickets', 'open')}
            ${createStatCard('Pending', stats.pending, 'fa-clock', 'yellow', 'tickets', 'pending')}
            ${createStatCard('Resolved', stats.resolved, 'fa-check-circle', 'purple', 'tickets', 'resolved')}
            ${createStatCard('Critical', stats.critical, 'fa-exclamation-triangle', 'red', 'tickets', 'critical')}
            ${createStatCard('Posts', Utils.getItems(Utils.STORAGE_KEYS.POSTS).length, 'fa-blog', 'cyan', 'posts', null)}
        `;

        // Wire click handlers
        statsGrid.querySelectorAll('.stat-card[data-target-page]').forEach(card => {
            card.addEventListener('click', () => {
                const page = card.dataset.targetPage;
                const status = card.dataset.targetStatus;
                navigateToPage(page);
                // If we're navigating to tickets with a status filter
                if (page === 'tickets' && status) {
                    setTimeout(() => {
                        document.querySelectorAll('#ticketFilterButtons .filter-btn').forEach(b => {
                            b.classList.toggle('active', b.dataset.status === status);
                        });
                        renderTicketsList(status);
                    }, 100);
                }
            });
        });
    }
    // Load recent tickets
    loadRecentTickets();
    
    // Load recent activity
    loadRecentActivity();
}

function createStatCard(label, value, icon, color, targetPage = null, targetStatus = null) {
    const clickable = targetPage ? 'style="cursor:pointer"' : '';
    const dataAttrs = targetPage
        ? `data-target-page="${targetPage}" data-target-status="${targetStatus || ''}"`
        : '';
    return `
        <div class="stat-card" ${clickable} ${dataAttrs}>
            <div class="stat-card-header">
                <div class="stat-card-icon ${color}">
                    <i class="fas ${icon}"></i>
                </div>
            </div>
            <div class="stat-card-value">${value}</div>
            <div class="stat-card-label">${label}</div>
        </div>
    `;
}

function loadRecentTickets() {
    const container = document.getElementById('recentTickets');
    if (!container) return;
    
    const tickets = TicketSystem.ticketState.tickets.slice(0, 5);
    
    if (tickets.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 2rem;">
                <i class="fas fa-inbox"></i>
                <h3>No tickets yet</h3>
                <p>Tickets from the contact form will appear here.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tickets.map(ticket => {
        const status = TicketSystem.TICKET_STATUSES[ticket.status] || TicketSystem.TICKET_STATUSES.open;
        return `
            <div class="ticket-card" onclick="TicketSystem.openTicketDetail(TicketSystem.getTicket('${ticket.id}'))">
                <div class="ticket-card-content">
                    <span class="ticket-card-id">${Utils.esc(ticket.id)}</span>
                    <span class="ticket-card-subject">${Utils.esc(ticket.subject)}</span>
                    <div class="ticket-card-meta">
                        <span><i class="fas fa-user"></i> ${Utils.esc(ticket.name)}</span>
                        <span><i class="fas fa-clock"></i> ${Utils.timeAgo(ticket.createdAt)}</span>
                    </div>
                </div>
                <div class="ticket-card-status">
                    <span class="ticket-status" style="background: ${status.color}20; color: ${status.color};">
                        <i class="fas ${status.icon}"></i>
                        ${status.label}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function loadRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;
    
    const activities = Utils.getActivityLog().slice(0, 10);
    
    if (activities.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 2rem;">
                <i class="fas fa-history"></i>
                <h3>No activity yet</h3>
                <p>Admin actions will be logged here.</p>
            </div>
        `;
        return;
    }
    
    const icons = {
        ticket_created: 'fa-ticket-alt',
        ticket_status_updated: 'fa-exchange-alt',
        ticket_deleted: 'fa-trash',
        admin_login: 'fa-sign-in-alt',
        admin_logout: 'fa-sign-out-alt',
        post_created: 'fa-plus',
        post_updated: 'fa-edit',
        post_deleted: 'fa-trash'
    };
    
    container.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas ${icons[activity.action] || 'fa-info-circle'}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-text">${formatActivityText(activity)}</div>
                <div class="activity-time">${Utils.timeAgo(activity.timestamp)}</div>
            </div>
        </div>
    `).join('');
}

function formatActivityText(activity) {
    const texts = {
        ticket_created: `Ticket created: ${activity.details?.subject || ''}`,
        ticket_status_updated: `Ticket status changed: ${activity.details?.from} → ${activity.details?.to}`,
        ticket_deleted: `Ticket deleted: ${activity.details?.subject || ''}`,
        admin_login: 'Admin logged in',
        admin_logout: 'Admin logged out',
        post_created: `Post created: ${activity.details?.title || ''}`,
        post_updated: `Post updated: ${activity.details?.title || ''}`,
        post_deleted: `Post deleted: ${activity.details?.title || ''}`
    };
    
    return texts[activity.action] || activity.action;
}

// ── Tickets Page ─────────────────────────────────────────────
async function loadTicketsPage() {
    // Load from Supabase
    try {
        if (window.SupabaseTickets) {
            const rows = await window.SupabaseTickets.listAll();
            // Convert Supabase rows to the shape TicketSystem expects
            ticketState.tickets = rows.map(r => ({
                id: r.ticket_id,
                name: r.name,
                email: r.email,
                subject: r.subject,
                message: r.message,
                status: r.status,
                priority: r.priority,
                category: r.category,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
                replies: r.replies || [],
                history: []
            }));
        } else {
            TicketSystem.loadTickets();
        }
    } catch (err) {
        console.warn('Supabase ticket load failed, using localStorage:', err);
        TicketSystem.loadTickets();
    }

    updateTicketStats();
    renderTicketsList();
    
    // Setup filter buttons
    document.querySelectorAll('#ticketFilterButtons .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#ticketFilterButtons .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTicketsList(btn.dataset.status);
        });
    });
    
    // Setup search
    const searchInput = document.getElementById('ticketSearch');
    if (searchInput) {
        searchInput.addEventListener('input', Utils.debounce(() => {
            const activeFilter = document.querySelector('#ticketFilterButtons .filter-btn.active');
            renderTicketsList(activeFilter?.dataset.status || 'all', searchInput.value);
        }, 300));
    }
}

function updateTicketStats() {
    const stats = TicketSystem.getTicketStats();
    const container = document.getElementById('ticketStats');
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="ticket-stat ${adminState.currentFilter === 'all' ? 'active' : ''}" data-status="all">
            <div class="ticket-stat-value">${stats.total}</div>
            <div class="ticket-stat-label">All</div>
        </div>
        <div class="ticket-stat" data-status="open">
            <div class="ticket-stat-value" style="color: #3b82f6;">${stats.open}</div>
            <div class="ticket-stat-label">Open</div>
        </div>
        <div class="ticket-stat" data-status="pending">
            <div class="ticket-stat-value" style="color: #f59e0b;">${stats.pending}</div>
            <div class="ticket-stat-label">Pending</div>
        </div>
        <div class="ticket-stat" data-status="in_progress">
            <div class="ticket-stat-value" style="color: #8b5cf6;">${stats.inProgress}</div>
            <div class="ticket-stat-label">In Progress</div>
        </div>
        <div class="ticket-stat" data-status="resolved">
            <div class="ticket-stat-value" style="color: #10b981;">${stats.resolved}</div>
            <div class="ticket-stat-label">Resolved</div>
        </div>
        <div class="ticket-stat" data-status="closed">
            <div class="ticket-stat-value" style="color: #64748b;">${stats.closed}</div>
            <div class="ticket-stat-label">Closed</div>
        </div>
    `;
    
    // Click handlers
    container.querySelectorAll('.ticket-stat').forEach(stat => {
        stat.addEventListener('click', () => {
            const status = stat.dataset.status;
            document.querySelectorAll('#ticketFilterButtons .filter-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.status === status);
            });
            renderTicketsList(status);
        });
    });
}

function renderTicketsList(status = 'all', search = '') {
    const container = document.getElementById('ticketsContainer');
    if (!container) return;
    
    const tickets = TicketSystem.filterTickets(status, search);
    
    if (tickets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No tickets found</h3>
                <p>${status !== 'all' ? `No ${status} tickets.` : 'No tickets have been created yet.'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tickets.map(ticket => {
        const statusInfo = TicketSystem.TICKET_STATUSES[ticket.status];
        const priority = TicketSystem.TICKET_PRIORITIES[ticket.priority];
        
        return `
            <div class="ticket-card" data-id="${ticket.id}" style="grid-template-columns: 1fr auto;">
                <div class="ticket-card-content">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <span class="ticket-card-id">${Utils.esc(ticket.id)}</span>
                        <span class="ticket-priority" style="background: ${priority.color}20; color: ${priority.color}; padding: 2px 8px; border-radius: 4px; font-size: 0.6875rem;">
                            <i class="fas ${priority.icon}"></i> ${priority.label}
                        </span>
                    </div>
                    <span class="ticket-card-subject">${Utils.esc(ticket.subject)}</span>
                    <p style="font-size: 0.875rem; color: var(--text-secondary); margin: 0.5rem 0;">
                        ${Utils.esc(Utils.truncate(ticket.message, 120))}
                    </p>
                    <div class="ticket-card-meta">
                        <span><i class="fas fa-user"></i> ${Utils.esc(ticket.name)}</span>
                        <span><i class="fas fa-envelope"></i> ${Utils.esc(ticket.email)}</span>
                        <span><i class="fas fa-clock"></i> ${Utils.timeAgo(ticket.createdAt)}</span>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                    <span class="ticket-status" style="background: ${statusInfo.color}20; color: ${statusInfo.color};">
                        <i class="fas ${statusInfo.icon}"></i> ${statusInfo.label}
                    </span>
                    <div style="display: flex; gap: 0.25rem;">
                        <button class="admin-item-btn" onclick="event.stopPropagation(); changeTicketStatus('${ticket.id}')" title="Change Status">
                            <i class="fas fa-exchange-alt"></i>
                        </button>
                        <button class="admin-item-btn delete" onclick="event.stopPropagation(); deleteTicketConfirm('${ticket.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Click handlers
    container.querySelectorAll('.ticket-card').forEach(card => {
        card.addEventListener('click', () => {
            const ticket = TicketSystem.getTicket(card.dataset.id);
            if (ticket) openAdminTicketDetail(ticket);
        });
    });
}

// ── Change Ticket Status ─────────────────────────────────────
window.changeTicketStatus = function(ticketId) {
    const ticket = TicketSystem.getTicket(ticketId);
    if (!ticket) return;
    
    const statusOptions = Object.entries(TicketSystem.TICKET_STATUSES)
        .map(([key, val]) => `<option value="${key}" ${ticket.status === key ? 'selected' : ''}>${val.label}</option>`)
        .join('');
    
    Utils.openModal('Change Ticket Status', `
        <div class="admin-form">
            <div class="form-group">
                <label>Ticket ID</label>
                <input type="text" value="${Utils.esc(ticket.id)}" disabled>
            </div>
            <div class="form-group">
                <label>Current Status</label>
                <input type="text" value="${TicketSystem.TICKET_STATUSES[ticket.status].label}" disabled>
            </div>
            <div class="form-group">
                <label for="newStatus">New Status</label>
                <select id="newStatus">
                    ${statusOptions}
                </select>
            </div>
            <div class="form-group">
                <label for="statusNote">Note (optional)</label>
                <textarea id="statusNote" rows="3" placeholder="Add a note about this status change..."></textarea>
            </div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="confirmStatusChange('${ticket.id}')">
                    <i class="fas fa-check"></i> Update Status
                </button>
            </div>
        </div>
    `);
};

window.confirmStatusChange = async function(ticketId) {
    const newStatus = document.getElementById('newStatus').value;
    const note = document.getElementById('statusNote').value;

    try {
        if (window.SupabaseTickets) {
            await window.SupabaseTickets.updateStatus(ticketId, newStatus, note);
        } else {
            TicketSystem.updateTicketStatus(ticketId, newStatus, note);
        }
        Utils.closeModal();
        Utils.showToast('Ticket status updated', 'success');
        loadTicketsPage();
    } catch (err) {
        Utils.showToast('Failed to update status', 'error');
    }
};

window.submitReply = async function(ticketId) {
    const message = document.getElementById('replyMessage').value.trim();
    if (!message) {
        Utils.showToast('Please enter a reply message', 'error');
        return;
    }

    const btn = event?.target?.closest('button');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...'; }

    try {
        if (window.SupabaseTickets) {
            await window.SupabaseTickets.addReply(ticketId, message, true);
            console.log('✅ Reply saved to Supabase');
        } else {
            TicketSystem.addTicketReply(ticketId, message, true);
            console.warn('⚠️ Supabase not available — reply saved locally only');
        }

        Utils.closeModal();
        Utils.showToast('Reply sent', 'success');

        // Refresh the tickets list and reopen detail with fresh data
        await loadTicketsPage();

        const ticket = TicketSystem.getTicket(ticketId);
        if (ticket) openAdminTicketDetail(ticket);

    } catch (err) {
        console.error('Reply failed:', err);
        Utils.showToast('Failed to send reply: ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reply'; }
    }
};

// ── Delete Ticket ────────────────────────────────────────────
window.deleteTicketConfirm = async function(ticketId) {
    if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
        return;
    }

    try {
        // Delete from Supabase
        if (window.SupabaseTickets && window.SupabaseTickets.deleteByTicketId) {
            await window.SupabaseTickets.deleteByTicketId(ticketId);
        } else {
            // Fallback: delete directly via Supabase client
            const client = await initSupabase();
            const { error } = await client
                .from('tickets')
                .delete()
                .eq('ticket_id', ticketId);
            if (error) throw error;
        }

        // Remove from local state
        TicketSystem.ticketState.tickets =
            TicketSystem.ticketState.tickets.filter(t => t.id !== ticketId);
        TicketSystem.saveTickets();

        Utils.logActivity('ticket_deleted', { ticketId });
        Utils.showToast('Ticket deleted from Supabase', 'success');

        renderTicketsList();
        updateTicketStats();
        loadDashboardData();
    } catch (err) {
        console.error('Ticket delete failed:', err);
        Utils.showToast('Failed to delete ticket: ' + err.message, 'error');
    }
};

window.toggleItemVisibility = async function (section, itemId) {
    // Map section → storage key (handles certifications → CERTS)
    const keyMap = {
        posts:          Utils.STORAGE_KEYS.POSTS,
        projects:       Utils.STORAGE_KEYS.PROJECTS,
        certifications: Utils.STORAGE_KEYS.CERTS,   // ← special case
        skills:         Utils.STORAGE_KEYS.SKILLS
    };
    const key = keyMap[section];
    if (!key) { Utils.showToast('Unknown section: ' + section, 'error'); return; }

    // And map section → GitHub file name
    const ghFileMap = {
        posts:          'posts',
        projects:       'projects',
        certifications: 'certifications',   // matches data/certifications.json
        skills:         'skills'
    };
    const ghFile = ghFileMap[section];

    const items = Utils.getItems(key);
    const item = items.find(i => i.id === itemId);
    if (!item) { Utils.showToast('Item not found', 'error'); return; }

    item.hidden = !item.hidden;
    Utils.saveItems(key, items);

    await saveContentToGitHub(
        ghFile,
        items,
        item.hidden ? `Hide: ${item.title}` : `Show: ${item.title}`
    );

    Utils.showToast(
        item.hidden ? `"${item.title}" is now hidden` : `"${item.title}" is now visible`,
        'success'
    );

    if (section === 'posts')          renderPostsList();
    if (section === 'projects')       renderProjectsList();
    if (section === 'certifications') renderCertsList();
    if (section === 'skills')         renderSkillsList();
};

// ── Open Admin Ticket Detail ─────────────────────────────────
function openAdminTicketDetail(ticket) {
    const status = TicketSystem.TICKET_STATUSES[ticket.status];
    const priority = TicketSystem.TICKET_PRIORITIES[ticket.priority];
    
    const content = `
        <div class="ticket-detail">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <span class="ticket-id" style="font-family: var(--font-mono); color: var(--accent-primary);">${Utils.esc(ticket.id)}</span>
                <span class="ticket-status" style="background: ${status.color}20; color: ${status.color};">
                    <i class="fas ${status.icon}"></i> ${status.label}
                </span>
            </div>
            
            <h2 style="margin-bottom: 1rem;">${Utils.esc(ticket.subject)}</h2>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 0.5rem;">
                <div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">FROM</span>
                    <p style="font-weight: 500;">${Utils.esc(ticket.name)}</p>
                </div>
                <div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">EMAIL</span>
                    <p><a href="mailto:${Utils.esc(ticket.email)}" style="color: var(--accent-primary);">${Utils.esc(ticket.email)}</a></p>
                </div>
                <div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">CATEGORY</span>
                    <p>${TicketSystem.TICKET_CATEGORIES[ticket.category]?.label || 'General'}</p>
                </div>
                <div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">PRIORITY</span>
                    <p style="color: ${priority.color};">${priority.label}</p>
                </div>
                <div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">CREATED</span>
                    <p>${Utils.formatDateTime(ticket.createdAt)}</p>
                </div>
                <div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">LAST UPDATED</span>
                    <p>${Utils.timeAgo(ticket.updatedAt)}</p>
                </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 0.5rem;">Message</h4>
                <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: 0.5rem;">
                    ${Utils.esc(ticket.message).replace(/\n/g, '<br>')}
                </div>
            </div>
            
            ${ticket.replies && ticket.replies.length > 0 ? `
                <div style="margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 0.5rem;">Replies (${ticket.replies.length})</h4>
                    ${ticket.replies.map(reply => `
                        <div style="padding: 1rem; background: ${reply.isAdmin ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)'}; border-radius: 0.5rem; margin-bottom: 0.5rem; border-left: 3px solid ${reply.isAdmin ? 'var(--accent-primary)' : 'var(--text-muted)'};">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span style="font-weight: 500; font-size: 0.875rem;">
                                    <i class="fas ${reply.isAdmin ? 'fa-shield-alt' : 'fa-user'}"></i>
                                    ${reply.isAdmin ? 'Admin' : Utils.esc(ticket.name)}
                                </span>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">${Utils.timeAgo(reply.timestamp)}</span>
                            </div>
                            <p>${Utils.esc(reply.message).replace(/\n/g, '<br>')}</p>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <div style="margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 0.5rem;">Add Reply</h4>
                <textarea id="replyMessage" rows="4" placeholder="Type your reply..." style="width: 100%; padding: 1rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 0.5rem; color: var(--text-primary);"></textarea>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                    <button class="btn btn-primary btn-sm" onclick="submitReply('${ticket.id}')">
                        <i class="fas fa-paper-plane"></i> Send Reply
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="changeTicketStatus('${ticket.id}')">
                        <i class="fas fa-exchange-alt"></i> Change Status
                    </button>
                </div>
            </div>
            
            ${ticket.history && ticket.history.length > 0 ? `
                <div>
                    <h4 style="margin-bottom: 0.5rem;">History</h4>
                    <ul style="list-style: none; font-size: 0.875rem;">
                        ${ticket.history.map(h => `
                            <li style="display: flex; gap: 1rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color);">
                                <span style="color: var(--text-muted); font-family: var(--font-mono); font-size: 0.75rem; min-width: 140px;">
                                    ${Utils.formatDateTime(h.timestamp)}
                                </span>
                                <span>${Utils.esc(h.note)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
    
    Utils.openModal('Ticket Details', content);
}

// ── Posts Page ───────────────────────────────────────────────
function loadPostsPage() {
    renderPostsList();
    
    // Setup new post button
    const newBtn = document.getElementById('newPostBtn');
    if (newBtn) {
        newBtn.onclick = () => openPostForm();
    }
}

function renderPostsList() {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    const posts = Utils.sortByOrder(Utils.getItems(Utils.STORAGE_KEYS.POSTS), { includeHidden: true });
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-blog"></i>
                <h3>No posts yet</h3>
                <p>Create your first blog post to share your knowledge.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="items-container">
            ${posts.map(post => `
                <div class="admin-item-card" data-id="${post.id}" style="${post.hidden ? 'opacity: 0.55;' : ''}">
                    <div class="admin-item-header">
                        <div class="admin-item-icon">${Utils.esc(post.emoji || '📝')}</div>
                        <div class="admin-item-actions">
                            <button class="admin-item-btn" onclick="toggleItemVisibility('posts', '${post.id}')"
                                    title="${post.hidden ? 'Show to visitors' : 'Hide from visitors'}">
                                <i class="fas ${post.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
                            </button>
                            <button class="admin-item-btn" onclick="editPost('${post.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="admin-item-btn delete" onclick="deletePostConfirm('${post.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>                       
                    </div>
                    <h4 class="admin-item-title">
                        ${Utils.esc(post.title)}
                        ${post.hidden ? '<span style="font-size:0.625rem;background:var(--accent-warning);color:white;padding:2px 6px;border-radius:4px;margin-left:6px;text-transform:uppercase;font-weight:600;">Hidden</span>' : ''}
                    </h4>               
                    <p class="admin-item-desc">${Utils.esc(post.summary || Utils.truncate(post.content, 100))}</p>
                    <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
                        <span class="tag" style="font-size: 0.6875rem;">${Utils.esc(post.category)}</span>
                        <span style="font-size: 0.6875rem; color: var(--text-muted);">${Utils.formatDate(post.createdAt)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Enable drag & drop
    makeSortable('postsContainer', 'posts', reorderPosts);
}

window.openPostForm = function(post = null) {
    const isEdit = !!post;
    const categories = ['network', 'system', 'cloud', 'cybersecurity', 'other'];
    
    Utils.openModal(isEdit ? 'Edit Post' : 'New Post', `
        <div class="admin-form">
            <div class="form-group">
                <label for="postTitle">Title *</label>
                <input type="text" id="postTitle" value="${post ? Utils.esc(post.title) : ''}" placeholder="Enter post title">
            </div>
            <div class="form-group">
                <label for="postCategory">Category *</label>
                <select id="postCategory">
                    ${categories.map(c => `<option value="${c}" ${post?.category === c ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="postEmoji">Emoji Icon</label>
                <input type="text" id="postEmoji" value="${post ? Utils.esc(post.emoji || '📝') : '📝'}" maxlength="2" placeholder="📝">
            </div>
            <div class="form-group">
                <label for="postSummary">Summary</label>
                <input type="text" id="postSummary" value="${post ? Utils.esc(post.summary || '') : ''}" placeholder="Brief summary of the post">
            </div>
            <div class="form-group">
                <label for="postContent">Content *</label>
                <textarea id="postContent" rows="10" placeholder="Write your content here... (Markdown supported)">${post ? Utils.esc(post.content) : ''}</textarea>
            </div>
            <div class="form-group">
                <label for="postTags">Tags (comma separated)</label>
                <input type="text" id="postTags" value="${post ? Utils.esc(post.tags || '') : ''}" placeholder="networking, cisco, security">
            </div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="savePost('${post?.id || ''}')">
                    <i class="fas fa-save"></i> ${isEdit ? 'Update' : 'Create'}
                </button>
            </div>
        </div>
    `);
};

window.savePost = function(postId) {
    const title = document.getElementById('postTitle').value.trim();
    const category = document.getElementById('postCategory').value;
    const emoji = document.getElementById('postEmoji').value.trim() || '📝';
    const summary = document.getElementById('postSummary').value.trim();
    const content = document.getElementById('postContent').value.trim();
    const tags = document.getElementById('postTags').value.trim();
    
    if (!title || !content) {
        Utils.showToast('Title and content are required', 'error');
        return;
    }
    
    const posts = Utils.getItems(Utils.STORAGE_KEYS.POSTS);
    
    if (postId) {
        // Update existing
        const index = posts.findIndex(p => p.id === postId);
        if (index > -1) {
            posts[index] = {
                ...posts[index],
                title,
                category,
                emoji,
                summary,
                content,
                tags,
                updatedAt: new Date().toISOString()
            };
            Utils.logActivity('post_updated', { title });
        }
    } else {
        // Create new
        posts.unshift({
            id: Utils.uid(),
            title,
            category,
            emoji,
            summary,
            content,
            tags,
            createdAt: new Date().toISOString(),
            order: 0,
            views: 0
        });
        Utils.logActivity('post_created', { title });
    }

    // Update order
    posts.forEach((p, i) => p.order = i);
    
    Utils.saveItems(Utils.STORAGE_KEYS.POSTS, posts);
    saveContentToGitHub('posts', posts, postId ? `Update post: ${title}` : `New post: ${title}`);
    Utils.closeModal();
    Utils.showToast(postId ? 'Post updated' : 'Post created', 'success');
    renderPostsList();
};

window.editPost = function(postId) {
    const post = Utils.getItems(Utils.STORAGE_KEYS.POSTS).find(p => p.id === postId);
    if (post) openPostForm(post);
};

window.deletePostConfirm = async function(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    const posts = Utils.getItems(Utils.STORAGE_KEYS.POSTS);
    const post = posts.find(p => p.id === postId);
    const filtered = posts.filter(p => p.id !== postId);
    
    Utils.saveItems(Utils.STORAGE_KEYS.POSTS, filtered);
    Utils.logActivity('post_deleted', { title: post?.title });
    renderPostsList();

    // Push the updated list to GitHub (this removes the post from the repo)
    await saveContentToGitHub('posts', filtered, `Delete post: ${post?.title || postId}`);
    Utils.showToast('Post deleted', 'success');
};

// ── Projects Page ────────────────────────────────────────────
function loadProjectsPage() {
    renderProjectsList();
    
    const newBtn = document.getElementById('newProjectBtn');
    if (newBtn) {
        newBtn.onclick = () => openProjectForm();
    }
}

function renderProjectsList() {
    const container = document.getElementById('projectsContainer');
    if (!container) return;
    
    const projects = Utils.sortByOrder(Utils.getItems(Utils.STORAGE_KEYS.PROJECTS), { includeHidden: true });
    
    if (projects.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-project-diagram"></i>
                <h3>No projects yet</h3>
                <p>Add your first project to showcase your work.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = projects.map(project => `
        <div class="admin-item-card" data-id="${project.id}" style="${project.hidden ? 'opacity: 0.55;' : ''}">
            <div class="admin-item-header">
                <div class="admin-item-icon"><i class="fas fa-project-diagram"></i></div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn" onclick="toggleItemVisibility('projects', '${project.id}')"
                            title="${project.hidden ? 'Show to visitors' : 'Hide from visitors'}">
                        <i class="fas ${project.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button class="admin-item-btn" onclick="editProject('${project.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="admin-item-btn delete" onclick="deleteProjectConfirm('${project.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>               
            </div>
            <h4 class="admin-item-title">
                ${Utils.esc(project.title)}
                ${project.hidden ? '<span style="font-size:0.625rem;background:var(--accent-warning);color:white;padding:2px 6px;border-radius:4px;margin-left:6px;text-transform:uppercase;font-weight:600;">Hidden</span>' : ''}
            </h4>
            <p class="admin-item-desc">${Utils.esc(Utils.truncate(project.description, 100))}</p>
        </div>
    `).join('');
    
    // Enable drag & drop
    makeSortable('projectsContainer', 'projects', reorderProjects);
}

window.openProjectForm = function(project = null) {
    const isEdit = !!project;
    
    Utils.openModal(isEdit ? 'Edit Project' : 'New Project', `
        <div class="admin-form">
            <div class="form-group">
                <label for="projectTitle">Title *</label>
                <input type="text" id="projectTitle" value="${project ? Utils.esc(project.title) : ''}" placeholder="Project title">
            </div>
            <div class="form-group">
                <label for="projectDesc">Description *</label>
                <textarea id="projectDesc" rows="6" placeholder="Describe the project... (Use • for bullet points)">${project ? Utils.esc(project.description) : ''}</textarea>
            </div>
            <div class="form-group">
                <label for="projectTags">Tags (pipe separated)</label>
                <input type="text" id="projectTags" value="${project ? Utils.esc(project.tags || '') : ''}" placeholder="VLAN|ACL|Routing">
            </div>
            <div class="form-group">
                <label for="projectLink">Link</label>
                <input type="url" id="projectLink" value="${project ? Utils.esc(project.link || '') : ''}" placeholder="https://...">
            </div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveProject('${project?.id || ''}')">
                    <i class="fas fa-save"></i> ${isEdit ? 'Update' : 'Create'}
                </button>
            </div>
        </div>
    `);
};

window.saveProject = function(projectId) {
    const title = document.getElementById('projectTitle').value.trim();
    const description = document.getElementById('projectDesc').value.trim();
    const tags = document.getElementById('projectTags').value.trim();
    const link = document.getElementById('projectLink').value.trim();
    
    if (!title || !description) {
        Utils.showToast('Title and description are required', 'error');
        return;
    }
    
    const projects = Utils.getItems(Utils.STORAGE_KEYS.PROJECTS);
    
    if (projectId) {
        const index = projects.findIndex(p => p.id === projectId);
        if (index > -1) {
            projects[index] = { ...projects[index], title, description, tags, link, updatedAt: new Date().toISOString() };
        }
    } else {
        projects.unshift({
            id: Utils.uid(),
            title,
            description,
            tags,
            link,
            createdAt: new Date().toISOString(),
            order: 0
        });
    }

    projects.forEach((p, i) => p.order = i);
    Utils.saveItems(Utils.STORAGE_KEYS.PROJECTS, projects);
    saveContentToGitHub('projects', projects, projectId ? `Update project: ${title}` : `New project: ${title}`);
    Utils.closeModal();
    Utils.showToast(projectId ? 'Project updated' : 'Project created', 'success');
    renderProjectsList();
};

window.editProject = function(projectId) {
    const project = Utils.getItems(Utils.STORAGE_KEYS.PROJECTS).find(p => p.id === projectId);
    if (project) openProjectForm(project);
};

window.deleteProjectConfirm = async function(projectId) {
    if (!confirm('Are you sure you want to delete this project?')) return;

    const all = Utils.getItems(Utils.STORAGE_KEYS.PROJECTS);
    const target = all.find(p => p.id === projectId);
    const filtered = all.filter(p => p.id !== projectId);

    Utils.saveItems(Utils.STORAGE_KEYS.PROJECTS, filtered);
    renderProjectsList();

    await saveContentToGitHub('projects', filtered, `Delete project: ${target?.title || projectId}`);
    Utils.showToast('Project deleted', 'success');
};

// ── Certifications Page ──────────────────────────────────────
function loadCertificationsPage() {
    renderCertsList();
    
    const newBtn = document.getElementById('newCertBtn');
    if (newBtn) {
        newBtn.onclick = () => openCertForm();
    }
}

function renderCertsList() {
    const container = document.getElementById('certsContainer');
    if (!container) return;
    
    const certs = Utils.sortByOrder(Utils.getItems(Utils.STORAGE_KEYS.CERTS), { includeHidden: true });
    
    if (certs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-certificate"></i>
                <h3>No certifications yet</h3>
                <p>Add your certifications and training records.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = certs.map(cert => `
        <div class="admin-item-card" data-id="${cert.id}" style="${cert.hidden ? 'opacity: 0.55;' : ''}">
            <div class="admin-item-header">
                <div class="admin-item-icon"><i class="fas fa-certificate"></i></div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn" onclick="toggleItemVisibility('certifications', '${cert.id}')"
                            title="${cert.hidden ? 'Show to visitors' : 'Hide from visitors'}">
                        <i class="fas ${cert.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button class="admin-item-btn" onclick="editCert('${cert.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="admin-item-btn delete" onclick="deleteCertConfirm('${cert.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>                
            </div>
            <h4 class="admin-item-title">
                ${Utils.esc(cert.title)}
                ${cert.hidden ? '<span style="font-size:0.625rem;background:var(--accent-warning);color:white;padding:2px 6px;border-radius:4px;margin-left:6px;text-transform:uppercase;font-weight:600;">Hidden</span>' : ''}
            </h4>
            <p class="admin-item-desc">${Utils.esc(cert.description)}</p>
            <span class="tag" style="margin-top: 0.5rem; display: inline-block; font-size: 0.6875rem;">
                ${cert.status === 'active' ? '✓ Active' : 'Training'}
            </span>
        </div>
    `).join('');
    
    // Enable drag & drop
    makeSortable('certsContainer', 'certifications', reorderCerts);
}

window.openCertForm = function(cert = null) {
    const isEdit = !!cert;
    
    Utils.openModal(isEdit ? 'Edit Certification' : 'New Certification', `
        <div class="admin-form">
            <div class="form-group">
                <label for="certTitle">Title *</label>
                <input type="text" id="certTitle" value="${cert ? Utils.esc(cert.title) : ''}" placeholder="e.g., MTCNA">
            </div>
            <div class="form-group">
                <label for="certDesc">Description *</label>
                <input type="text" id="certDesc" value="${cert ? Utils.esc(cert.description) : ''}" placeholder="Full certification name">
            </div>
            <div class="form-group">
                <label for="certStatus">Status</label>
                <select id="certStatus">
                    <option value="active" ${cert?.status === 'active' ? 'selected' : ''}>Active Certification</option>
                    <option value="training" ${cert?.status === 'training' ? 'selected' : ''}>Training Completed</option>
                </select>
            </div>
            <div class="form-group">
                <label for="certLink">Certificate Link</label>
                <input type="url" id="certLink" value="${cert ? Utils.esc(cert.link || '') : ''}" placeholder="https://...">
            </div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveCert('${cert?.id || ''}')">
                    <i class="fas fa-save"></i> ${isEdit ? 'Update' : 'Create'}
                </button>
            </div>
        </div>
    `);
};

window.saveCert = function(certId) {
    const title = document.getElementById('certTitle').value.trim();
    const description = document.getElementById('certDesc').value.trim();
    const status = document.getElementById('certStatus').value;
    const link = document.getElementById('certLink').value.trim();
    
    if (!title || !description) {
        Utils.showToast('Title and description are required', 'error');
        return;
    }
    
    const certs = Utils.getItems(Utils.STORAGE_KEYS.CERTS);
    
    if (certId) {
        const index = certs.findIndex(c => c.id === certId);
        if (index > -1) {
            certs[index] = { ...certs[index], title, description, status, link };
        }
    } else {
        certs.unshift({
            id: Utils.uid(),
            title,
            description,
            status,
            link,
            order: 0
        });
    }
    
    certs.forEach((c, i) => c.order = i);
    Utils.saveItems(Utils.STORAGE_KEYS.CERTS, certs);
    saveContentToGitHub('certifications', certs, certId ? `Update cert: ${title}` : `New cert: ${title}`);
    Utils.closeModal();
    Utils.showToast(certId ? 'Certification updated' : 'Certification created', 'success');
    renderCertsList();
};

window.editCert = function(certId) {
    const cert = Utils.getItems(Utils.STORAGE_KEYS.CERTS).find(c => c.id === certId);
    if (cert) openCertForm(cert);
};

window.deleteCertConfirm = async function(certId) {
    if (!confirm('Are you sure you want to delete this certification?')) return;

    const all = Utils.getItems(Utils.STORAGE_KEYS.CERTS);
    const target = all.find(c => c.id === certId);
    const filtered = all.filter(c => c.id !== certId);

    Utils.saveItems(Utils.STORAGE_KEYS.CERTS, filtered);
    renderCertsList();

    await saveContentToGitHub('certifications', filtered, `Delete cert: ${target?.title || certId}`);
    Utils.showToast('Certification deleted', 'success');
};

// ── Skills Page ──────────────────────────────────────────────
function loadSkillsPage() {
    renderSkillsList();
    
    const newBtn = document.getElementById('newSkillBtn');
    if (newBtn) {
        newBtn.onclick = () => openSkillForm();
    }
}

function renderSkillsList() {
    const container = document.getElementById('skillsContainer');
    if (!container) return;
    
    const skills = Utils.sortByOrder(Utils.getItems(Utils.STORAGE_KEYS.SKILLS), { includeHidden: true });
    
    if (skills.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-cogs"></i>
                <h3>No skills yet</h3>
                <p>Add your technical competencies.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = skills.map(skill => `
        <div class="admin-item-card" data-id="${skill.id}" style="${skill.hidden ? 'opacity: 0.55;' : ''}">
            <div class="admin-item-header">
                <div class="admin-item-icon">${Utils.esc(skill.icon)}</div>          
                <div class="admin-item-actions">
                    <button class="admin-item-btn" onclick="toggleItemVisibility('skills', '${skill.id}')"
                            title="${skill.hidden ? 'Show to visitors' : 'Hide from visitors'}">
                        <i class="fas ${skill.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button class="admin-item-btn" onclick="editSkill('${skill.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="admin-item-btn delete" onclick="deleteSkillConfirm('${skill.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>      
            </div>
            <h4 class="admin-item-title">
                ${Utils.esc(skill.title)}
                ${skill.hidden ? '<span style="font-size:0.625rem;background:var(--accent-warning);color:white;padding:2px 6px;border-radius:4px;margin-left:6px;text-transform:uppercase;font-weight:600;">Hidden</span>' : ''}
            </h4> 
            <p class="admin-item-desc">${Utils.esc(skill.desc)}</p>
        </div>
    `).join('');
    
    // Enable drag & drop
    makeSortable('skillsContainer', 'skills', reorderSkills);
}

window.openSkillForm = function(skill = null) {
    const isEdit = !!skill;
    
    Utils.openModal(isEdit ? 'Edit Skill' : 'New Skill', `
        <div class="admin-form">
            <div class="form-group">
                <label for="skillIcon">Icon (Emoji) *</label>
                <input type="text" id="skillIcon" value="${skill ? Utils.esc(skill.icon) : '🌐'}" maxlength="2">
            </div>
            <div class="form-group">
                <label for="skillTitle">Title *</label>
                <input type="text" id="skillTitle" value="${skill ? Utils.esc(skill.title) : ''}" placeholder="Skill name">
            </div>
            <div class="form-group">
                <label for="skillDesc">Description *</label>
                <textarea id="skillDesc" rows="4" placeholder="Describe this skill...">${skill ? Utils.esc(skill.desc) : ''}</textarea>
            </div>
            <div class="form-group">
                <label for="skillTags">Tags (pipe separated)</label>
                <input type="text" id="skillTags" value="${skill ? Utils.esc(skill.tags || '') : ''}" placeholder="Tag1|Tag2|Tag3">
            </div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveSkill('${skill?.id || ''}')">
                    <i class="fas fa-save"></i> ${isEdit ? 'Update' : 'Create'}
                </button>
            </div>
        </div>
    `);
};

window.saveSkill = function(skillId) {
    const icon = document.getElementById('skillIcon').value.trim() || '🌐';
    const title = document.getElementById('skillTitle').value.trim();
    const desc = document.getElementById('skillDesc').value.trim();
    const tags = document.getElementById('skillTags').value.trim();
    
    if (!title || !desc) {
        Utils.showToast('Title and description are required', 'error');
        return;
    }
    
    const skills = Utils.getItems(Utils.STORAGE_KEYS.SKILLS);
    
    if (skillId) {
        const index = skills.findIndex(s => s.id === skillId);
        if (index > -1) {
            skills[index] = { ...skills[index], icon, title, desc, tags };
        }
    } else {
        skills.push({
            id: Utils.uid(),
            icon,
            title,
            desc,
            tags,
            order: skills.length
        });
    }
    
    Utils.saveItems(Utils.STORAGE_KEYS.SKILLS, skills);
    saveContentToGitHub('skills', skills, skillId ? `Update skill: ${title}` : `New skill: ${title}`);
    Utils.closeModal();
    Utils.showToast(skillId ? 'Skill updated' : 'Skill created', 'success');
    renderSkillsList();
};

window.editSkill = function(skillId) {
    const skill = Utils.getItems(Utils.STORAGE_KEYS.SKILLS).find(s => s.id === skillId);
    if (skill) openSkillForm(skill);
};

window.deleteSkillConfirm = async function(skillId) {
    if (!confirm('Are you sure you want to delete this skill?')) return;

    const all = Utils.getItems(Utils.STORAGE_KEYS.SKILLS);
    const target = all.find(s => s.id === skillId);
    const filtered = all.filter(s => s.id !== skillId);

    Utils.saveItems(Utils.STORAGE_KEYS.SKILLS, filtered);
    renderSkillsList();

    await saveContentToGitHub('skills', filtered, `Delete skill: ${target?.title || skillId}`);
    Utils.showToast('Skill deleted', 'success');
};

// ── Activity Page ────────────────────────────────────────────
function loadActivityPage() {
    const container = document.getElementById('activityContainer');
    if (!container) return;
    
    const activities = Utils.getActivityLog();
    
    if (activities.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <h3>No activity recorded</h3>
                <p>Admin actions will be logged here.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="activity-list" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-xl); padding: var(--space-lg);">
            ${activities.map(activity => `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-circle" style="font-size: 0.5rem;"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-text">${formatActivityText(activity)}</div>
                        <div class="activity-time">${Utils.formatDateTime(activity.timestamp)}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ── Settings Page ────────────────────────────────────────────
function loadSettingsPage() {
    // Load saved settings
    const settings = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
    
    const siteTitle = document.getElementById('settingSiteTitle');
    const siteDesc = document.getElementById('settingSiteDesc');
    const autoReply = document.getElementById('settingAutoReply');
    const notifyEmail = document.getElementById('settingNotifyEmail');
    
    if (siteTitle && settings.siteTitle) siteTitle.value = settings.siteTitle;
    if (siteDesc && settings.siteDesc) siteDesc.value = settings.siteDesc;
    if (autoReply && settings.autoReply !== undefined) autoReply.checked = settings.autoReply;
    if (notifyEmail && settings.notifyEmail) notifyEmail.value = settings.notifyEmail;
    
    // Setup save handlers
    document.getElementById('exportDataBtn')?.addEventListener('click', exportAllData);
    document.getElementById('resetDataBtn')?.addEventListener('click', resetAllData);
}

function exportAllData() {
    const data = {
        tickets: Utils.getItems(Utils.STORAGE_KEYS.TICKETS),
        posts: Utils.getItems(Utils.STORAGE_KEYS.POSTS),
        projects: Utils.getItems(Utils.STORAGE_KEYS.PROJECTS),
        certifications: Utils.getItems(Utils.STORAGE_KEYS.CERTS),
        skills: Utils.getItems(Utils.STORAGE_KEYS.SKILLS),
        activity: Utils.getActivityLog(),
        exportedAt: new Date().toISOString()
    };
    
    Utils.downloadFile(
        JSON.stringify(data, null, 2),
        `portfolio-backup-${new Date().toISOString().split('T')[0]}.json`,
        'application/json'
    );
    
    Utils.showToast('Data exported successfully', 'success');
}

function resetAllData() {
    if (!confirm('This will delete ALL data and restore defaults. Are you sure?')) return;
    if (!confirm('This action cannot be undone. Type "RESET" to confirm.')) return;
    
    // Clear all storage
    Object.values(Utils.STORAGE_KEYS).forEach(key => {
        Utils.removeStorage(key);
    });
    
    Utils.showToast('All data has been reset', 'success');
    
    setTimeout(() => {
        window.location.reload();
    }, 1500);
}

// ── Enable drag-and-drop on a container ───────────────────
function makeSortable(containerId, section, saveCallback) {
    const el = document.getElementById(containerId);
    if (!el) return;
    
    if (el._sortable) el._sortable.destroy();

    el._sortable = new Sortable(el, {
        animation: 200,
        handle: '.admin-item-card',      
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: async () => {
            const newOrder = [...el.querySelectorAll('.admin-item-card')]
                .map(card => card.dataset.id)
                .filter(Boolean);

            if (!newOrder.length) return;
            await saveCallback(newOrder);
        }
    });
}

// ── Reorder Callbacks ────────────────────────────────────────
async function reorderPosts(newOrderIds) {
    const items = Utils.getItems(Utils.STORAGE_KEYS.POSTS);
    const map = Object.fromEntries(items.map(p => [p.id, p]));
    const reordered = newOrderIds.map(id => map[id]).filter(Boolean);
    
    reordered.forEach((p, i) => p.order = i);
    Utils.saveItems(Utils.STORAGE_KEYS.POSTS, reordered);
    
    Utils.showToast('Pushing new order to GitHub...', 'info');
    await saveContentToGitHub('posts', reordered, 'Reorder posts');
}

async function reorderProjects(newOrderIds) {
    const items = Utils.getItems(Utils.STORAGE_KEYS.PROJECTS);
    const map = Object.fromEntries(items.map(p => [p.id, p]));
    const reordered = newOrderIds.map(id => map[id]).filter(Boolean);
    
    reordered.forEach((p, i) => p.order = i);
    Utils.saveItems(Utils.STORAGE_KEYS.PROJECTS, reordered);
    
    Utils.showToast('Pushing new order to GitHub...', 'info');
    await saveContentToGitHub('projects', reordered, 'Reorder projects');
}

async function reorderCerts(newOrderIds) {
    const items = Utils.getItems(Utils.STORAGE_KEYS.CERTS);
    const map = Object.fromEntries(items.map(p => [p.id, p]));
    const reordered = newOrderIds.map(id => map[id]).filter(Boolean);
    
    reordered.forEach((p, i) => p.order = i);
    Utils.saveItems(Utils.STORAGE_KEYS.CERTS, reordered);
    
    Utils.showToast('Pushing new order to GitHub...', 'info');
    await saveContentToGitHub('certifications', reordered, 'Reorder certifications');
}

async function reorderSkills(newOrderIds) {
    const items = Utils.getItems(Utils.STORAGE_KEYS.SKILLS);
    const map = Object.fromEntries(items.map(p => [p.id, p]));
    const reordered = newOrderIds.map(id => map[id]).filter(Boolean);
    
    reordered.forEach((p, i) => p.order = i);
    Utils.saveItems(Utils.STORAGE_KEYS.SKILLS, reordered);
    
    Utils.showToast('Pushing new order to GitHub...', 'info');
    await saveContentToGitHub('skills', reordered, 'Reorder skills');
}

// ── Modal Setup ──────────────────────────────────────────────
function initModals() {
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

// ── Refresh Button ───────────────────────────────────────────
document.getElementById('refreshBtn')?.addEventListener('click', () => {
    Utils.showToast('Refreshing data...', 'info');
    loadDashboardData();
    setTimeout(() => Utils.showToast('Data refreshed', 'success'), 500);
});

/* ============================================================
   NEW SECTIONS: EDUCATION, EXPERIENCE, HERO STATS, ABOUT, CONTACT CARDS, MATRIX
   ============================================================ */

// Ensure arrays exist (also mirrored to GitHub JSON files)
const NEW_KEYS = {
    education:  'sh_education',
    experience: 'sh_experience',
    heroStats:  'sh_hero_stats',
    domains:    'sh_domains',
    interests:  'sh_interests',
    contactCards: 'sh_contact_cards',
    matrix:     'sh_matrix',
    notes:      'sh_notes'
};

// ── Education ────────────────────────────────────────────────
function loadEducationPage() {
    renderEducationList();
    const btn = document.getElementById('newEduBtn');
    if (btn && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.onclick = () => openEduForm();
    }
}

function renderEducationList() {
    const c = document.getElementById('educationContainer');
    if (!c) return;
    const items = Utils.sortByOrder(Utils.getItems(NEW_KEYS.education), { includeHidden: true });
    if (!items.length) {
        c.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
            <i class="fas fa-graduation-cap"></i><h3>No education entries</h3>
            <p>Click "New Entry" to add one.</p></div>`;
        return;
    }
    c.innerHTML = items.map(e => `
        <div class="admin-item-card" data-id="${e.id}" style="${e.hidden ? 'opacity:.55;' : ''}">
            <div class="admin-item-header">
                <div class="admin-item-icon"><i class="fas fa-graduation-cap"></i></div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn" onclick="toggleNewItemVisibility('education','${e.id}')">
                        <i class="fas ${e.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button class="admin-item-btn" onclick="editEdu('${e.id}')"><i class="fas fa-edit"></i></button>
                    <button class="admin-item-btn delete" onclick="deleteEdu('${e.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <h4 class="admin-item-title">${Utils.esc(e.title)}</h4>
            <p class="admin-item-desc">${Utils.esc(e.institution || '')} • ${Utils.esc(e.year || '')}</p>
        </div>
    `).join('');
    makeSortable('educationContainer', 'education', reorderEducation);
}

function openEduForm(item = null) {
    Utils.openModal(item ? 'Edit Education' : 'New Education', `
        <div class="admin-form">
            <div class="form-group"><label>Year</label>
                <input type="text" id="eduYear" value="${item ? Utils.esc(item.year || '') : ''}" placeholder="2025 - 2026"></div>
            <div class="form-group"><label>Title *</label>
                <input type="text" id="eduTitle" value="${item ? Utils.esc(item.title) : ''}" placeholder="Diploma in ..."></div>
            <div class="form-group"><label>Institution</label>
                <input type="text" id="eduInst" value="${item ? Utils.esc(item.institution || '') : ''}" placeholder="College name"></div>
            <div class="form-group"><label>Grade / Duration</label>
                <input type="text" id="eduGrade" value="${item ? Utils.esc(item.grade || '') : ''}" placeholder="CGPA: 3.31"></div>
            <div class="form-group"><label>Modules (pipe separated)</label>
                <input type="text" id="eduModules" value="${item ? Utils.esc(item.modules || '') : ''}" placeholder="Module1|Module2"></div>
            <div class="form-group"><label>Icon (FontAwesome class)</label>
                <input type="text" id="eduIcon" value="${item ? Utils.esc(item.icon || 'fa-university') : 'fa-university'}"></div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveEdu('${item?.id || ''}')">
                    <i class="fas fa-save"></i> Save</button>
            </div>
        </div>`);
}

window.editEdu = id => {
    const it = Utils.getItems(NEW_KEYS.education).find(x => x.id === id);
    if (it) openEduForm(it);
};
window.saveEdu = id => {
    const data = {
        year: document.getElementById('eduYear').value.trim(),
        title: document.getElementById('eduTitle').value.trim(),
        institution: document.getElementById('eduInst').value.trim(),
        grade: document.getElementById('eduGrade').value.trim(),
        modules: document.getElementById('eduModules').value.trim(),
        icon: document.getElementById('eduIcon').value.trim() || 'fa-university'
    };
    if (!data.title) { Utils.showToast('Title is required', 'error'); return; }
    const items = Utils.getItems(NEW_KEYS.education);
    if (id) {
        const i = items.findIndex(x => x.id === id);
        if (i > -1) items[i] = { ...items[i], ...data };
    } else {
        items.push({ id: Utils.uid(), ...data, order: items.length });
    }
    items.forEach((x, i) => x.order = i);
    Utils.saveItems(NEW_KEYS.education, items);
    saveContentToGitHub('education', items, id ? 'Update education' : 'New education');
    Utils.closeModal(); renderEducationList();
};
window.deleteEdu = async id => {
    if (!confirm('Delete this entry?')) return;
    const items = Utils.getItems(NEW_KEYS.education).filter(x => x.id !== id);
    Utils.saveItems(NEW_KEYS.education, items);
    renderEducationList();
    await saveContentToGitHub('education', items, 'Delete education');
};

// ── Experience ───────────────────────────────────────────────
function loadExperiencePage() {
    renderExperienceList();
    const btn = document.getElementById('newExpBtn');
    if (btn && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.onclick = () => openExpForm();
    }
}

function renderExperienceList() {
    const c = document.getElementById('experienceContainer');
    if (!c) return;
    const items = Utils.sortByOrder(Utils.getItems(NEW_KEYS.experience), { includeHidden: true });
    if (!items.length) {
        c.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
            <i class="fas fa-briefcase"></i><h3>No experience entries</h3></div>`;
        return;
    }
    c.innerHTML = items.map(e => `
        <div class="admin-item-card" data-id="${e.id}" style="${e.hidden ? 'opacity:.55;' : ''}">
            <div class="admin-item-header">
                <div class="admin-item-icon"><i class="fas fa-briefcase"></i></div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn" onclick="toggleNewItemVisibility('experience','${e.id}')">
                        <i class="fas ${e.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                    <button class="admin-item-btn" onclick="editExp('${e.id}')"><i class="fas fa-edit"></i></button>
                    <button class="admin-item-btn delete" onclick="deleteExp('${e.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <h4 class="admin-item-title">${Utils.esc(e.title)}</h4>
            <p class="admin-item-desc">${Utils.esc(e.company || '')} • ${Utils.esc(e.date || '')}</p>
        </div>
    `).join('');
    makeSortable('experienceContainer', 'experience', reorderExperience);
}

function openExpForm(item = null) {
    Utils.openModal(item ? 'Edit Experience' : 'New Experience', `
        <div class="admin-form">
            <div class="form-group"><label>Date</label>
                <input type="text" id="expDate" value="${item ? Utils.esc(item.date || '') : ''}" placeholder="July 2026 – Present"></div>
            <div class="form-group"><label>Job Title *</label>
                <input type="text" id="expTitle" value="${item ? Utils.esc(item.title) : ''}"></div>
            <div class="form-group"><label>Company</label>
                <input type="text" id="expCompany" value="${item ? Utils.esc(item.company || '') : ''}"></div>
            <div class="form-group"><label>Bullet points (pipe separated)</label>
                <textarea id="expBullets" rows="5">${item ? Utils.esc(item.bullets || '') : ''}</textarea></div>
            <div class="form-group"><label>Tags (pipe separated)</label>
                <input type="text" id="expTags" value="${item ? Utils.esc(item.tags || '') : ''}"></div>
            <div class="form-group"><label>Badge (e.g. Current)</label>
                <input type="text" id="expBadge" value="${item ? Utils.esc(item.badge || '') : ''}"></div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveExp('${item?.id || ''}')">
                    <i class="fas fa-save"></i> Save</button>
            </div>
        </div>`);
}

window.editExp = id => {
    const it = Utils.getItems(NEW_KEYS.experience).find(x => x.id === id);
    if (it) openExpForm(it);
};
window.saveExp = id => {
    const data = {
        date: document.getElementById('expDate').value.trim(),
        title: document.getElementById('expTitle').value.trim(),
        company: document.getElementById('expCompany').value.trim(),
        bullets: document.getElementById('expBullets').value.trim(),
        tags: document.getElementById('expTags').value.trim(),
        badge: document.getElementById('expBadge').value.trim()
    };
    if (!data.title) { Utils.showToast('Title is required', 'error'); return; }
    const items = Utils.getItems(NEW_KEYS.experience);
    if (id) {
        const i = items.findIndex(x => x.id === id);
        if (i > -1) items[i] = { ...items[i], ...data };
    } else {
        items.push({ id: Utils.uid(), ...data, order: items.length });
    }
    items.forEach((x, i) => x.order = i);
    Utils.saveItems(NEW_KEYS.experience, items);
    saveContentToGitHub('experience', items, id ? 'Update experience' : 'New experience');
    Utils.closeModal(); renderExperienceList();
};
window.deleteExp = async id => {
    if (!confirm('Delete this entry?')) return;
    const items = Utils.getItems(NEW_KEYS.experience).filter(x => x.id !== id);
    Utils.saveItems(NEW_KEYS.experience, items);
    renderExperienceList();
    await saveContentToGitHub('experience', items, 'Delete experience');
};

// ── Hero Stats ───────────────────────────────────────────────
function loadHeroPage() {
    renderHeroStats();
    const btn = document.getElementById('addHeroStatBtn');
    if (btn && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.onclick = () => addHeroStat();
    }
}

function renderHeroStats() {
    const c = document.getElementById('heroStatsContainer');
    if (!c) return;
    const items = Utils.sortByOrder(Utils.getItems(NEW_KEYS.heroStats), { includeHidden: true });
    if (!items.length) {
        // Seed defaults on first load
        const defaults = [
            { id: 'hs1', value: 100, suffix: '+', label: 'Vulnerabilities Discovered', order: 0 },
            { id: 'hs2', value: 788, suffix: '', label: 'Hours Training', order: 1 },
            { id: 'hs3', value: 5, suffix: '', label: 'Projects Completed', order: 2 },
            { id: 'hs4', value: 3, suffix: '', label: 'MikroTik Certifications', order: 3 }
        ];
        Utils.saveItems(NEW_KEYS.heroStats, defaults);
        return renderHeroStats();
    }
    c.innerHTML = items.map(s => `
        <div class="setting-item" data-id="${s.id}" style="${s.hidden ? 'opacity:.55;' : ''}">
            <div class="setting-info"><h4>${Utils.esc(s.label)}</h4>
                <p>Value: ${s.value}${s.suffix || ''}</p></div>
            <div style="display:flex; gap:6px;">
                <button class="admin-item-btn" onclick="toggleNewItemVisibility('heroStats','${s.id}')">
                    <i class="fas ${s.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                <button class="admin-item-btn" onclick="editHeroStat('${s.id}')"><i class="fas fa-edit"></i></button>
                <button class="admin-item-btn delete" onclick="deleteHeroStat('${s.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function addHeroStat() {
    Utils.openModal('New Hero Stat', `
        <div class="admin-form">
            <div class="form-group"><label>Value (number) *</label>
                <input type="number" id="hsValue" value="0"></div>
            <div class="form-group"><label>Suffix</label>
                <input type="text" id="hsSuffix" placeholder="+"></div>
            <div class="form-group"><label>Label *</label>
                <input type="text" id="hsLabel" placeholder="Projects Completed"></div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveHeroStat()">Save</button>
            </div>
        </div>`);
}
window.saveHeroStat = id => {
    const data = {
        value: parseInt(document.getElementById('hsValue').value) || 0,
        suffix: document.getElementById('hsSuffix').value.trim(),
        label: document.getElementById('hsLabel').value.trim()
    };
    if (!data.label) { Utils.showToast('Label required', 'error'); return; }
    const items = Utils.getItems(NEW_KEYS.heroStats);
    if (id) {
        const i = items.findIndex(x => x.id === id);
        if (i > -1) items[i] = { ...items[i], ...data };
    } else {
        items.push({ id: Utils.uid(), ...data, order: items.length });
    }
    Utils.saveItems(NEW_KEYS.heroStats, items);
    saveContentToGitHub('hero-stats', items, 'Update hero stats');
    Utils.closeModal(); renderHeroStats();
};
window.editHeroStat = id => {
    const s = Utils.getItems(NEW_KEYS.heroStats).find(x => x.id === id);
    if (!s) return;
    Utils.openModal('Edit Hero Stat', `
        <div class="admin-form">
            <div class="form-group"><label>Value</label>
                <input type="number" id="hsValue" value="${s.value}"></div>
            <div class="form-group"><label>Suffix</label>
                <input type="text" id="hsSuffix" value="${Utils.esc(s.suffix || '')}"></div>
            <div class="form-group"><label>Label</label>
                <input type="text" id="hsLabel" value="${Utils.esc(s.label)}"></div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveHeroStat('${s.id}')">Save</button>
            </div>
        </div>`);
};
window.deleteHeroStat = async id => {
    if (!confirm('Delete this stat?')) return;
    const items = Utils.getItems(NEW_KEYS.heroStats).filter(x => x.id !== id);
    Utils.saveItems(NEW_KEYS.heroStats, items);
    renderHeroStats();
    await saveContentToGitHub('hero-stats', items, 'Delete hero stat');
};

// ── About & Interests ────────────────────────────────────────
function loadAboutPage() {
    renderDomains();
    renderInterests();
}

function renderDomains() {
    const c = document.getElementById('aboutDomainsContainer');
    if (!c) return;
    const items = Utils.sortByOrder(Utils.getItems(NEW_KEYS.domains), { includeHidden: true });
    if (!items.length) {
        const defaults = [
            { id: 'd1', label: 'PRIMARY', name: 'Network Operations', kind: 'primary', order: 0 },
            { id: 'd2', label: 'SECONDARY', name: 'Systems Administration', kind: 'secondary', order: 1 },
            { id: 'd3', label: 'SECURITY', name: 'Web & API Security Research', kind: 'security', order: 2 },
            { id: 'd4', label: 'LABS', name: 'VMware • Hyper-V • Linux • Windows Server', kind: 'labs', order: 3 }
        ];
        Utils.saveItems(NEW_KEYS.domains, defaults);
        return renderDomains();
    }
    c.innerHTML = items.map(d => `
        <div class="setting-item" data-id="${d.id}" style="${d.hidden ? 'opacity:.55;' : ''}">
            <div class="setting-info"><h4>${Utils.esc(d.label)}</h4><p>${Utils.esc(d.name)}</p></div>
            <div style="display:flex; gap:6px;">
                <button class="admin-item-btn" onclick="toggleNewItemVisibility('domains','${d.id}')">
                    <i class="fas ${d.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                <button class="admin-item-btn" onclick="editDomain('${d.id}')"><i class="fas fa-edit"></i></button>
                <button class="admin-item-btn delete" onclick="deleteDomain('${d.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
    makeSortable('aboutDomainsContainer', 'domains', reorderDomains);
}

window.editDomain = id => {
    const d = Utils.getItems(NEW_KEYS.domains).find(x => x.id === id);
    if (!d) return;
    Utils.openModal('Edit Domain', `
        <div class="admin-form">
            <div class="form-group"><label>Label</label>
                <input type="text" id="domLabel" value="${Utils.esc(d.label)}"></div>
            <div class="form-group"><label>Name</label>
                <input type="text" id="domName" value="${Utils.esc(d.name)}"></div>
            <div class="form-group"><label>Style</label>
                <select id="domKind">
                    <option value="primary" ${d.kind === 'primary' ? 'selected' : ''}>Primary</option>
                    <option value="secondary" ${d.kind === 'secondary' ? 'selected' : ''}>Secondary</option>
                    <option value="security" ${d.kind === 'security' ? 'selected' : ''}>Security</option>
                    <option value="labs" ${d.kind === 'labs' ? 'selected' : ''}>Labs</option>
                </select></div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveDomain('${d.id}')">Save</button>
            </div>
        </div>`);
};
window.saveDomain = id => {
    const data = {
        label: document.getElementById('domLabel').value.trim(),
        name: document.getElementById('domName').value.trim(),
        kind: document.getElementById('domKind').value
    };
    const items = Utils.getItems(NEW_KEYS.domains);
    const i = items.findIndex(x => x.id === id);
    if (i > -1) items[i] = { ...items[i], ...data };
    Utils.saveItems(NEW_KEYS.domains, items);
    saveContentToGitHub('about-domains', items, 'Update about domains');
    Utils.closeModal(); renderDomains();
};
window.deleteDomain = async id => {
    if (!confirm('Delete this domain?')) return;
    const items = Utils.getItems(NEW_KEYS.domains).filter(x => x.id !== id);
    Utils.saveItems(NEW_KEYS.domains, items);
    renderDomains();
    await saveContentToGitHub('about-domains', items, 'Delete domain');
};

function renderInterests() {
    const c = document.getElementById('interestTagsContainer');
    if (!c) return;
    const tags = Utils.getStorage(NEW_KEYS.interests, null) ||
        ['Network Security', 'Bug Bounty', 'Cloud Infrastructure', 'CTF Challenges', 'Open Source', 'Travel'];
    Utils.setStorage(NEW_KEYS.interests, tags);
    c.innerHTML = `
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:1rem;">
            ${tags.map((t, i) => `
                <span class="tag" style="display:inline-flex;align-items:center;gap:6px;">
                    ${Utils.esc(t)}
                    <button class="admin-item-btn delete" style="width:20px;height:20px;"
                            onclick="removeInterest(${i})"><i class="fas fa-times"></i></button>
                </span>`).join('')}
        </div>
        <div style="display:flex; gap:8px;">
            <input type="text" id="newInterestInput" class="setting-input" placeholder="New interest...">
            <button class="btn btn-primary btn-sm" onclick="addInterest()">
                <i class="fas fa-plus"></i> Add</button>
        </div>`;
}
window.addInterest = () => {
    const v = document.getElementById('newInterestInput').value.trim();
    if (!v) return;
    const tags = Utils.getStorage(NEW_KEYS.interests, []);
    tags.push(v);
    Utils.setStorage(NEW_KEYS.interests, tags);
    renderInterests();
    saveContentToGitHub('interests', tags, 'Add interest');
};
window.removeInterest = async i => {
    const tags = Utils.getStorage(NEW_KEYS.interests, []);
    tags.splice(i, 1);
    Utils.setStorage(NEW_KEYS.interests, tags);
    renderInterests();
    await saveContentToGitHub('interests', tags, 'Remove interest');
};

// ── Contact Cards ────────────────────────────────────────────
function loadContactCardsPage() {
    renderContactCards();
    const btn = document.getElementById('newContactCardBtn');
    if (btn && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.onclick = () => openContactCardForm();
    }
}

function renderContactCards() {
    const c = document.getElementById('contactCardsContainer');
    if (!c) return;
    const items = Utils.sortByOrder(Utils.getItems(NEW_KEYS.contactCards), { includeHidden: true });
    if (!items.length) {
        const defaults = [
            { id: 'cc1', icon: 'fa-envelope', label: 'Email', value: 'sahadat.bda35@gmail.com', href: 'mailto:sahadat.bda35@gmail.com', order: 0 },
            { id: 'cc2', icon: 'fa-phone', label: 'Phone', value: '+880 1575 382663', href: 'tel:+8801575382663', order: 1 },
            { id: 'cc3', icon: 'fa-map-marker-alt', label: 'Location', value: 'Tejgaon, Dhaka 1215, Bangladesh', href: '', order: 2 }
        ];
        Utils.saveItems(NEW_KEYS.contactCards, defaults);
        return renderContactCards();
    }
    c.innerHTML = items.map(cc => `
        <div class="admin-item-card" data-id="${cc.id}" style="${cc.hidden ? 'opacity:.55;' : ''}">
            <div class="admin-item-header">
                <div class="admin-item-icon"><i class="fas ${Utils.esc(cc.icon)}"></i></div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn" onclick="toggleNewItemVisibility('contactCards','${cc.id}')">
                        <i class="fas ${cc.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                    <button class="admin-item-btn" onclick="editContactCard('${cc.id}')"><i class="fas fa-edit"></i></button>
                    <button class="admin-item-btn delete" onclick="deleteContactCard('${cc.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <h4 class="admin-item-title">${Utils.esc(cc.label)}</h4>
            <p class="admin-item-desc">${Utils.esc(cc.value)}</p>
        </div>
    `).join('');
    makeSortable('contactCardsContainer', 'contactCards', reorderContactCards);
}

function openContactCardForm(item = null) {
    Utils.openModal(item ? 'Edit Contact Card' : 'New Contact Card', `
        <div class="admin-form">
            <div class="form-group"><label>Icon (FontAwesome)</label>
                <input type="text" id="ccIcon" value="${item ? Utils.esc(item.icon) : 'fa-envelope'}"></div>
            <div class="form-group"><label>Label *</label>
                <input type="text" id="ccLabel" value="${item ? Utils.esc(item.label) : ''}"></div>
            <div class="form-group"><label>Value *</label>
                <input type="text" id="ccValue" value="${item ? Utils.esc(item.value) : ''}"></div>
            <div class="form-group"><label>Link (optional)</label>
                <input type="text" id="ccHref" value="${item ? Utils.esc(item.href || '') : ''}" placeholder="mailto:..."></div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveContactCard('${item?.id || ''}')">Save</button>
            </div>
        </div>`);
}
window.editContactCard = id => {
    const it = Utils.getItems(NEW_KEYS.contactCards).find(x => x.id === id);
    if (it) openContactCardForm(it);
};
window.saveContactCard = id => {
    const data = {
        icon: document.getElementById('ccIcon').value.trim() || 'fa-envelope',
        label: document.getElementById('ccLabel').value.trim(),
        value: document.getElementById('ccValue').value.trim(),
        href: document.getElementById('ccHref').value.trim()
    };
    if (!data.label || !data.value) { Utils.showToast('Label & value required', 'error'); return; }
    const items = Utils.getItems(NEW_KEYS.contactCards);
    if (id) {
        const i = items.findIndex(x => x.id === id);
        if (i > -1) items[i] = { ...items[i], ...data };
    } else {
        items.push({ id: Utils.uid(), ...data, order: items.length });
    }
    Utils.saveItems(NEW_KEYS.contactCards, items);
    saveContentToGitHub('contact-cards', items, 'Update contact cards');
    Utils.closeModal(); renderContactCards();
};
window.deleteContactCard = async id => {
    if (!confirm('Delete this card?')) return;
    const items = Utils.getItems(NEW_KEYS.contactCards).filter(x => x.id !== id);
    Utils.saveItems(NEW_KEYS.contactCards, items);
    renderContactCards();
    await saveContentToGitHub('contact-cards', items, 'Delete contact card');
};

// ── Skill Matrix ─────────────────────────────────────────────
function loadMatrixPage() {
    renderMatrix();
    const btn = document.getElementById('newMatrixBtn');
    if (btn && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.onclick = () => openMatrixForm();
    }
}

function renderMatrix() {
    const c = document.getElementById('matrixContainer');
    if (!c) return;
    const items = Utils.sortByOrder(Utils.getItems(NEW_KEYS.matrix), { includeHidden: true });
    if (!items.length) {
        const defaults = [
            { id: 'm1', name: 'Cisco Networking', percent: 85, order: 0 },
            { id: 'm2', name: 'MikroTik RouterOS', percent: 90, order: 1 },
            { id: 'm3', name: 'Windows Server Administration', percent: 85, order: 2 },
            { id: 'm4', name: 'Linux Administration', percent: 80, order: 3 },
            { id: 'm5', name: 'Cybersecurity', percent: 75, order: 4 },
            { id: 'm6', name: 'Virtualization', percent: 80, order: 5 }
        ];
        Utils.saveItems(NEW_KEYS.matrix, defaults);
        return renderMatrix();
    }
    c.innerHTML = items.map(m => `
        <div class="admin-item-card" data-id="${m.id}" style="${m.hidden ? 'opacity:.55;' : ''}">
            <div class="admin-item-header">
                <div class="admin-item-icon"><i class="fas fa-chart-bar"></i></div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn" onclick="toggleNewItemVisibility('matrix','${m.id}')">
                        <i class="fas ${m.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i></button>
                    <button class="admin-item-btn" onclick="editMatrix('${m.id}')"><i class="fas fa-edit"></i></button>
                    <button class="admin-item-btn delete" onclick="deleteMatrix('${m.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <h4 class="admin-item-title">${Utils.esc(m.name)}</h4>
            <p class="admin-item-desc">${m.percent}%</p>
        </div>
    `).join('');
    makeSortable('matrixContainer', 'matrix', reorderMatrix);
}

function openMatrixForm(item = null) {
    Utils.openModal(item ? 'Edit Bar' : 'New Bar', `
        <div class="admin-form">
            <div class="form-group"><label>Name *</label>
                <input type="text" id="matName" value="${item ? Utils.esc(item.name) : ''}"></div>
            <div class="form-group"><label>Percent (0-100)</label>
                <input type="number" id="matPercent" min="0" max="100" value="${item ? item.percent : 50}"></div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveMatrix('${item?.id || ''}')">Save</button>
            </div>
        </div>`);
}
window.editMatrix = id => {
    const it = Utils.getItems(NEW_KEYS.matrix).find(x => x.id === id);
    if (it) openMatrixForm(it);
};
window.saveMatrix = id => {
    const data = {
        name: document.getElementById('matName').value.trim(),
        percent: Math.max(0, Math.min(100, parseInt(document.getElementById('matPercent').value) || 0))
    };
    if (!data.name) { Utils.showToast('Name required', 'error'); return; }
    const items = Utils.getItems(NEW_KEYS.matrix);
    if (id) {
        const i = items.findIndex(x => x.id === id);
        if (i > -1) items[i] = { ...items[i], ...data };
    } else {
        items.push({ id: Utils.uid(), ...data, order: items.length });
    }
    Utils.saveItems(NEW_KEYS.matrix, items);
    saveContentToGitHub('matrix', items, 'Update matrix');
    Utils.closeModal(); renderMatrix();
};
window.deleteMatrix = async id => {
    if (!confirm('Delete this bar?')) return;
    const items = Utils.getItems(NEW_KEYS.matrix).filter(x => x.id !== id);
    Utils.saveItems(NEW_KEYS.matrix, items);
    renderMatrix();
    await saveContentToGitHub('matrix', items, 'Delete matrix');
};

// ── Generic toggle for new sections ──────────────────────────
window.toggleNewItemVisibility = async function (section, id) {
    const items = Utils.getItems(NEW_KEYS[section]);
    const item = items.find(x => x.id === id);
    if (!item) return;
    item.hidden = !item.hidden;
    Utils.saveItems(NEW_KEYS[section], items);
    // Re-render the right list
    const renderers = {
        education: renderEducationList,
        experience: renderExperienceList,
        heroStats: renderHeroStats,
        domains: renderDomains,
        contactCards: renderContactCards,
        matrix: renderMatrix
    };
    renderers[section]?.();
    const ghName = {
        education: 'education', experience: 'experience',
        heroStats: 'hero-stats', domains: 'about-domains',
        contactCards: 'contact-cards', matrix: 'matrix'
    }[section];
    await saveContentToGitHub(ghName, items, item.hidden ? 'Hide item' : 'Show item');
};

// ── Reorder callbacks for new sections ───────────────────────
function reorderByKey(key, newOrderIds) {
    const items = Utils.getItems(key);
    const map = Object.fromEntries(items.map(x => [x.id, x]));
    const reordered = newOrderIds.map(id => map[id]).filter(Boolean);
    reordered.forEach((x, i) => x.order = i);
    Utils.saveItems(key, reordered);
    return reordered;
}
async function reorderEducation(ids)   { const r = reorderByKey(NEW_KEYS.education, ids);   await saveContentToGitHub('education', r, 'Reorder education'); }
async function reorderExperience(ids)  { const r = reorderByKey(NEW_KEYS.experience, ids);  await saveContentToGitHub('experience', r, 'Reorder experience'); }
async function reorderDomains(ids)     { const r = reorderByKey(NEW_KEYS.domains, ids);     await saveContentToGitHub('about-domains', r, 'Reorder domains'); }
async function reorderContactCards(ids){ const r = reorderByKey(NEW_KEYS.contactCards, ids);await saveContentToGitHub('contact-cards', r, 'Reorder contact cards'); }
async function reorderMatrix(ids)      { const r = reorderByKey(NEW_KEYS.matrix, ids);      await saveContentToGitHub('matrix', r, 'Reorder matrix'); }

/* ============================================================
   NOTES ADMIN
   ============================================================ */
const NOTES_KEY_ADMIN = 'sh_notes';

function loadNotesPageAdmin() {
    renderNotesAdmin();
    const btn = document.getElementById('newNoteBtn');
    if (btn && !btn.dataset.wired) {
        btn.dataset.wired = '1';
        btn.onclick = () => openNoteEditor();
    }
}

function renderNotesAdmin() {
    const c = document.getElementById('notesAdminContainer');
    if (!c) return;
    const items = Utils.sortByOrder(Utils.getItems(NOTES_KEY_ADMIN), { includeHidden: true });
    if (!items.length) {
        c.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
            <i class="fas fa-sticky-note"></i><h3>No notes yet</h3>
            <p>Click "New Note" to start.</p></div>`;
        return;
    }
    c.innerHTML = items.map(n => `
        <div class="admin-item-card" data-id="${n.id}" style="${n.hidden ? 'opacity:.55;' : ''}">
            <div class="admin-item-header">
                <div class="admin-item-icon">
                    <i class="fas ${n.type === 'book' ? 'fa-book' : 'fa-sticky-note'}"></i>
                </div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn" onclick="toggleNoteVisibility('${n.id}')"
                            title="${n.hidden ? 'Show' : 'Hide'}">
                        <i class="fas ${n.hidden ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button class="admin-item-btn" onclick="editNote('${n.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="admin-item-btn" onclick="readNote('${n.id}')" title="Read">
                        <i class="fas fa-book-open"></i>
                    </button>
                    <button class="admin-item-btn delete" onclick="deleteNote('${n.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <h4 class="admin-item-title">${Utils.esc(n.title)}</h4>
            <p class="admin-item-desc">
                ${n.type === 'book' ? 'Reading' : 'Note'} • ${Utils.formatDate(n.createdAt)}
            </p>
        </div>
    `).join('');
    makeSortable('notesAdminContainer', 'notes', reorderNotes);
}

let noteEditorState = { bold: false, italic: false };

function openNoteEditor(note = null) {
    const colors = [
        { key: 'default', val: '#1e293b', label: 'Default' },
        { key: 'yellow',  val: '#fef3c7', label: 'Yellow' },
        { key: 'blue',    val: '#dbeafe', label: 'Blue' },
        { key: 'green',   val: '#d1fae5', label: 'Green' },
        { key: 'pink',    val: '#fce7f3', label: 'Pink' },
        { key: 'purple',  val: '#ede9fe', label: 'Purple' }
    ];

    const content = `
        <div class="admin-form">
            <div class="form-row">
                <div class="form-group">
                    <label>Type</label>
                    <select id="noteType">
                        <option value="note" ${note?.type === 'note' ? 'selected' : ''}>Note</option>
                        <option value="book" ${note?.type === 'book' ? 'selected' : ''}>Book / Reading</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Color</label>
                    <select id="noteColor">
                        ${colors.map(c => `<option value="${c.key}" ${note?.color === c.key ? 'selected' : ''}>${c.label}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>Title *</label>
                <input type="text" id="noteTitle" value="${note ? Utils.esc(note.title) : ''}" placeholder="Note title">
            </div>
            <div class="form-group">
                <label>Content *</label>
                <div class="note-editor-toolbar" id="noteToolbar">
                    <button type="button" data-cmd="bold" title="Bold"><i class="fas fa-bold"></i></button>
                    <button type="button" data-cmd="italic" title="Italic"><i class="fas fa-italic"></i></button>
                    <button type="button" data-cmd="underline" title="Underline"><i class="fas fa-underline"></i></button>
                    <div class="divider"></div>
                    <button type="button" data-cmd="formatBlock" data-value="h1" title="Heading 1">H1</button>
                    <button type="button" data-cmd="formatBlock" data-value="h2" title="Heading 2">H2</button>
                    <button type="button" data-cmd="formatBlock" data-value="p" title="Paragraph">¶</button>
                    <div class="divider"></div>
                    <button type="button" data-cmd="insertUnorderedList" title="Bullet list"><i class="fas fa-list-ul"></i></button>
                    <button type="button" data-cmd="insertOrderedList" title="Numbered list"><i class="fas fa-list-ol"></i></button>
                    <button type="button" data-cmd="createLink" title="Link"><i class="fas fa-link"></i></button>
                    <div class="divider"></div>
                    <button type="button" data-cmd="fontSize" data-value="2" title="Small">A-</button>
                    <button type="button" data-cmd="fontSize" data-value="4" title="Medium">A</button>
                    <button type="button" data-cmd="fontSize" data-value="6" title="Large">A+</button>
                    <div class="divider"></div>
                    <button type="button" data-cmd="removeFormat" title="Clear formatting">
                        <i class="fas fa-eraser"></i>
                    </button>
                </div>
                <div class="note-editor-area" id="noteContent" contenteditable="true">
                    ${note?.content || ''}
                </div>
            </div>
            <div class="admin-form-actions">
                <button class="btn btn-outline" onclick="Utils.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveNote('${note?.id || ''}')">
                    <i class="fas fa-save"></i> Save Note
                </button>
            </div>
        </div>`;

    Utils.openModal(note ? 'Edit Note' : 'New Note', content);

    // Wire the toolbar
    const toolbar = document.getElementById('noteToolbar');
    const area = document.getElementById('noteContent');

    toolbar.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('mousedown', e => e.preventDefault());
        btn.addEventListener('click', () => {
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.value || null;
            area.focus();
            if (cmd === 'createLink') {
                const url = prompt('Enter URL:');
                if (url) document.execCommand('createLink', false, url);
            } else if (cmd === 'formatBlock') {
                document.execCommand('formatBlock', false, val || 'p');
            } else if (cmd === 'fontSize') {
                document.execCommand('fontSize', false, val || '3');
            } else {
                document.execCommand(cmd, false, null);
            }
            updateToolbarState();
        });
    });

    function updateToolbarState() {
        toolbar.querySelectorAll('button').forEach(b => {
            const c = b.dataset.cmd;
            if (['bold', 'italic', 'underline'].includes(c)) {
                b.classList.toggle('active', document.queryCommandState(c));
            }
        });
    }

    area.addEventListener('keyup', updateToolbarState);
    area.addEventListener('mouseup', updateToolbarState);
}

window.editNote = id => {
    const it = Utils.getItems(NOTES_KEY_ADMIN).find(x => x.id === id);
    if (it) openNoteEditor(it);
};

window.readNote = id => {
    const n = Utils.getItems(NOTES_KEY_ADMIN).find(x => x.id === id);
    if (!n) return;
    Utils.openModal(n.title, `
        <div class="note-read-content">${n.content || '<p>(Empty)</p>'}</div>
        <div style="margin-top:1.5rem; font-size:0.75rem; color:var(--text-muted);">
            <i class="fas fa-calendar"></i> ${Utils.formatDate(n.createdAt)}
        </div>
    `);
};

window.saveNote = id => {
    const type = document.getElementById('noteType').value;
    const color = document.getElementById('noteColor').value;
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').innerHTML.trim();

    if (!title) { Utils.showToast('Title is required', 'error'); return; }
    if (!content || content === '<br>') { Utils.showToast('Content is required', 'error'); return; }

    const items = Utils.getItems(NOTES_KEY_ADMIN);
    const now = new Date().toISOString();

    if (id) {
        const i = items.findIndex(x => x.id === id);
        if (i > -1) {
            items[i] = { ...items[i], type, color, title, content, updatedAt: now };
        }
    } else {
        items.unshift({
            id: Utils.uid(),
            type, color, title, content,
            createdAt: now, updatedAt: now,
            order: 0
        });
        items.forEach((x, i) => x.order = i);
    }
    Utils.saveItems(NOTES_KEY_ADMIN, items);
    saveContentToGitHub('notes', items, id ? 'Update note' : 'New note');
    Utils.closeModal();
    Utils.showToast(id ? 'Note updated' : 'Note created', 'success');
    renderNotesAdmin();
};

window.deleteNote = async id => {
    if (!confirm('Delete this note?')) return;
    const items = Utils.getItems(NOTES_KEY_ADMIN).filter(x => x.id !== id);
    Utils.saveItems(NOTES_KEY_ADMIN, items);
    renderNotesAdmin();
    await saveContentToGitHub('notes', items, 'Delete note');
};

window.toggleNoteVisibility = async id => {
    const items = Utils.getItems(NOTES_KEY_ADMIN);
    const n = items.find(x => x.id === id);
    if (!n) return;
    n.hidden = !n.hidden;
    Utils.saveItems(NOTES_KEY_ADMIN, items);
    renderNotesAdmin();
    await saveContentToGitHub('notes', items, n.hidden ? 'Hide note' : 'Show note');
    Utils.showToast(n.hidden ? 'Note hidden' : 'Note visible', 'success');
};

async function reorderNotes(ids) {
    const r = reorderByKey(NOTES_KEY_ADMIN, ids);
    await saveContentToGitHub('notes', r, 'Reorder notes');
}



// ── Export Admin Module ──────────────────────────────────────
window.AdminPanel = {
    adminState,
    loadDashboardData,
    navigateToPage,
    renderTicketsList,
    renderPostsList,
    renderProjectsList,
    renderCertsList,
    renderSkillsList
};
