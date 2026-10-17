/* ============================================================
   MAIN APPLICATION LOGIC
   ============================================================ */

// ── Global State ─────────────────────────────────────────────
const state = {
    currentSection: 'home',
    isAdmin: false,
    adminUser: null,
    projects: [],
    certifications: [],
    skills: [],
    posts: [],
    tickets: []
};

// ── Initialization ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname);
    }

    // ⬇️ Fetch latest content from GitHub's public raw endpoint FIRST
    await fetchPublicContent();

    initTheme();
    initPreloader();
    initNavigation();
    initParticles();
    initCounters();
    initSkills();
    initProjects();
    initCertifications();
    initLearning();
    initContactForm();
    initModals();
    initScrollReveal();
});

// ── Fetch content JSON from GitHub raw (no token needed) ─────
async function fetchPublicContent() {
    const OWNER  = 'shadatbd401';
    const REPO   = 'shadatbd401.github.io';
    const BRANCH = 'main';
    const sections = ['posts', 'projects', 'certifications', 'skills'];

    for (const s of sections) {
        try {
            // Added cache: 'no-store' to bypass GitHub's CDN caching
            const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/data/${s}.json?t=${Date.now()}`;
            const res = await fetch(url, { cache: 'no-store' });   
            if (!res.ok) continue;
            const json = await res.json();
            if (Array.isArray(json)) {
                const key = Utils.STORAGE_KEYS[s.toUpperCase()];
                if (key) Utils.saveItems(key, json);
                console.log(`⬇️ public: loaded fresh ${s}.json from GitHub`);
            }
        } catch (e) {
            console.warn(`public: could not load ${s}.json`, e);
        }
    }
}

// ── Theme Initialization ─────────────────────────────────────
function initTheme() {
    // Theme init is now handled by features.js (multi-theme system).
    // Just make sure the data-theme attribute is set on load.
    const savedTheme = Utils.getTheme();
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
}

// ── Preloader ────────────────────────────────────────────────
function initPreloader() {
    const preloader = document.getElementById('preloader');
    const loaderBar = document.getElementById('loaderBar');
    const loaderText = document.getElementById('loaderText');
    
    if (!preloader) return;
    
    const messages = [
        'Initializing system...',
        'Loading network modules...',
        'Configuring services...',
        'Establishing secure connection...',
        'Ready!'
    ];
    
    let progress = 0;
    let messageIndex = 0;
    
    const interval = setInterval(() => {
        progress += Math.random() * 20 + 5;
        if (progress > 100) progress = 100;
        
        if (loaderBar) loaderBar.style.width = `${progress}%`;
        
        const newIndex = Math.min(Math.floor(progress / 25), messages.length - 1);
        if (newIndex !== messageIndex && loaderText) {
            messageIndex = newIndex;
            loaderText.textContent = messages[messageIndex];
        }
        
        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                preloader.classList.add('hidden');
                document.body.style.overflow = '';
                initScrollReveal();
            }, 500);
        }
    }, 150);
}

// ── Navigation ───────────────────────────────────────────────
function initNavigation() {
    const navbar = document.getElementById('navbar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Scroll effect
    window.addEventListener('scroll', Utils.throttle(() => {
        if (navbar) {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        }
        updateActiveSection();
    }, 100));
    
    // Mobile menu toggle
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenuBtn.classList.toggle('active');
            navMenu?.classList.toggle('open');
        });
    }

    // Nav link clicks
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const section = link.dataset.section;

            // Links with no data-section (e.g., Gallery) should navigate normally
            if (!section) {
                navMenu?.classList.remove('open');
                mobileMenuBtn?.classList.remove('active');
                return;   // ← do NOT call preventDefault — let the browser navigate
            }

            e.preventDefault();
            Utils.scrollToSection(section);
            navMenu?.classList.remove('open');
            mobileMenuBtn?.classList.remove('active');
        });
    });
   
    // Close mobile menu on outside click
    document.addEventListener('click', (e) => {
        if (navMenu?.classList.contains('open') && 
            !navMenu.contains(e.target) && 
            !mobileMenuBtn?.contains(e.target)) {
            navMenu.classList.remove('open');
            mobileMenuBtn?.classList.remove('active');
        }
    });
}

function updateActiveSection() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    const scrollY = window.scrollY + 150;
    
    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');
        
        if (scrollY >= top && scrollY < top + height) {
            navLinks.forEach(link => {
                link.classList.toggle('active', link.dataset.section === id);
            });
        }
    });
}

// ── Particles Effect ─────────────────────────────────────────
function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    function createParticles() {
        particles = [];
        const count = Math.min(Math.floor(window.innerWidth / 20), 80);
        
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1,
                opacity: Math.random() * 0.5 + 0.1
            });
        }
    }
    
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach((p, i) => {
            // Update position
            p.x += p.vx;
            p.y += p.vy;
            
            // Wrap around
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            
            // Draw particle
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(59, 130, 246, ${p.opacity})`;
            ctx.fill();
            
            // Draw connections
            particles.slice(i + 1).forEach(p2 => {
                const dx = p.x - p2.x;
                const dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = `rgba(59, 130, 246, ${0.1 * (1 - dist / 150)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            });
        });
        
        animationId = requestAnimationFrame(draw);
    }
    
    resize();
    createParticles();
    draw();
    
    window.addEventListener('resize', Utils.debounce(() => {
        resize();
        createParticles();
    }, 250));
}

// ── Counter Animation ────────────────────────────────────────
function initCounters() {
    const counters = document.querySelectorAll('.stat-value[data-count]');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.animated) {
                entry.target.dataset.animated = 'true';
                animateCounter(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
    const target = parseInt(element.dataset.count);
    const duration = 2000;
    const start = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(easeOutQuart * target);
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target;
        }
    }
    
    requestAnimationFrame(update);
}

// ── Skills Initialization ────────────────────────────────────
function initSkills() {
    const defaultSkills = [
        {
            id: 'skill-1',
            icon: '🌐',
            title: 'Networking & Routing',
            desc: 'Understand and apply IPv4/IPv6 addressing, subnetting, VLSM, CIDR, and route summarization. Design and configure LAN/WAN networks with static and dynamic routing (OSPF). Configure inter-VLAN routing, DHCP, NAT/PAT, and essential IP services.',
            tags: 'OSPF|VLAN|NAT|ACL|HSRP',
            order: 0
        },
        {
            id: 'skill-2',
            icon: '🔵',
            title: 'Cisco Infrastructure',
            desc: 'Configure and manage Cisco routers and switches using Cisco IOS CLI. Deploy VLANs, trunk links, Router-on-a-Stick, Layer 3 switching, STP, and EtherChannel. Configure routing protocols, DHCP, NAT, ACLs, and NTP.',
            tags: 'Cisco IOS|VLAN|STP|EtherChannel|ACL',
            order: 1
        },
        {
            id: 'skill-3',
            icon: '🛡️',
            title: 'MikroTik Engineering',
            desc: 'Configure and administer MikroTik RouterOS on RouterBOARD and CHR platforms. Deploy IP addressing, bridges, VLANs, DHCP, DNS, static routing, NAT, and firewall rules. Configure PPPoE services, VPNs, bandwidth management.',
            tags: 'RouterOS|PPPoE|Firewall|Bandwidth|VPN',
            order: 2
        },
        {
            id: 'skill-4',
            icon: '🖥️',
            title: 'Windows Server Administration',
            desc: 'Windows Server Installation, Deployment, and Initial Configuration. Active Directory Domain Services (AD DS). DNS, DHCP, and IP Address Management (IPAM). Group Policy (GPO) and Active Directory Administration.',
            tags: 'AD DS|DNS|DHCP|GPO|IPAM|ADCS',
            order: 3
        },
        {
            id: 'skill-5',
            icon: '🐧',
            title: 'Linux Administration',
            desc: 'Red Hat Enterprise Linux Installation and Configuration. Linux Command Line and Bash Shell. User, Group, and Permission Management. Process, Service, and System Administration (systemd). SSH Configuration.',
            tags: 'RHEL|Bash|systemd|SELinux|LVM|Samba',
            order: 4
        },
        {
            id: 'skill-6',
            icon: '🔒',
            title: 'Cybersecurity',
            desc: 'Authorized vulnerability assessment and web/API security research across common and advanced application weaknesses. XSS, IDOR, SSRF, CSRF, Authentication Bypass, File Upload issues.',
            tags: 'Burp Suite|Nmap|Metasploit|Wireshark|CTF',
            order: 5
        },
        {
            id: 'skill-7',
            icon: '☁️',
            title: 'Virtualization & Cloud',
            desc: 'VMware, Microsoft Hyper-V, Virtual Machine Deployment, Management, Troubleshooting, Lab Environment Setup. Knowledge of Type 1 and Type 2 Hypervisors, Virtualization, and Cloud Computing Concepts.',
            tags: 'VMware|Hyper-V|KVM|Docker|Containers',
            order: 6
        },
        {
            id: 'skill-8',
            icon: '💻',
            title: 'Hardware & Support',
            desc: 'PC Hardware Installation, Configuration, and Troubleshooting. Motherboards, CPUs, Memory (RAM), Storage Devices, and Power Supplies. RAID, SSD/HDD Management, and Peripheral Devices.',
            tags: 'CompTIA A+|RAID|Hardware|Troubleshooting',
            order: 7
        }
    ];
    
    // Load from storage or use defaults
    let skills = Utils.getItems(Utils.STORAGE_KEYS.SKILLS);
    if (skills.length === 0) {
        skills = defaultSkills;
        Utils.saveItems(Utils.STORAGE_KEYS.SKILLS, skills);
    }
    
    state.skills = skills;
    renderSkills();
}

function renderSkills() {
    const container = document.getElementById('skillsGrid');
    if (!container) return;
    
    const skills = Utils.sortByOrder(state.skills);
    
    if (skills.length === 0) {
        container.innerHTML = '<p class="text-center">No skills added yet.</p>';
        return;
    }
    
    container.innerHTML = skills.map((skill, i) => `
        <div class="skill-card reveal ${i % 3 === 1 ? 'reveal-delay-1' : i % 3 === 2 ? 'reveal-delay-2' : ''}">
            <div class="skill-icon">${Utils.esc(skill.icon)}</div>
            <h3>${Utils.esc(skill.title)}</h3>
            <p>${Utils.esc(skill.desc)}</p>
            ${skill.tags ? `
                <div class="skill-tags">
                    ${skill.tags.split('|').map(tag => `<span class="tag">${Utils.esc(tag.trim())}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
    
    initScrollReveal();
}

// ── Projects Initialization ──────────────────────────────────
function initProjects() {
    const defaultProjects = [
        {
            id: 'proj-1',
            title: 'Departmental VLAN Network Design',
            description: 'Designed departmental segmentation and secure inter-VLAN communication using switching, routing and access-control concepts.\n\n• Configured VLANs for multiple departments\n• Implemented inter-VLAN routing with Router-on-a-Stick\n• Applied ACLs for security between departments\n• Documented network topology and addressing plan',
            tags: 'VLAN|Inter-VLAN|ACL|Switching',
            link: '#',
            order: 0
        },
        {
            id: 'proj-2',
            title: 'Windows Server Enterprise Infrastructure',
            description: 'Built an enterprise-style Windows Server environment around Active Directory, DNS, DHCP and IPAM.\n\n• Deployed AD DS with multiple domain controllers\n• Configured DNS and DHCP for centralized management\n• Implemented IPAM for IP address tracking\n• Created Group Policies for security compliance',
            tags: 'AD DS|DNS|DHCP|IPAM|GPO',
            link: '#',
            order: 1
        },
        {
            id: 'proj-3',
            title: 'Redundant DNS with Master-Slave Replication',
            description: 'Implemented a redundant DNS architecture on Red Hat Linux with master/slave replication for service resilience.\n\n• Configured BIND DNS server on RHEL\n• Set up master-slave replication\n• Tested failover scenarios\n• Documented configuration and troubleshooting steps',
            tags: 'RHEL|BIND|DNS|High Availability',
            link: '#',
            order: 2
        },
        {
            id: 'proj-4',
            title: 'Linux Mail Server with Backup & Recovery',
            description: 'Built a Red Hat Linux mail-server environment with backup and recovery considerations for continuity.\n\n• Deployed Postfix and Dovecot\n• Configured SMTP relay with authentication\n• Implemented automated backup scripts\n• Tested recovery procedures',
            tags: 'Postfix|Dovecot|Backup|RHEL',
            link: '#',
            order: 3
        },
        {
            id: 'proj-5',
            title: 'Secure Samba File Sharing',
            description: 'Configured secure network file sharing on Red Hat Linux with permissions and access-control considerations.\n\n• Deployed Samba server on RHEL\n• Configured user-level access controls\n• Integrated with Windows Active Directory\n• Implemented audit logging',
            tags: 'Samba|SMB|RHEL|File Sharing',
            link: '#',
            order: 4
        }
    ];
    
    let projects = Utils.getItems(Utils.STORAGE_KEYS.PROJECTS);
    if (projects.length === 0) {
        projects = defaultProjects;
        Utils.saveItems(Utils.STORAGE_KEYS.PROJECTS, projects);
    }
    
    state.projects = projects;
    renderProjects();
}

function renderProjects() {
    const container = document.getElementById('projectsGrid');
    if (!container) return;
    
    const projects = Utils.sortByOrder(state.projects);
    
    if (projects.length === 0) {
        container.innerHTML = '<p class="text-center">No projects added yet.</p>';
        return;
    }
    
    container.innerHTML = projects.map((project, i) => `
        <div class="project-card reveal" data-id="${project.id}">
            <div class="project-image">
                <i class="fas fa-project-diagram"></i>
            </div>
            <div class="project-content">
                <div class="project-number">${String(i + 1).padStart(2, '0')} / PROJECT</div>
                <h3>${Utils.esc(project.title)}</h3>
                <p>${Utils.esc(Utils.truncate(project.description.replace(/[•\n]/g, ' ').trim(), 150))}</p>
                ${project.tags ? `
                    <div class="project-tags">
                        ${project.tags.split('|').map(tag => `<span class="tag">${Utils.esc(tag.trim())}</span>`).join('')}
                    </div>
                ` : ''}
                ${project.link ? `
                    <a href="${Utils.esc(project.link)}" class="project-link" target="_blank" rel="noopener">
                        View Project <i class="fas fa-external-link-alt"></i>
                    </a>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    container.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const id = card.dataset.id;
            const project = state.projects.find(p => p.id === id);
            if (project) openProjectModal(project);
        });
    });
    
    initScrollReveal();
}

function openProjectModal(project) {
    const content = `
        <div class="modal-project">
            <h3>${Utils.esc(project.title)}</h3>
            <div class="modal-project-content">
                ${formatDescription(project.description)}
            </div>
            ${project.tags ? `
                <div class="project-tags" style="margin-top: 1rem;">
                    ${project.tags.split('|').map(tag => `<span class="tag">${Utils.esc(tag.trim())}</span>`).join('')}
                </div>
            ` : ''}
            ${project.link ? `
                <a href="${Utils.esc(project.link)}" class="btn btn-primary" style="margin-top: 1rem;" target="_blank" rel="noopener">
                    <i class="fas fa-external-link-alt"></i> View Project
                </a>
            ` : ''}
        </div>
    `;
    
    Utils.openModal('Project Details', content);
}

function formatDescription(text) {
    if (!text) return '';
    
    const lines = text.split('\n').filter(l => l.trim());
    let html = '';
    let inList = false;
    
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('•')) {
            if (!inList) {
                html += '<ul>';
                inList = true;
            }
            html += `<li>${Utils.esc(trimmed.slice(1).trim())}</li>`;
        } else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            html += `<p>${Utils.esc(trimmed)}</p>`;
        }
    });
    
    if (inList) html += '</ul>';
    
    return html;
}

