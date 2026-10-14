/* ============================================================
   TICKET SYSTEM
   ============================================================ */

// ── Ticket State ─────────────────────────────────────────────
const ticketState = {
    tickets: [],
    currentFilter: 'all',
    currentSearch: '',
    selectedTicket: null
};

// ── Ticket Statuses ──────────────────────────────────────────
const TICKET_STATUSES = {
    open: { label: 'Open', color: '#3b82f6', icon: 'fa-folder-open' },
    pending: { label: 'Pending', color: '#f59e0b', icon: 'fa-clock' },
    in_progress: { label: 'In Progress', color: '#8b5cf6', icon: 'fa-spinner' },
    resolved: { label: 'Resolved', color: '#10b981', icon: 'fa-check-circle' },
    closed: { label: 'Closed', color: '#64748b', icon: 'fa-times-circle' }
};

// ── Ticket Priorities ────────────────────────────────────────
const TICKET_PRIORITIES = {
    low: { label: 'Low', color: '#64748b', icon: 'fa-arrow-down' },
    medium: { label: 'Medium', color: '#3b82f6', icon: 'fa-minus' },
    high: { label: 'High', color: '#f59e0b', icon: 'fa-arrow-up' },
    critical: { label: 'Critical', color: '#ef4444', icon: 'fa-exclamation-triangle' }
};

// ── Ticket Categories ────────────────────────────────────────
const TICKET_CATEGORIES = {
    general: { label: 'General Inquiry', icon: 'fa-question-circle' },
    project: { label: 'Project Discussion', icon: 'fa-project-diagram' },
    job: { label: 'Job Opportunity', icon: 'fa-briefcase' },
    collaboration: { label: 'Collaboration', icon: 'fa-handshake' },
    support: { label: 'Technical Support', icon: 'fa-headset' },
    other: { label: 'Other', icon: 'fa-ellipsis-h' }
};

// ── Supabase-backed ticket operations ────────────────────────
async function loadTicketsFromSupabase() {
    try {
        const client = await initSupabase();
        const { data, error } = await client
            .from('tickets')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.warn('Supabase tickets load failed, using localStorage:', e);
        return null;
    }
}

async function saveTicketToSupabase(ticket) {
    try {
        const client = await initSupabase();
        const { error } = await client.from('tickets').insert({
            ticket_id: ticket.id,
            name: ticket.name,
            email: ticket.email,
            subject: ticket.subject,
            message: ticket.message,
            status: ticket.status || 'open',
            priority: ticket.priority || 'medium',
            category: ticket.category || 'general'
        });
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Supabase ticket insert failed:', e);
        return false;
    }
}

async function updateTicketInSupabase(ticketId, updates) {
    try {
        const client = await initSupabase();
        const { error } = await client
            .from('tickets')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('ticket_id', ticketId);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Supabase ticket update failed:', e);
        return false;
    }
}

async function deleteTicketFromSupabase(ticketId) {
    try {
        const client = await initSupabase();
        const { error } = await client
            .from('tickets')
            .delete()
            .eq('ticket_id', ticketId);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Supabase ticket delete failed:', e);
        return false;
    }
}

// ── Load Tickets ─────────────────────────────────────────────
async function loadTickets() {
    // Try Supabase first (works for admin, returns empty for visitors due to RLS)
    const remote = await loadTicketsFromSupabase();
    if (remote !== null) {
        // Map Supabase rows → ticket shape used by UI
        ticketState.tickets = remote.map(t => ({
            id: t.ticket_id,
            name: t.name,
            email: t.email,
            subject: t.subject,
            message: t.message,
            status: t.status,
            priority: t.priority,
            category: t.category,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            replies: [],
            history: []
        }));
        // Also cache locally for visitors
        Utils.saveItems(Utils.STORAGE_KEYS.TICKETS, ticketState.tickets);
        return ticketState.tickets;
    }
    // Fallback: localStorage
    ticketState.tickets = Utils.getItems(Utils.STORAGE_KEYS.TICKETS);
    return ticketState.tickets;
}

// ── Save Tickets ─────────────────────────────────────────────
function saveTickets() {
    Utils.saveItems(Utils.STORAGE_KEYS.TICKETS, ticketState.tickets);
}

// ── Create Ticket ────────────────────────────────────────────
function createTicket(data) {
    const ticket = {
        id: Utils.ticketId(),
        ...data,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        replies: [],
        history: [{
            action: 'created',
            timestamp: new Date().toISOString(),
            user: 'system',
            note: 'Ticket created'
        }]
    };

    ticketState.tickets.unshift(ticket);
    saveTickets();

    // ⬇️ NEW: push to Supabase in background
    saveTicketToSupabase(ticket).then(ok => {
        if (ok) console.log('✅ ticket pushed to Supabase');
        else console.warn('⚠️ ticket saved locally only');
    });

    Utils.logActivity('ticket_created', {
        ticketId: ticket.id,
        subject: ticket.subject
    });

    return ticket;
}

