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
    document.getElementById('loginScreen')?.classList.remove('hidden');
    document.getElementById('adminDashboard')?.classList.add('hidden');
}

// ── Show Dashboard ───────────────────────────────────────────
function showDashboard() {
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
    
    loadDashboardData();
    setupPageNavigation();
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
        case 'dashboard':
            loadDashboardData();
            break;
        case 'tickets':
            loadTicketsPage();
            break;
        case 'posts':
            loadPostsPage();
            break;
        case 'projects':
            loadProjectsPage();
            break;
        case 'certifications':
            loadCertificationsPage();
            break;
        case 'skills':
            loadSkillsPage();
            break;
        case 'activity':
            loadActivityPage();
            break;
        case 'settings':
            loadSettingsPage();
            break;
    }
    
    // Close sidebar on mobile
    if (window.innerWidth <= 1024) {
        document.getElementById('adminSidebar')?.classList.remove('open');
    }
}

// ── Dashboard Data ───────────────────────────────────────────
function loadDashboardData() {
    // Load tickets
    TicketSystem.loadTickets();
    const stats = TicketSystem.getTicketStats();
    
    // Update stats grid
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid) {
        statsGrid.innerHTML = `
            ${createStatCard('Total Tickets', stats.total, 'fa-ticket-alt', 'blue')}
            ${createStatCard('Open', stats.open, 'fa-folder-open', 'green')}
            ${createStatCard('Pending', stats.pending, 'fa-clock', 'yellow')}
            ${createStatCard('Resolved', stats.resolved, 'fa-check-circle', 'purple')}
            ${createStatCard('Critical', stats.critical, 'fa-exclamation-triangle', 'red')}
            ${createStatCard('Posts', Utils.getItems(Utils.STORAGE_KEYS.POSTS).length, 'fa-blog', 'cyan')}
        `;
    }
    
    // Update tickets badge
    const badge = document.getElementById('ticketsBadge');
    if (badge) {
        badge.textContent = stats.open;
        badge.style.display = stats.open > 0 ? 'inline-block' : 'none';
    }
    
    // Load recent tickets
    loadRecentTickets();
    
    // Load recent activity
    loadRecentActivity();
}

function createStatCard(label, value, icon, color) {
    return `
        <div class="stat-card">
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
function loadTicketsPage() {
    TicketSystem.loadTickets();
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

window.confirmStatusChange = function(ticketId) {
    const newStatus = document.getElementById('newStatus').value;
    const note = document.getElementById('statusNote').value;
    
    if (TicketSystem.updateTicketStatus(ticketId, newStatus, note)) {
        Utils.closeModal();
        Utils.showToast('Ticket status updated', 'success');
        renderTicketsList();
        updateTicketStats();
        loadDashboardData();
    } else {
        Utils.showToast('Failed to update ticket', 'error');
    }
};

// ── Delete Ticket ────────────────────────────────────────────
window.deleteTicketConfirm = function(ticketId) {
    if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
        return;
    }
    
    if (TicketSystem.deleteTicket(ticketId)) {
        Utils.showToast('Ticket deleted', 'success');
        renderTicketsList();
        updateTicketStats();
        loadDashboardData();
    } else {
        Utils.showToast('Failed to delete ticket', 'error');
    }
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

window.submitReply = function(ticketId) {
    const message = document.getElementById('replyMessage').value.trim();
    
    if (!message) {
        Utils.showToast('Please enter a reply message', 'error');
        return;
    }
    
    if (TicketSystem.addTicketReply(ticketId, message, true)) {
        Utils.closeModal();
        Utils.showToast('Reply sent successfully', 'success');
        
        // Reopen with updated data
        const ticket = TicketSystem.getTicket(ticketId);
        if (ticket) openAdminTicketDetail(ticket);
        
        renderTicketsList();
        loadDashboardData();
    } else {
        Utils.showToast('Failed to send reply', 'error');
    }
};

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
    
    const posts = Utils.sortByOrder(Utils.getItems(Utils.STORAGE_KEYS.POSTS));
    
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
                <div class="admin-item-card">
                    <div class="admin-item-header">
                        <div class="admin-item-icon">${Utils.esc(post.emoji || '📝')}</div>
                        <div class="admin-item-actions">
                            <button class="admin-item-btn" onclick="editPost('${post.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="admin-item-btn delete" onclick="deletePostConfirm('${post.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <h4 class="admin-item-title">${Utils.esc(post.title)}</h4>
                    <p class="admin-item-desc">${Utils.esc(post.summary || Utils.truncate(post.content, 100))}</p>
                    <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
                        <span class="tag" style="font-size: 0.6875rem;">${Utils.esc(post.category)}</span>
                        <span style="font-size: 0.6875rem; color: var(--text-muted);">${Utils.formatDate(post.createdAt)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
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
    Utils.closeModal();
    Utils.showToast(postId ? 'Post updated' : 'Post created', 'success');
    renderPostsList();
};

window.editPost = function(postId) {
    const post = Utils.getItems(Utils.STORAGE_KEYS.POSTS).find(p => p.id === postId);
    if (post) openPostForm(post);
};

window.deletePostConfirm = function(postId) {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    const posts = Utils.getItems(Utils.STORAGE_KEYS.POSTS);
    const post = posts.find(p => p.id === postId);
    const filtered = posts.filter(p => p.id !== postId);
    
    Utils.saveItems(Utils.STORAGE_KEYS.POSTS, filtered);
    Utils.logActivity('post_deleted', { title: post?.title });
    Utils.showToast('Post deleted', 'success');
    renderPostsList();
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
    
    const projects = Utils.sortByOrder(Utils.getItems(Utils.STORAGE_KEYS.PROJECTS));
    
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
        <div class="admin-item-card">
            <div class="admin-item-header">
                <div class="admin-item-icon"><i class="fas fa-project-diagram"></i></div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn" onclick="editProject('${project.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="admin-item-btn delete" onclick="deleteProjectConfirm('${project.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <h4 class="admin-item-title">${Utils.esc(project.title)}</h4>
            <p class="admin-item-desc">${Utils.esc(Utils.truncate(project.description, 100))}</p>
        </div>
    `).join('');
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
    Utils.closeModal();
    Utils.showToast(projectId ? 'Project updated' : 'Project created', 'success');
    renderProjectsList();
};

