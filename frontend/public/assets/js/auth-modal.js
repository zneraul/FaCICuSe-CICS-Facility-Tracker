'use strict';

(function initFacicuseAuthModal() {
  const backdrop = document.getElementById('auth-modal-backdrop');
  const dialog = document.getElementById('auth-modal-dialog');
  const closeBtn = document.getElementById('auth-modal-close');
  const form = document.getElementById('auth-modal-form');
  const emailInput = document.getElementById('auth-modal-email');
  const passwordInput = document.getElementById('auth-modal-password');
  const togglePasswordBtn = document.getElementById('auth-modal-toggle-password');
  const submitBtn = document.getElementById('auth-modal-submit');
  const googleBtn = document.getElementById('auth-modal-google-btn');
  const passwordSetupTrigger = document.getElementById('auth-modal-password-setup-trigger');
  const passwordSetupPanel = document.getElementById('auth-modal-password-setup-panel');
  const passwordSetupGoogleBtn = document.getElementById('auth-modal-password-setup-google');
  const passwordSetupForm = document.getElementById('auth-modal-password-setup-form');
  const newPasswordInput = document.getElementById('auth-modal-new-password');
  const confirmPasswordInput = document.getElementById('auth-modal-confirm-password');
  const passwordSetupSubmit = document.getElementById('auth-modal-password-setup-submit');
  const alertBox = document.getElementById('auth-modal-alert');
  const alertText = document.getElementById('auth-modal-alert-text');
  const alertIcon = document.getElementById('auth-modal-alert-icon');
  const domainsFootnote = document.getElementById('auth-modal-domains');
  const canvasRoot = document.querySelector('.ambient-canvas');

  if (!backdrop || !dialog || !form) return;

  const state = {
    isOpen: false,
    busy: '',
    returnTo: '/app/dashboard',
    lastFocused: null,
    allowedDomains: ['g.batstate-u.edu.ph', 'batstate-u.edu.ph'],
    allowedDomainsConfigured: true,
    firebaseConfig: null,
    firebaseModPromise: null,
    passwordSetupIdToken: null,
    closeTimer: null,
  };

  function resolvePostLoginPath(user, requestedPath) {
    const role = String(user && user.role ? user.role : '').toLowerCase();
    const raw = String(requestedPath || '').trim();
    if (raw.startsWith('/app/') && !raw.startsWith('//') && !raw.includes('://')) {
      const isAdminRoute = raw === '/app/admin' || raw.startsWith('/app/admin/');
      if (isAdminRoute && role !== 'admin') {
        return '/app/dashboard';
      }
      return raw;
    }
    return '/app/dashboard';
  }

  function formatRoleLabel(role) {
    if (role === 'admin') return 'System Administrator';
    if (role === 'professor') return 'Faculty';
    return 'Student';
  }

  function validateUniversityEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      return { valid: false, error: 'Please enter a valid university email address.' };
    }
    const parts = normalized.split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1] || !parts[1].includes('.')) {
      return { valid: false, error: 'Please enter a valid university email address.' };
    }
    if (
      state.allowedDomainsConfigured &&
      Array.isArray(state.allowedDomains) &&
      state.allowedDomains.length > 0 &&
      !state.allowedDomains.includes(parts[1])
    ) {
      return {
        valid: false,
        error:
          'Only verified university email domains (' +
          state.allowedDomains.join(', ') +
          ') are permitted.',
      };
    }
    return { valid: true, email: normalized };
  }

  function setAlert(type, message) {
    if (!alertBox || !alertText) return;
    if (!message) {
      alertBox.hidden = true;
      alertBox.className = 'auth-modal-alert';
      alertText.textContent = '';
      return;
    }

    alertBox.hidden = false;
    alertBox.setAttribute('role', type === 'error' ? 'alert' : 'status');
    alertBox.className = 'auth-modal-alert auth-modal-alert--' + type;
    alertText.textContent = message;

    if (alertIcon) {
      if (type === 'success') {
        alertIcon.innerHTML =
          '<circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path>';
      } else if (type === 'info') {
        alertIcon.innerHTML =
          '<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path>';
      } else {
        alertIcon.innerHTML =
          '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path>';
      }
    }
  }

  function setBusy(mode) {
    state.busy = mode || '';
    const isBusy = Boolean(state.busy);

    if (closeBtn) closeBtn.disabled = isBusy;
    if (emailInput) emailInput.disabled = isBusy;
    if (passwordInput) passwordInput.disabled = isBusy;
    if (togglePasswordBtn) togglePasswordBtn.disabled = isBusy;
    if (passwordSetupGoogleBtn) passwordSetupGoogleBtn.disabled = isBusy;
    if (newPasswordInput) newPasswordInput.disabled = isBusy;
    if (confirmPasswordInput) confirmPasswordInput.disabled = isBusy;
    if (passwordSetupSubmit) passwordSetupSubmit.disabled = isBusy;

    if (submitBtn) {
      submitBtn.disabled = isBusy;
      submitBtn.innerHTML =
        state.busy === 'email'
          ? '<span class="auth-modal-spinner" aria-hidden="true"></span><span>Signing In...</span>'
          : '<span>Sign In with University Email</span>';
    }

    if (googleBtn) {
      googleBtn.disabled = isBusy;
      const labelSpan = googleBtn.querySelector('[data-google-label]');
      const spinner = googleBtn.querySelector('[data-google-spinner]');
      const icon = googleBtn.querySelector('[data-google-icon]');
      if (labelSpan) {
        labelSpan.textContent =
          state.busy === 'google'
            ? 'Verifying Google Account...'
            : 'Sign In with University Google Account';
      }
      if (spinner) spinner.toggleAttribute('hidden', state.busy !== 'google');
      if (icon) icon.toggleAttribute('hidden', state.busy === 'google');
    }
  }

  function getFocusableElements() {
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    return Array.from(dialog.querySelectorAll(selectors)).filter((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && !el.hidden;
    });
  }

  function openModal(options) {
    const opts = options || {};
    if (state.closeTimer) {
      window.clearTimeout(state.closeTimer);
      state.closeTimer = null;
    }

    state.lastFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.returnTo = opts.returnTo || '/app/dashboard';
    state.isOpen = true;

    // Close mobile nav drawer if open
    const mobileDrawer = document.getElementById('public-mobile-menu');
    const mobileToggle = document.getElementById('public-mobile-toggle');
    if (mobileDrawer && !mobileDrawer.hidden) {
      mobileDrawer.hidden = true;
      if (mobileToggle) {
        mobileToggle.setAttribute('aria-expanded', 'false');
        mobileToggle.setAttribute('aria-label', 'Open navigation menu');
      }
    }

    if (opts.notice) {
      setAlert(opts.noticeType || 'info', opts.notice);
    } else {
      setAlert('', '');
    }

    backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    if (canvasRoot) {
      canvasRoot.setAttribute('aria-hidden', 'true');
      canvasRoot.inert = true;
    }

    window.requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      if (emailInput && !emailInput.disabled) {
        emailInput.focus();
      } else {
        dialog.focus();
      }
    });
  }

  function closeModal(force) {
    if (!state.isOpen) return;
    if (state.busy && !force) return;

    state.isOpen = false;
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
    if (canvasRoot) {
      canvasRoot.removeAttribute('aria-hidden');
      canvasRoot.inert = false;
    }

    state.closeTimer = window.setTimeout(() => {
      if (!state.isOpen) {
        backdrop.hidden = true;
      }
    }, 210);

    if (state.lastFocused && typeof state.lastFocused.focus === 'function') {
      state.lastFocused.focus();
    }
    state.lastFocused = null;
  }

  function completeRedirect(user) {
    const destination = resolvePostLoginPath(user, state.returnTo);
    const displayName = user && user.fullName ? user.fullName : 'Campus User';
    const roleName = formatRoleLabel(user && user.role);
    setAlert('success', 'Signed in as ' + displayName + ' (' + roleName + '). Opening workspace...');
    window.setTimeout(() => {
      window.location.assign(destination);
    }, 320);
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    if (state.busy) return;

    const rawEmail = emailInput ? emailInput.value.trim() : '';
    const rawPassword = passwordInput ? passwordInput.value : '';

    const emailCheck = validateUniversityEmail(rawEmail);
    if (!emailCheck.valid) {
      setAlert('error', emailCheck.error);
      if (emailInput) emailInput.focus();
      return;
    }
    if (!rawPassword) {
      setAlert('error', 'Please enter your FaCICuSe password.');
      if (passwordInput) passwordInput.focus();
      return;
    }

    setAlert('', '');
    setBusy('email');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailCheck.email, password: rawPassword }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Invalid university email or password.');
      }

      completeRedirect(data.user);
    } catch (error) {
      setBusy('');
      setAlert('error', error.message || 'Unable to sign in. Please verify your credentials.');
    }
  }

  async function loadFirebaseAuthBridge() {
    if (state.firebaseModPromise) return state.firebaseModPromise;
    if (!state.firebaseConfig || !state.firebaseConfig.apiKey) {
      throw new Error('Google Sign-In is not configured in this environment.');
    }

    state.firebaseModPromise = (async () => {
      const [appMod, authMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
      ]);
      const existingApps = appMod.getApps();
      const app =
        existingApps.length > 0
          ? existingApps[0]
          : appMod.initializeApp(state.firebaseConfig);
      const auth = authMod.getAuth(app);
      const provider = new authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return { auth, provider, signInWithPopup: authMod.signInWithPopup, signOut: authMod.signOut };
    })();

    return state.firebaseModPromise;
  }

  async function handleGoogleSignIn() {
    if (state.busy) return;
    setAlert('', '');
    setBusy('google');

    let fbBridge = null;
    try {
      fbBridge = await loadFirebaseAuthBridge();
      const result = await fbBridge.signInWithPopup(fbBridge.auth, fbBridge.provider);
      const idToken = await result.user.getIdToken();

      const response = await fetch('/api/auth/session/google', {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: 'Bearer ' + idToken },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        await fbBridge.signOut(fbBridge.auth).catch(() => {});
        throw new Error(data.error || 'Unable to verify your university Google account.');
      }

      completeRedirect(data.user);
    } catch (error) {
      if (fbBridge) {
        await fbBridge.signOut(fbBridge.auth).catch(() => {});
      }
      setBusy('');
      const code = error && error.code ? String(error.code) : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAlert('info', 'Google Sign-In was cancelled before completing.');
      } else if (code === 'auth/popup-blocked') {
        setAlert(
          'error',
          'Your browser blocked the Google Sign-In popup. Allow popups for this site or use /signin.'
        );
      } else {
        setAlert('error', error.message || 'Google Sign-In did not complete.');
      }
    }
  }

  async function handlePasswordSetupGoogle() {
    if (state.busy) return;
    setAlert('', '');
    setBusy('google-setup');

    try {
      const fbBridge = await loadFirebaseAuthBridge();
      const result = await fbBridge.signInWithPopup(fbBridge.auth, fbBridge.provider);
      const idToken = await result.user.getIdToken();
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: { Authorization: 'Bearer ' + idToken },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Unable to verify your university Google account.');
      }

      state.passwordSetupIdToken = idToken;
      if (passwordSetupGoogleBtn) passwordSetupGoogleBtn.hidden = true;
      if (passwordSetupForm) passwordSetupForm.hidden = false;
      setBusy('');
      setAlert('success', 'University account verified. Create your separate FaCICuSe password below.');
      if (newPasswordInput) newPasswordInput.focus();
    } catch (error) {
      setBusy('');
      setAlert('error', error.message || 'Unable to verify your university Google account.');
    }
  }

  async function handlePasswordSetupSubmit(event) {
    event.preventDefault();
    if (state.busy) return;
    if (!state.passwordSetupIdToken) {
      setAlert('error', 'Verify your university Google account before setting a password.');
      return;
    }

    const password = newPasswordInput ? newPasswordInput.value : '';
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
    if (password.length < 12) {
      setAlert('error', 'Choose a FaCICuSe password with at least 12 characters.');
      if (newPasswordInput) newPasswordInput.focus();
      return;
    }
    if (password.length > 128) {
      setAlert('error', 'Your FaCICuSe password must be 128 characters or fewer.');
      if (newPasswordInput) newPasswordInput.focus();
      return;
    }
    if (password !== confirmPassword) {
      setAlert('error', 'The password confirmation does not match.');
      if (confirmPasswordInput) confirmPasswordInput.focus();
      return;
    }

    setBusy('password-setup');
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + state.passwordSetupIdToken,
      };
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Unable to save your FaCICuSe password.');
      }

      const sessionResponse = await fetch('/api/auth/session/google', {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: 'Bearer ' + state.passwordSetupIdToken },
      });
      const sessionData = await sessionResponse.json().catch(() => ({}));
      if (!sessionResponse.ok) {
        throw new Error(sessionData.error || 'Password saved, but the sign-in session could not be established.');
      }

      completeRedirect(sessionData.user);
    } catch (error) {
      setBusy('');
      setAlert('error', error.message || 'Unable to save your FaCICuSe password.');
    }
  }

  async function loadAuthConfig() {
    try {
      const res = await fetch('/api/auth/config', { credentials: 'include' });
      if (!res.ok) return;
      const cfg = await res.json();
      if (Array.isArray(cfg.allowedDomains) && cfg.allowedDomains.length > 0) {
        state.allowedDomains = cfg.allowedDomains;
      }
      state.allowedDomainsConfigured = cfg.allowedDomainsConfigured !== false;
      state.firebaseConfig = cfg.firebaseConfig || null;

      if (emailInput && state.allowedDomains[0]) {
        emailInput.placeholder = 'name@' + state.allowedDomains[0];
      }
      if (domainsFootnote && state.allowedDomains.length > 0) {
        domainsFootnote.textContent = state.allowedDomains.join(', ');
      }
    } catch {
      // Keep default BatStateU domains
    }
  }

  function initEventListeners() {
    // Open modal from any [data-open-auth-modal] trigger on the homepage
    document.addEventListener('click', (event) => {
      const trigger =
        event.target instanceof Element ? event.target.closest('[data-open-auth-modal]') : null;
      if (!trigger) return;

      // Respect modifier clicks (open in new tab)
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }

      // If project-sync already converted this CTA to an authenticated /app/* route, follow it directly
      const href = trigger.getAttribute('href') || '';
      if (href.startsWith('/app/')) return;

      event.preventDefault();
      const returnTo = trigger.getAttribute('data-return-to') || '/app/dashboard';
      openModal({ returnTo });
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal(false));
    }

    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        closeModal(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (!state.isOpen) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal(false);
        return;
      }

      if (event.key === 'Tab') {
        const focusables = getFocusableElements();
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first || !dialog.contains(document.activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !dialog.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    form.addEventListener('submit', handleEmailSubmit);

    if (passwordSetupTrigger && passwordSetupPanel) {
      passwordSetupTrigger.addEventListener('click', () => {
        passwordSetupPanel.hidden = false;
        passwordSetupTrigger.hidden = true;
        setAlert('info', 'You can create a separate FaCICuSe password after verifying your university Google account.');
      });
    }
    if (passwordSetupGoogleBtn) {
      passwordSetupGoogleBtn.addEventListener('click', handlePasswordSetupGoogle);
    }
    if (passwordSetupForm) {
      passwordSetupForm.addEventListener('submit', handlePasswordSetupSubmit);
    }

    if (togglePasswordBtn && passwordInput) {
      togglePasswordBtn.addEventListener('click', () => {
        const showing = passwordInput.type === 'text';
        passwordInput.type = showing ? 'password' : 'text';
        togglePasswordBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        togglePasswordBtn.setAttribute('aria-pressed', showing ? 'false' : 'true');
        const eyeOpen = togglePasswordBtn.querySelector('[data-eye-open]');
        const eyeClosed = togglePasswordBtn.querySelector('[data-eye-closed]');
        if (eyeOpen) eyeOpen.toggleAttribute('hidden', !showing);
        if (eyeClosed) eyeClosed.toggleAttribute('hidden', showing);
      });
    }

    if (googleBtn) {
      googleBtn.addEventListener('click', handleGoogleSignIn);
    }
  }

  function checkInitialQueryIntent() {
    try {
      const params = new URLSearchParams(window.location.search);
      const authParam = params.get('auth');
      const returnTo = params.get('from') || '/app/dashboard';
      if (authParam === 'expired') {
        openModal({
          returnTo,
          noticeType: 'error',
          notice: 'Your session has expired. Please sign in again to continue.',
        });
      } else if (authParam === 'signin') {
        openModal({ returnTo });
      }
    } catch {
      // Ignore query parse failures
    }
  }

  window.FaCICuSeAuthModal = {
    open: openModal,
    close: closeModal,
  };

  initEventListeners();
  loadAuthConfig();
  checkInitialQueryIntent();
})();