// ── Get Ticket ───────────────────────────────────────────────
function getTicket(ticketId) {
    return ticketState.tickets.find(t => t.id === ticketId);
}

// ── Update Ticket Status ─────────────────────────────────────
function updateTicketStatus(ticketId, newStatus, note = '') {
    const ticket = getTicket(ticketId);
    if (!ticket) return false;
    
    const oldStatus = ticket.status;
    ticket.status = newStatus;
    ticket.updatedAt = new Date().toISOString();
    
    ticket.history = ticket.history || [];
    ticket.history.push({
        action: 'status_changed',
        from: oldStatus,
        to: newStatus,
        timestamp: new Date().toISOString(),
        user: 'admin',
        note: note || `Status changed from ${oldStatus} to ${newStatus}`
    });
    
    saveTickets();
    
    Utils.logActivity('ticket_status_updated', {
        ticketId,
        from: oldStatus,
        to: newStatus
    });
    
    updateTicketInSupabase(ticketId, { status: newStatus });
    return true;
}

// ── Add Reply ────────────────────────────────────────────────
function addTicketReply(ticketId, message, isAdmin = false) {
    const ticket = getTicket(ticketId);
    if (!ticket) return false;
    
    ticket.replies = ticket.replies || [];
    ticket.replies.push({
        id: Utils.uid(),
        message,
        isAdmin,
        timestamp: new Date().toISOString(),
        user: isAdmin ? 'admin' : 'visitor'
    });
    
    ticket.updatedAt = new Date().toISOString();
    
    ticket.history = ticket.history || [];
    ticket.history.push({
        action: 'reply_added',
        timestamp: new Date().toISOString(),
        user: isAdmin ? 'admin' : 'visitor',
        note: isAdmin ? 'Admin replied' : 'Visitor replied'
    });
    
    saveTickets();
    return true;
}

// ── Delete Ticket ────────────────────────────────────────────
function deleteTicket(ticketId) {
    const index = ticketState.tickets.findIndex(t => t.id === ticketId);
    if (index === -1) return false;
    
    const ticket = ticketState.tickets[index];
    ticketState.tickets.splice(index, 1);
    saveTickets();
    
    Utils.logActivity('ticket_deleted', {
        ticketId,
        subject: ticket.subject
    });
    
    return true;
}

// ── Filter Tickets ───────────────────────────────────────────
function filterTickets(status = 'all', search = '') {
    let tickets = [...ticketState.tickets];
    
    if (status !== 'all') {
        tickets = tickets.filter(t => t.status === status);
    }
    
    if (search) {
        const query = search.toLowerCase();
        tickets = tickets.filter(t => 
            t.id.toLowerCase().includes(query) ||
            t.subject.toLowerCase().includes(query) ||
            t.name.toLowerCase().includes(query) ||
            t.email.toLowerCase().includes(query) ||
            t.message.toLowerCase().includes(query)
        );
    }
    
    return tickets;
}