// ── Certifications Initialization ────────────────────────────
function initCertifications() {
    const defaultCerts = [
        {
            id: 'cert-1',
            title: 'MTCNA',
            description: 'MikroTik Certified Network Associate',
            status: 'active',
            link: '#',
            order: 0
        },
        {
            id: 'cert-2',
            title: 'MTCRE',
            description: 'MikroTik Certified Routing Engineer',
            status: 'active',
            link: '#',
            order: 1
        },
        {
            id: 'cert-3',
            title: 'MTCSE',
            description: 'MikroTik Certified Security Engineer',
            status: 'active',
            link: '#',
            order: 2
        },
        {
            id: 'cert-4',
            title: 'CCNA',
            description: 'Cisco Certified Network Associate (Training Completed)',
            status: 'training',
            link: '#',
            order: 3
        },
        {
            id: 'cert-5',
            title: 'Red Hat System Admin',
            description: 'RH124, RH134, RH254 (Training Completed)',
            status: 'training',
            link: '#',
            order: 4
        },
        {
            id: 'cert-6',
            title: 'Web Security Workshop',
            description: 'Web Application Vulnerabilities & Burp Suite',
            status: 'training',
            link: '#',
            order: 5
        }
    ];
    
    let certs = Utils.getItems(Utils.STORAGE_KEYS.CERTS);
    if (certs.length === 0) {
        certs = defaultCerts;
        Utils.saveItems(Utils.STORAGE_KEYS.CERTS, certs);
    }
    
    state.certifications = certs;
    renderCertifications();
}

