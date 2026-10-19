/* ============================================================
   SITE SETTINGS LOADER
   Fetches site settings from Supabase and applies them to:
     - Navbar avatar
     - Hero avatar (if present)
     - Nav links visibility (if present)
   Works on any page (index, gallery, admin).
   ============================================================ */

(async function () {
    // Don't run on admin — admin has its own logic
    if (document.body.classList.contains('admin-body')) return;

    try {
        // Wait for supabase to be ready
        if (typeof initSupabase !== 'function') {
            console.warn('[settings-loader] Supabase not available');
            return;
        }

        const client = await initSupabase();
        const { data, error } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'main')
            .maybeSingle();

        if (error) throw error;
        if (!data?.value) {
            console.log('[settings-loader] No remote settings, using local cache');
        } else {
            Utils.setStorage(Utils.STORAGE_KEYS.SETTINGS, data.value);
            console.log('⬇️ Loaded remote settings');
        }
    } catch (e) {
        console.warn('[settings-loader] Could not load remote settings:', e.message);
    }

    // ── Apply settings to the navbar + hero ─────────────────
    const s = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
    if (!Object.keys(s).length) return;

    // helper: crisp Google Drive image URL
    function crispUrl(url, id, size) {
        // Use the Drive thumbnail CDN which returns real JPEG at the exact size
        if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
        if (url && url.includes('googleusercontent.com')) {
            return url.replace(/=w\d+.*$/, `=w${size}`);
        }
        return url;
    }   
   
    // Navbar avatar
    const navAvatar = document.getElementById('navAvatar');
    if (navAvatar) {
        if (s.profileImage) {
            const src = crispUrl(s.profileImage, s.profileImageId, 80);
            // If there's an image, ONLY show the image. Do not stack it with the text logo.
            navAvatar.innerHTML = `<img src="${src}" alt="Profile" onerror="this.style.display='none'">`;
        } else {
            // If no image, show the <SH/> text logo.
            navAvatar.innerHTML = `<span class="nav-avatar-logo"><span class="logo-bracket">&lt;</span><span class="logo-text">SH</span><span class="logo-bracket">/&gt;</span></span>`;
        }
    }
   
    // ⬇️ NEW: Hero terminal avatar (was only created by features.js before)
    const heroTerminal = document.querySelector('.hero-terminal');
    if (heroTerminal && s.heroImage) {
        let heroAvatar = document.getElementById('heroProfileImg');
        if (!heroAvatar) {
            heroAvatar = document.createElement('div');
            heroAvatar.id = 'heroProfileImg';
            heroAvatar.title = 'Double-click for a surprise 🚀';
            heroTerminal.style.position = 'relative';
            heroTerminal.appendChild(heroAvatar);
        }
        const src = crispUrl(s.heroImage, s.heroImageId, 400);
        heroAvatar.innerHTML = `<img src="${src}" alt="Profile">`;
    }

    // Logo name + role
    const logoName = document.querySelector('.logo-name');
    if (logoName && s.displayName) logoName.textContent = s.displayName;

    const logoRole = document.querySelector('.logo-role');
    if (logoRole && s.title) logoRole.textContent = s.title;

    // Section visibility — hide nav links
    const visibility = s.visibility || {};
    const sectionMap = {
        about: 'about', experience: 'experience', technical: 'technical',
        projects: 'projects', certifications: 'certifications',
        education: 'education', learning: 'learning',
        gallery: 'gallery', contact: 'contact', notes: 'notes'
    };
    Object.entries(sectionMap).forEach(([key, id]) => {
        const navLink = document.querySelector(`.nav-link[data-section="${id}"]`);
        const section  = document.getElementById(id);
        if (visibility[key] === false) {
            if (navLink) navLink.style.display = 'none';
            if (section) section.style.display = 'none';
        }
    });

    // Theme default from admin settings (only if user has no saved theme)
    if (!Utils.getStorage(Utils.STORAGE_KEYS.THEME, null) && s.defaultTheme) {
        document.documentElement.setAttribute('data-theme', s.defaultTheme);
    }
})();