// ── Get Ticket Stats ─────────────────────────────────────────
function getTicketStats() {
    const tickets = ticketState.tickets;
    
    return {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        pending: tickets.filter(t => t.status === 'pending').length,
        inProgress: tickets.filter(t => t.status === 'in_progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length,
        critical: tickets.filter(t => t.priority === 'critical').length,
        high: tickets.filter(t => t.priority === 'high').length
    };
}

// ── Render Ticket Card ───────────────────────────────────────
function renderTicketCard(ticket) {
    const status = TICKET_STATUSES[ticket.status] || TICKET_STATUSES.open;
    const priority = TICKET_PRIORITIES[ticket.priority] || TICKET_PRIORITIES.medium;
    const category = TICKET_CATEGORIES[ticket.category] || TICKET_CATEGORIES.general;
    
    return `
        <div class="ticket-card" data-id="${ticket.id}">
            <div class="ticket-header">
                <span class="ticket-id">${Utils.esc(ticket.id)}</span>
                <span class="ticket-priority" style="background: ${priority.color}20; color: ${priority.color};">
                    <i class="fas ${priority.icon}"></i>
                    ${priority.label}
                </span>
            </div>
            <h4 class="ticket-subject">${Utils.esc(ticket.subject)}</h4>
            <p class="ticket-preview">${Utils.esc(Utils.truncate(ticket.message, 100))}</p>
            <div class="ticket-meta">
                <span><i class="fas fa-user"></i> ${Utils.esc(ticket.name)}</span>
                <span><i class="fas fa-clock"></i> ${Utils.timeAgo(ticket.createdAt)}</span>
            </div>
            <div class="ticket-footer">
                <span class="ticket-status" style="background: ${status.color}20; color: ${status.color};">
                    <i class="fas ${status.icon}"></i>
                    ${status.label}
                </span>
                <span class="ticket-category">
                    <i class="fas ${category.icon}"></i>
                    ${category.label}
                </span>
            </div>
        </div>
    `;
}

// ── Render Ticket List ───────────────────────────────────────
function renderTicketList(containerId, status = 'all', search = '') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const tickets = filterTickets(status, search);
    
    if (tickets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No tickets found</h3>
                <p>${status !== 'all' ? `No ${status} tickets at the moment.` : 'No tickets have been created yet.'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tickets.map(ticket => renderTicketCard(ticket)).join('');
    
    // Add click handlers
    container.querySelectorAll('.ticket-card').forEach(card => {
        card.addEventListener('click', () => {
            const ticket = getTicket(card.dataset.id);
            if (ticket) openTicketDetail(ticket);
        });
    });
}

// ── Open Ticket Detail ───────────────────────────────────────
function openTicketDetail(ticket) {
    const status = TICKET_STATUSES[ticket.status] || TICKET_STATUSES.open;
    const priority = TICKET_PRIORITIES[ticket.priority] || TICKET_PRIORITIES.medium;
    const category = TICKET_CATEGORIES[ticket.category] || TICKET_CATEGORIES.general;
    
    const content = `
        <div class="ticket-detail">
            <div class="ticket-detail-header">
                <div>
                    <span class="ticket-id">${Utils.esc(ticket.id)}</span>
                    <span class="ticket-status" style="background: ${status.color}20; color: ${status.color}; margin-left: 0.5rem;">
                        <i class="fas ${status.icon}"></i>
                        ${status.label}
                    </span>
                </div>
                <span class="ticket-priority" style="background: ${priority.color}20; color: ${priority.color};">
                    <i class="fas ${priority.icon}"></i>
                    ${priority.label} Priority
                </span>
            </div>
            
            <h2 class="ticket-detail-subject">${Utils.esc(ticket.subject)}</h2>
            
            <div class="ticket-detail-meta">
                <div class="meta-item">
                    <i class="fas fa-user"></i>
                    <span>${Utils.esc(ticket.name)}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-envelope"></i>
                    <a href="mailto:${Utils.esc(ticket.email)}">${Utils.esc(ticket.email)}</a>
                </div>
                <div class="meta-item">
                    <i class="fas fa-tag"></i>
                    <span>${category.label}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>${Utils.formatDateTime(ticket.createdAt)}</span>
                </div>
            </div>
            
            <div class="ticket-detail-message">
                <h4>Message</h4>
                <p>${Utils.esc(ticket.message).replace(/\n/g, '<br>')}</p>
            </div>
            
            ${ticket.replies && ticket.replies.length > 0 ? `
                <div class="ticket-replies">
                    <h4>Replies (${ticket.replies.length})</h4>
                    ${ticket.replies.map(reply => `
                        <div class="ticket-reply ${reply.isAdmin ? 'admin' : ''}">
                            <div class="reply-header">
                                <span class="reply-user">
                                    <i class="fas ${reply.isAdmin ? 'fa-shield-alt' : 'fa-user'}"></i>
                                    ${reply.isAdmin ? 'Admin' : Utils.esc(ticket.name)}
                                </span>
                                <span class="reply-time">${Utils.timeAgo(reply.timestamp)}</span>
                            </div>
                            <p>${Utils.esc(reply.message).replace(/\n/g, '<br>')}</p>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${ticket.history && ticket.history.length > 0 ? `
                <div class="ticket-history">
                    <h4>History</h4>
                    <ul class="history-list">
                        ${ticket.history.map(h => `
                            <li>
                                <span class="history-time">${Utils.formatDateTime(h.timestamp)}</span>
                                <span class="history-action">${Utils.esc(h.note)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
    
    Utils.openModal('Ticket Details', content);
}

// ── Export ───────────────────────────────────────────────────
window.TicketSystem = {
    ticketState,
    TICKET_STATUSES,
    TICKET_PRIORITIES,
    TICKET_CATEGORIES,
    loadTickets,
    saveTickets,
    createTicket,
    getTicket,
    updateTicketStatus,
    addTicketReply,
    deleteTicket,
    filterTickets,
    getTicketStats,
    renderTicketCard,
    renderTicketList,
    openTicketDetail
};