function renderCertifications() {
    const container = document.getElementById('certificationsGrid');
    if (!container) return;
    
    const certs = Utils.sortByOrder(state.certifications);
    
    if (certs.length === 0) {
        container.innerHTML = '<p class="text-center">No certifications added yet.</p>';
        return;
    }
    
    container.innerHTML = certs.map(cert => `
        <div class="cert-card reveal">
            <div class="cert-icon">
                <i class="fas fa-certificate"></i>
            </div>
            <h3>${Utils.esc(cert.title)}</h3>
            <p>${Utils.esc(cert.description)}</p>
            <span class="cert-status ${cert.status}">
                ${cert.status === 'active' ? '✓ Active Certification' : 'Training Completed'}
            </span>
            ${cert.link && cert.link !== '#' ? `
                <a href="${Utils.esc(cert.link)}" class="cert-link" target="_blank" rel="noopener">
                    <i class="fas fa-external-link-alt"></i> View Certificate
                </a>
            ` : ''}
        </div>
    `).join('');
    
    initScrollReveal();
}

// ── Learning/Blog Initialization ─────────────────────────────
function initLearning() {
    const defaultPosts = [
        {
            id: 'post-1',
            title: 'Routing & Switching Foundations',
            summary: 'Subnetting → VLANs → trunking → inter-VLAN routing → dynamic routing → ACL validation.',
            content: 'Complete guide covering the fundamentals of routing and switching...',
            category: 'network',
            emoji: '🌐',
            createdAt: new Date().toISOString(),
            order: 0
        },
        {
            id: 'post-2',
            title: 'Windows & Linux Administration',
            summary: 'Identity, DNS/DHCP, Group Policy, Linux permissions, storage and file services.',
            content: 'Comprehensive overview of system administration across Windows and Linux...',
            category: 'system',
            emoji: '🖥️',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            order: 1
        },
        {
            id: 'post-3',
            title: 'Web & API Security Testing',
            summary: 'HTTP → authorization → input handling → business logic → responsible reporting.',
            content: 'Methodology for authorized web and API security testing...',
            category: 'cybersecurity',
            emoji: '🔒',
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            order: 2
        },
        {
            id: 'post-4',
            title: 'Cloud Infrastructure Basics',
            summary: 'Introduction to cloud computing concepts, virtualization and modern infrastructure.',
            content: 'Understanding cloud computing from the ground up...',
            category: 'cloud',
            emoji: '☁️',
            createdAt: new Date(Date.now() - 259200000).toISOString(),
            order: 3
        }
    ];
    
    let posts = Utils.getItems(Utils.STORAGE_KEYS.POSTS);
    if (posts.length === 0) {
        posts = defaultPosts;
        Utils.saveItems(Utils.STORAGE_KEYS.POSTS, posts);
    }
    
    state.posts = posts;
    renderLearning('all');
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderLearning(btn.dataset.category);
        });
    });
}

