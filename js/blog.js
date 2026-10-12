/* ============================================================
   BLOG & LEARNING SYSTEM
   ============================================================ */

// ── Blog State ───────────────────────────────────────────────
const blogState = {
    posts: [],
    categories: [
        { id: 'network', name: 'Network', icon: 'fa-network-wired', color: '#3b82f6' },
        { id: 'system', name: 'System', icon: 'fa-server', color: '#8b5cf6' },
        { id: 'cloud', name: 'Cloud', icon: 'fa-cloud', color: '#06b6d4' },
        { id: 'cybersecurity', name: 'Cybersecurity', icon: 'fa-shield-alt', color: '#ef4444' }
    ],
    currentFilter: 'all',
    currentPage: 1,
    postsPerPage: 6
};

// ── Initialize Blog ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadBlogPosts();
    setupBlogFilters();
});

// ── Load Posts ───────────────────────────────────────────────
function loadBlogPosts() {
    blogState.posts = Utils.getItems(Utils.STORAGE_KEYS.POSTS);
    renderBlogPosts();
}

// ── Render Posts ─────────────────────────────────────────────
function renderBlogPosts() {
    const container = document.getElementById('learningGrid');
    if (!container) return;
    
    let posts = Utils.sortByOrder(blogState.posts);
    
    // Apply filter
    if (blogState.currentFilter !== 'all') {
        posts = posts.filter(p => p.category === blogState.currentFilter);
    }
    
    // Pagination
    const start = (blogState.currentPage - 1) * blogState.postsPerPage;
    const paginatedPosts = posts.slice(start, start + blogState.postsPerPage);
    
    if (paginatedPosts.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <i class="fas fa-book-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <p style="color: var(--text-secondary);">No posts found in this category.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = paginatedPosts.map(post => createBlogCard(post)).join('');
    
    // Add click handlers
    container.querySelectorAll('.learning-card').forEach(card => {
        card.addEventListener('click', () => {
            const post = blogState.posts.find(p => p.id === card.dataset.id);
            if (post) openBlogPost(post);
        });
    });
    
    // Update load more button
    updateLoadMoreButton(posts.length);
    
    // Re-init scroll reveal
    if (window.initScrollReveal) window.initScrollReveal();
}

// ── Create Blog Card ─────────────────────────────────────────
function createBlogCard(post) {
    const category = blogState.categories.find(c => c.id === post.category) || blogState.categories[0];
    
    return `
        <article class="learning-card reveal" data-id="${post.id}">
            <div class="learning-image ${post.category}">
                <span style="font-size: 3rem;">${Utils.esc(post.emoji || '📝')}</span>
                <span class="learning-category" style="background: ${category.color}20; color: ${category.color};">
                    <i class="fas ${category.icon}"></i>
                    ${Utils.esc(category.name)}
                </span>
            </div>
            <div class="learning-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span class="learning-date">${Utils.formatDate(post.createdAt)}</span>
                    ${post.featured ? '<span class="tag" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b;">Featured</span>' : ''}
                </div>
                <h3>${Utils.esc(post.title)}</h3>
                <p>${Utils.esc(post.summary || Utils.truncate(post.content, 150))}</p>
                <div class="learning-meta">
                    <span><i class="fas fa-clock"></i> ${Utils.timeAgo(post.createdAt)}</span>
                    <span><i class="fas fa-eye"></i> ${post.views || 0} views</span>
                </div>
            </div>
        </article>
    `;
}

// ── Open Blog Post ───────────────────────────────────────────
function openBlogPost(post) {
    // Increment view count
    post.views = (post.views || 0) + 1;
    const posts = Utils.getItems(Utils.STORAGE_KEYS.POSTS);
    const index = posts.findIndex(p => p.id === post.id);
    if (index > -1) {
        posts[index].views = post.views;
        Utils.saveItems(Utils.STORAGE_KEYS.POSTS, posts);
    }
    
    const category = blogState.categories.find(c => c.id === post.category);
    
    const content = `
        <article class="blog-post-full">
            <div class="blog-post-header">
                <div class="blog-post-meta">
                    <span class="learning-category" style="background: ${category.color}20; color: ${category.color};">
                        <i class="fas ${category.icon}"></i>
                        ${Utils.esc(category.name)}
                    </span>
                    <span><i class="fas fa-calendar"></i> ${Utils.formatDate(post.createdAt)}</span>
                    <span><i class="fas fa-clock"></i> ${Utils.timeAgo(post.createdAt)}</span>
                    <span><i class="fas fa-eye"></i> ${post.views} views</span>
                </div>
                <h1 class="blog-post-title">${Utils.esc(post.title)}</h1>
                ${post.summary ? `<p class="blog-post-summary">${Utils.esc(post.summary)}</p>` : ''}
            </div>
            
            ${post.image ? `
                <div class="blog-post-image">
                    <img src="${Utils.esc(post.image)}" alt="${Utils.esc(post.title)}">
                </div>
            ` : ''}
            
            <div class="blog-post-content">
                ${formatBlogContent(post.content)}
            </div>
            
            ${post.tags ? `
                <div class="blog-post-tags">
                    ${post.tags.split(',').map(tag => `
                        <span class="tag">#${Utils.esc(tag.trim())}</span>
                    `).join('')}
                </div>
            ` : ''}
            
            ${post.pdf ? `
                <div class="blog-post-attachment">
                    <a href="${Utils.esc(post.pdf)}" class="btn btn-outline" target="_blank" rel="noopener">
                        <i class="fas fa-file-pdf"></i>
                        Download PDF
                    </a>
                </div>
            ` : ''}
            
            <div class="blog-post-footer">
                <div class="blog-post-share">
                    <span>Share:</span>
                    <button onclick="copyBlogLink('${post.id}')" class="share-btn">
                        <i class="fas fa-link"></i>
                    </button>
                    <button onclick="shareBlogPost('${post.id}', 'twitter')" class="share-btn">
                        <i class="fab fa-twitter"></i>
                    </button>
                    <button onclick="shareBlogPost('${post.id}', 'facebook')" class="share-btn">
                        <i class="fab fa-facebook"></i>
                    </button>
                    <button onclick="shareBlogPost('${post.id}', 'linkedin')" class="share-btn">
                        <i class="fab fa-linkedin"></i>
                    </button>
                </div>
            </div>
        </article>
    `;
    
    Utils.openModal('', content);
    
    // Update modal to hide title
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.style.display = 'none';
    
    // Restore title on close
    const closeBtn = document.getElementById('modalClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modalTitle) modalTitle.style.display = '';
        }, { once: true });
    }
}

