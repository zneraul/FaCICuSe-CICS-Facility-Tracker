'use strict';

(function initFacicuseProjectSync() {
  const headerAuthCta = document.getElementById('header-auth-cta');
  const heroAuthCta = document.getElementById('hero-auth-cta');
  const previewAuthCta = document.getElementById('preview-auth-cta');
  const ctaAuthLink = document.getElementById('cta-auth-link');
  const mobileMenu = document.getElementById('public-mobile-menu');

  // Remove tokens left by older builds; app sessions are now cookie-only.
  try { sessionStorage.removeItem('facicuse_user_session_token'); } catch {}

  function createAccountMenu(user) {
    if (!headerAuthCta || !headerAuthCta.parentNode) return;
    const name = String(user.fullName || 'My Account');
    const role = user.role === 'admin'
      ? 'System Administrator'
      : user.role === 'professor'
        ? 'Faculty Member'
        : 'Student';

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.flexShrink = '0';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'btn btn-coral btn-sm';
    trigger.textContent = name;
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Account navigation');
    Object.assign(menu.style, {
      position: 'absolute',
      top: 'calc(100% + 0.5rem)',
      right: '0',
      zIndex: '40',
      minWidth: '205px',
      padding: '0.5rem',
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px',
      background: 'var(--surface-elevated, #ffffff)',
      boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16)',
    });

    const identity = document.createElement('div');
    identity.style.cssText = 'padding:0.55rem 0.65rem;border-bottom:1px solid var(--border-subtle);margin-bottom:0.3rem;';
    const nameLine = document.createElement('strong');
    nameLine.textContent = name;
    nameLine.style.cssText = 'display:block;font-size:0.88rem;color:var(--ink-primary);';
    const roleLine = document.createElement('span');
    roleLine.textContent = role;
    roleLine.style.cssText = 'display:block;font-size:0.75rem;color:var(--ink-muted);';
    identity.append(nameLine, roleLine);
    menu.append(identity);

    function addMenuLink(label, href) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      link.className = 'public-mobile-link';
      link.setAttribute('role', 'menuitem');
      link.style.display = 'block';
      menu.append(link);
    }
    addMenuLink('Profile', '/app/profile');
    addMenuLink('Open Workspace', '/app/dashboard');

    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.textContent = 'Sign Out';
    signOut.className = 'public-mobile-link';
    signOut.setAttribute('role', 'menuitem');
    signOut.style.cssText = 'display:block;width:100%;text-align:left;border:0;background:transparent;cursor:pointer;';
    signOut.addEventListener('click', async () => {
      signOut.disabled = true;
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        try { sessionStorage.removeItem('facicuse_user_session_token'); } catch {}
        window.location.assign('/');
      } catch {
        signOut.disabled = false;
        window.alert('Unable to sign out right now. Please try again.');
      }
    });
    menu.append(signOut);

    trigger.addEventListener('click', () => {
      const open = menu.hidden;
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (event) => {
      if (!wrap.contains(event.target)) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    wrap.append(trigger, menu);
    headerAuthCta.replaceWith(wrap);

    if (mobileMenu) {
      const mobileAuthCta = document.getElementById('mobile-auth-cta');
      if (mobileAuthCta) mobileAuthCta.remove();
      const mobileProfile = document.createElement('a');
      mobileProfile.href = '/app/profile';
      mobileProfile.className = 'public-mobile-link';
      mobileProfile.textContent = 'Profile';
      const mobileWorkspace = document.createElement('a');
      mobileWorkspace.href = '/app/dashboard';
      mobileWorkspace.className = 'public-mobile-link';
      mobileWorkspace.textContent = 'Open Workspace';
      const mobileSignOut = document.createElement('button');
      mobileSignOut.type = 'button';
      mobileSignOut.className = 'public-mobile-link';
      mobileSignOut.textContent = 'Sign Out';
      mobileSignOut.style.cssText = 'width:100%;text-align:left;border:0;background:transparent;cursor:pointer;';
      mobileSignOut.addEventListener('click', () => signOut.click());
      mobileMenu.append(mobileProfile, mobileWorkspace, mobileSignOut);
    }
  }

  async function syncAuthCtas() {
    try {
      const res = await fetch('/api/auth/session', {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      const user = data && data.user;
      if (!user) return;

      createAccountMenu(user);
      if (heroAuthCta) {
        heroAuthCta.href = '/app/dashboard';
        heroAuthCta.textContent = 'Open Workspace';
        heroAuthCta.removeAttribute('data-open-auth-modal');
      }
      if (previewAuthCta) {
        previewAuthCta.href = '/app/calendar';
        previewAuthCta.textContent = 'Open Calendar & Request';
        previewAuthCta.removeAttribute('data-open-auth-modal');
      }
      if (ctaAuthLink) {
        ctaAuthLink.href = '/app/dashboard';
        ctaAuthLink.textContent = 'Open Workspace';
        ctaAuthLink.removeAttribute('data-open-auth-modal');
      }
    } catch {
      // Keep default Sign In links for visitors.
    }
  }

  function resolvePath(obj, dotPath) {
    return dotPath.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : null), obj);
  }

  function hydrateProjectFields(project) {
    if (!project) return;
    document.querySelectorAll('[data-project-field]').forEach((el) => {
      const key = el.getAttribute('data-project-field');
      if (!key) return;
      const val = resolvePath(project, key);
      if (typeof val === 'string' || typeof val === 'number') {
        el.textContent = String(val);
        if (key === 'contactEmail' && el.tagName === 'A') el.setAttribute('href', 'mailto:' + val);
      }
    });
  }

  async function initProjectInfo() {
    try {
      const res = await fetch('/api/public/project-info');
      if (!res.ok) return;
      const payload = await res.json();
      if (payload && payload.project) hydrateProjectFields(payload.project);
    } catch {
      // Preserve static HTML fallbacks.
    }
  }

  syncAuthCtas();
  initProjectInfo();
})();