function renderLearning(category = 'all') {
    const container = document.getElementById('learningGrid');
    if (!container) return;
    
    let posts = Utils.sortByOrder(state.posts);
    
    if (category !== 'all') {
        posts = posts.filter(p => p.category === category);
    }
    
    if (posts.length === 0) {
        container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">No posts found in this category.</p>';
        return;
    }
    
    container.innerHTML = posts.map(post => `
        <div class="learning-card reveal" data-id="${post.id}">
            <div class="learning-image ${post.category}">
                <span>${Utils.esc(post.emoji || '📝')}</span>
                <span class="learning-category">${Utils.esc(post.category)}</span>
            </div>
            <div class="learning-content">
                <span class="learning-date">${Utils.formatDate(post.createdAt)}</span>
                <h3>${Utils.esc(post.title)}</h3>
                <p>${Utils.esc(post.summary || Utils.truncate(post.content, 150))}</p>
                <div class="learning-meta">
                    <span><i class="fas fa-clock"></i> ${Utils.timeAgo(post.createdAt)}</span>
                    <span><i class="fas fa-tag"></i> ${Utils.esc(post.category)}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    // Click handlers
    container.querySelectorAll('.learning-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.id;
            const post = state.posts.find(p => p.id === id);
            if (post) openPostModal(post);
        });
    });
    
    initScrollReveal();
}

function openPostModal(post) {
    const content = `
        <div class="modal-post">
            <div class="post-meta" style="margin-bottom: 1rem;">
                <span class="learning-category">${Utils.esc(post.category)}</span>
                <span style="color: var(--text-muted); margin-left: 1rem;">
                    <i class="fas fa-calendar"></i> ${Utils.formatDate(post.createdAt)}
                </span>
            </div>
            <h2 style="margin-bottom: 1rem;">${Utils.esc(post.title)}</h2>
            <div class="post-content">
                ${formatDescription(post.content)}
            </div>
        </div>
    `;
    
    Utils.openModal(post.title, content);
}

// ── Contact Form ─────────────────────────────────────────────
function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        const formData = {
            name:     document.getElementById('contactName').value.trim(),
            email:    document.getElementById('contactEmail').value.trim(),
            subject:  document.getElementById('contactSubject').value.trim(),
            category: document.getElementById('contactCategory').value,
            priority: document.getElementById('contactPriority').value,
            message:  document.getElementById('contactMessage').value.trim()
        };

        if (!formData.name || !formData.email || !formData.subject || !formData.message) {
            Utils.showToast('Please fill in all required fields', 'error');
            return;
        }
        if (!Utils.isValidEmail(formData.email)) {
            Utils.showToast('Please enter a valid email address', 'error');
            return;
        }

        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        submitBtn.disabled = true;

        const ticketIdStr = Utils.ticketId();
        const nowIso = new Date().toISOString();

        // 1) ALWAYS save a local copy first (so tracking works even offline)
        const localTickets = Utils.getItems(Utils.STORAGE_KEYS.TICKETS);
        localTickets.unshift({
            id: ticketIdStr,
            ...formData,
            status: 'open',
            createdAt: nowIso,
            updatedAt: nowIso,
            replies: []
        });
        Utils.saveItems(Utils.STORAGE_KEYS.TICKETS, localTickets);

        // 2) Then push to Supabase (best-effort)
        if (window.SupabaseTickets) {
            try {
                await window.SupabaseTickets.create({
                    id: ticketIdStr,
                    ...formData,
                    status: 'open',
                    replies: []
                });
                console.log('✅ Ticket saved to Supabase');
            } catch (err) {
                console.warn('⚠️ Supabase save failed, local copy kept:', err);
            }
        }

        Utils.logActivity('ticket_created', { ticketId: ticketIdStr, subject: formData.subject });
        form.reset();
        Utils.showToast(`Ticket ${ticketIdStr} submitted successfully!`, 'success');

        Utils.openModal('Ticket Submitted', `
            <div style="text-align: center; padding: 1rem;">
                <div style="font-size: 3rem; color: var(--accent-success); margin-bottom: 1rem;">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h3 style="margin-bottom: 0.5rem;">Thank you, ${Utils.esc(formData.name)}!</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                    Your ticket has been created successfully.
                </p>
                <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                    <p style="font-family: var(--font-mono); font-size: 1.25rem; color: var(--accent-primary);">
                        ${ticketIdStr}
                    </p>
                    <p style="font-size: 0.875rem; color: var(--text-muted);">
                        Save this ID to track your ticket
                    </p>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.875rem;">
                    I'll get back to you at ${Utils.esc(formData.email)} as soon as possible.
                </p>
            </div>
        `);

        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    });
}

// ── Modal Handlers ───────────────────────────────────────────
function initModals() {
    const overlay = document.getElementById('modalOverlay');
    const closeBtn = document.getElementById('modalClose');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', Utils.closeModal);
    }
    
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) Utils.closeModal();
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') Utils.closeModal();
    });
}

// ── Scroll Reveal ────────────────────────────────────────────
let revealObserver = null;

function initScrollReveal() {
    if (revealObserver) {
        revealObserver.disconnect();
    }
    
    revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
        revealObserver.observe(el);
    });
}

// ── Load More Posts ──────────────────────────────────────────
document.getElementById('loadMorePosts')?.addEventListener('click', () => {
    Utils.showToast('All posts are already loaded', 'info');
});

// ── Newsletter Form ──────────────────────────────────────────
document.getElementById('newsletterForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]').value;
    
    if (!Utils.isValidEmail(email)) {
        Utils.showToast('Please enter a valid email', 'error');
        return;
    }
    
    // Save subscriber
    const subscribers = Utils.getStorage(Utils.STORAGE_KEYS.SUBSCRIBERS, []);
    if (!subscribers.includes(email)) {
        subscribers.push(email);
        Utils.setStorage(Utils.STORAGE_KEYS.SUBSCRIBERS, subscribers);
    }
    
    e.target.reset();
    Utils.showToast('Successfully subscribed!', 'success');
});

// ── Export for Admin ─────────────────────────────────────────
window.PortfolioApp = {
    state,
    renderSkills,
    renderProjects,
    renderCertifications,
    renderLearning
};