// ── Format Blog Content ──────────────────────────────────────
function formatBlogContent(content) {
    if (!content) return '';
    
    // Convert markdown-like syntax to HTML
    let html = content
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
        // Inline code
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // Links
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Lists
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    
    // Wrap lists
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    
    // Wrap paragraphs
    html = '<p>' + html + '</p>';
    
    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>\s*<\/p>/g, '');
    
    return html;
}

// ── Blog Filters ─────────────────────────────────────────────
function setupBlogFilters() {
    // Only wire buttons inside the Learning section
    const learningSection = document.getElementById('learning');
    if (!learningSection) return;

    const filterButtons = learningSection.querySelectorAll('.filter-btn');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            blogState.currentFilter = btn.dataset.category;
            blogState.currentPage = 1;
            renderBlogPosts();
        });
    });
}

// ── Load More ────────────────────────────────────────────────
function updateLoadMoreButton(totalPosts) {
    const loadMoreBtn = document.getElementById('loadMorePosts');
    if (!loadMoreBtn) return;
    
    const loadedCount = blogState.currentPage * blogState.postsPerPage;
    
    if (loadedCount >= totalPosts) {
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.style.display = 'inline-flex';
        loadMoreBtn.innerHTML = `
            <i class="fas fa-plus"></i>
            Load More (${totalPosts - loadedCount} remaining)
        `;
    }
}

document.getElementById('loadMorePosts')?.addEventListener('click', () => {
    blogState.currentPage++;
    renderBlogPosts();
});

// ── Share Functions ──────────────────────────────────────────
window.copyBlogLink = function(postId) {
    const url = `${window.location.origin}${window.location.pathname}#post-${postId}`;
    Utils.copyToClipboard(url);
};

window.shareBlogPost = function(postId, platform) {
    const post = blogState.posts.find(p => p.id === postId);
    if (!post) return;
    
    const url = encodeURIComponent(`${window.location.origin}${window.location.pathname}#post-${postId}`);
    const title = encodeURIComponent(post.title);
    
    const shareUrls = {
        twitter: `https://twitter.com/intent/tweet?text=${title}&url=${url}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
        linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}`
    };
    
    if (shareUrls[platform]) {
        window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
};

// ── Export ───────────────────────────────────────────────────
window.BlogSystem = {
    blogState,
    loadBlogPosts,
    renderBlogPosts,
    openBlogPost,
    createBlogCard
};