window.editProject = function(projectId) {
    const project = Utils.getItems(Utils.STORAGE_KEYS.PROJECTS).find(p => p.id === projectId);
    if (project) openProjectForm(project);
};

window.deleteProjectConfirm = function(projectId) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    const projects = Utils.getItems(Utils.STORAGE_KEYS.PROJECTS).filter(p => p.id !== projectId);
    Utils.saveItems(Utils.STORAGE_KEYS.PROJECTS, projects);
    Utils.showToast('Project deleted', 'success');
    renderProjectsList();
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
    
    const certs = Utils.sortByOrder(Utils.getItems(Utils.STORAGE_KEYS.CERTS));
    
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
        <div class="admin-item-card">
            <div class="admin-item-header">
                <div class="admin-item-icon"><i class="fas fa-certificate"></i></div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn" onclick="editCert('${cert.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="admin-item-btn delete" onclick="deleteCertConfirm('${cert.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <h4 class="admin-item-title">${Utils.esc(cert.title)}</h4>
            <p class="admin-item-desc">${Utils.esc(cert.description)}</p>
            <span class="tag" style="margin-top: 0.5rem; display: inline-block; font-size: 0.6875rem;">
                ${cert.status === 'active' ? '✓ Active' : 'Training'}
            </span>
        </div>
    `).join('');
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
    Utils.closeModal();
    Utils.showToast(certId ? 'Certification updated' : 'Certification created', 'success');
    renderCertsList();
};

window.editCert = function(certId) {
    const cert = Utils.getItems(Utils.STORAGE_KEYS.CERTS).find(c => c.id === certId);
    if (cert) openCertForm(cert);
};

window.deleteCertConfirm = function(certId) {
    if (!confirm('Are you sure you want to delete this certification?')) return;
    const certs = Utils.getItems(Utils.STORAGE_KEYS.CERTS).filter(c => c.id !== certId);
    Utils.saveItems(Utils.STORAGE_KEYS.CERTS, certs);
    Utils.showToast('Certification deleted', 'success');
    renderCertsList();
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
    
    const skills = Utils.sortByOrder(Utils.getItems(Utils.STORAGE_KEYS.SKILLS));
    
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
        <div class="admin-item-card">
            <div class="admin-item-header">
                <div class="admin-item-icon">${Utils.esc(skill.icon)}</div>
                <div class="admin-item-actions">
                    <button class="admin-item-btn" onclick="editSkill('${skill.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="admin-item-btn delete" onclick="deleteSkillConfirm('${skill.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <h4 class="admin-item-title">${Utils.esc(skill.title)}</h4>
            <p class="admin-item-desc">${Utils.esc(skill.desc)}</p>
        </div>
    `).join('');
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
    Utils.closeModal();
    Utils.showToast(skillId ? 'Skill updated' : 'Skill created', 'success');
    renderSkillsList();
};

window.editSkill = function(skillId) {
    const skill = Utils.getItems(Utils.STORAGE_KEYS.SKILLS).find(s => s.id === skillId);
    if (skill) openSkillForm(skill);
};

window.deleteSkillConfirm = function(skillId) {
    if (!confirm('Are you sure you want to delete this skill?')) return;
    const skills = Utils.getItems(Utils.STORAGE_KEYS.SKILLS).filter(s => s.id !== skillId);
    Utils.saveItems(Utils.STORAGE_KEYS.SKILLS, skills);
    Utils.showToast('Skill deleted', 'success');
    renderSkillsList();
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
