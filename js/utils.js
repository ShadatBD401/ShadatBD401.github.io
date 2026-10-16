/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

// ── Storage Keys ─────────────────────────────────────────────
const STORAGE_KEYS = {
    TICKETS: 'sh_tickets',
    POSTS: 'sh_posts',
    PROJECTS: 'sh_projects',
    CERTS: 'sh_certifications',
    SKILLS: 'sh_skills',
    ADMIN_SESSION: 'sh_admin_session',
    THEME: 'sh_theme',
    SETTINGS: 'sh_settings',
    SUBSCRIBERS: 'sh_subscribers',
    ACTIVITY_LOG: 'sh_activity_log'
};

// ── ID Generation ────────────────────────────────────────────
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function ticketId() {
    const prefix = 'TKT';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

// ── Storage Helpers ──────────────────────────────────────────
function getStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error(`Error reading ${key} from storage:`, e);
        return defaultValue;
    }
}

function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error(`Error writing ${key} to storage:`, e);
        return false;
    }
}

function removeStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error(`Error removing ${key} from storage:`, e);
        return false;
    }
}

// ── DOM Helpers ──────────────────────────────────────────────
function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return document.querySelectorAll(selector);
}

function createElement(tag, className, innerHTML) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Alias for escapeHtml
const esc = escapeHtml;

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 }
    ];
    
    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
        }
    }
    
    return 'Just now';
}

// ── Toast Notifications ──────────────────────────────────────
function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.success}"></i>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ── Modal Helpers ────────────────────────────────────────────
function openModal(title, content) {
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    
    if (!overlay || !titleEl || !bodyEl) return;
    
    titleEl.textContent = title;
    bodyEl.innerHTML = content;
    overlay.classList.add('open');
    document.body.classList.add('modal-open');
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (!overlay) return;
    
    overlay.classList.remove('open');
    document.body.classList.remove('modal-open');
}

// ── Theme Management ─────────────────────────────────────────
function getTheme() {
    return getStorage(STORAGE_KEYS.THEME, 'dark');
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    setStorage(STORAGE_KEYS.THEME, theme);
    updateThemeIcon(theme);
}

function toggleTheme() {
    const current = getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    setStorage(STORAGE_KEYS.THEME, next);
    
    // Inline icon update — no dependency on updateThemeIcon
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
        const icon = toggle.querySelector('i');
        if (icon) {
            icon.className = next === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }
    
    return next;
}

function updateThemeIcon(theme) {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    
    const icon = toggle.querySelector('i');
    if (icon) {
        icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }
}

// ── Scroll Helpers ───────────────────────────────────────────
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const navHeight = document.getElementById('navbar')?.offsetHeight || 80;
        const top = section.offsetTop - navHeight;
        window.scrollTo({ top, behavior: 'smooth' });
    }
}

function getScrollY() {
    return window.scrollY || window.pageYOffset || 0;
}

// ── Validation Helpers ───────────────────────────────────────
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

function sanitizeInput(input) {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// ── File Helpers ─────────────────────────────────────────────
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ── String Helpers ───────────────────────────────────────────
function truncate(str, length = 100) {
    if (str.length <= length) return str;
    return str.slice(0, length).trim() + '...';
}

function slugify(str) {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Array Helpers ────────────────────────────────────────────
function sortByOrder(items) {
    // Filter out items marked as hidden (when called from the public site).
    // Admin views explicitly pass `{ includeHidden: true }` to see everything.
    const args = sortByOrder._lastArgs || {};
    const includeHidden = args.includeHidden === true;

    const filtered = includeHidden
        ? items
        : items.filter(i => i.hidden !== true);

    return [...filtered].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function sortByDate(items, field = 'createdAt', desc = true) {
    return [...items].sort((a, b) => {
        const dateA = new Date(a[field] || 0);
        const dateB = new Date(b[field] || 0);
        return desc ? dateB - dateA : dateA - dateB;
    });
}

function groupBy(items, key) {
    return items.reduce((groups, item) => {
        const group = item[key] || 'Other';
        groups[group] = groups[group] || [];
        groups[group].push(item);
        return groups;
    }, {});
}

// ── Debounce & Throttle ──────────────────────────────────────
function debounce(fn, delay = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

function throttle(fn, limit = 100) {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ── Copy to Clipboard ────────────────────────────────────────
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
        return true;
    } catch (e) {
        console.error('Copy failed:', e);
        showToast('Failed to copy', 'error');
        return false;
    }
}

// ── Random Helpers ───────────────────────────────────────────
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Local Data Management ────────────────────────────────────
function getItems(key) {
    return getStorage(key, []);
}

function saveItems(key, items) {
    return setStorage(key, items);
}

function addItem(key, item) {
    const items = getItems(key);
    items.push(item);
    return saveItems(key, items);
}

function updateItem(key, id, updates) {
    const items = getItems(key);
    const index = items.findIndex(item => item.id === id);
    if (index > -1) {
        items[index] = { ...items[index], ...updates };
        return saveItems(key, items);
    }
    return false;
}

function deleteItem(key, id) {
    const items = getItems(key);
    const filtered = items.filter(item => item.id !== id);
    return saveItems(key, filtered);
}

// ── Activity Logging ─────────────────────────────────────────
function logActivity(action, details = {}) {
    const logs = getStorage(STORAGE_KEYS.ACTIVITY_LOG, []);
    logs.unshift({
        id: uid(),
        action,
        details,
        timestamp: new Date().toISOString(),
        user: getStorage(STORAGE_KEYS.ADMIN_SESSION, {}).username || 'system'
    });
    
    // Keep only last 100 logs
    if (logs.length > 100) logs.length = 100;
    
    setStorage(STORAGE_KEYS.ACTIVITY_LOG, logs);
}

function getActivityLog() {
    return getStorage(STORAGE_KEYS.ACTIVITY_LOG, []);
}

// ── Export for use in other files ────────────────────────────
window.Utils = {
    uid,
    ticketId,
    getStorage,
    setStorage,
    removeStorage,
    $,
    $$,
    createElement,
    escapeHtml,
    esc,
    formatDate,
    formatDateTime,
    timeAgo,
    showToast,
    openModal,
    closeModal,
    getTheme,
    setTheme,
    toggleTheme,
    scrollToSection,
    isValidEmail,
    isValidUrl,
    sanitizeInput,
    readFileAsDataURL,
    readFileAsText,
    downloadFile,
    truncate,
    slugify,
    capitalize,
    sortByOrder,
    sortByDate,
    groupBy,
    debounce,
    throttle,
    copyToClipboard,
    randomInt,
    randomChoice,
    getItems,
    saveItems,
    addItem,
    updateItem,
    deleteItem,
    logActivity,
    getActivityLog,
    STORAGE_KEYS
};
