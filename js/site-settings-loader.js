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

    // ── Apply settings to the navbar ─────────────────────────
    const s = Utils.getStorage(Utils.STORAGE_KEYS.SETTINGS, {});
    if (!Object.keys(s).length) return;

    // Navbar avatar
    const navAvatar = document.getElementById('navAvatar');
    if (navAvatar) {
        const fallbackLogo = `<span class="nav-avatar-logo"><span class="logo-bracket">&lt;</span><span class="logo-text">SH</span><span class="logo-bracket">/&gt;</span></span>`;
        if (s.profileImage) {
            navAvatar.innerHTML = `${fallbackLogo}<img src="${s.profileImage}" alt="Profile" onerror="this.remove()">`;
        } else {
            navAvatar.innerHTML = fallbackLogo;
        }
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
        gallery: 'gallery', contact: 'contact'
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
