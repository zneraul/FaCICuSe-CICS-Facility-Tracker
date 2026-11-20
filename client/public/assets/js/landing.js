'use strict';

(function initFacicuseLanding() {
  const SECTION_IDS = ['home', 'facilities', 'reservations', 'about', 'faq', 'contact'];

  const state = {
    category: 'All',
    floor: 'All Floors',
    reservableOnly: false,
    search: '',
    facilities: [],
    activeSection: 'home',
    manualLockUntil: 0,
  };

  // DOM References
  const desktopNavLinks = Array.from(document.querySelectorAll('.public-nav-link[data-section-link]'));
  const mobileNavLinks = Array.from(document.querySelectorAll('.public-mobile-link[data-section-link]'));
  const allSectionLinks = Array.from(document.querySelectorAll('a[data-section-link]'));
  const mobileToggle = document.getElementById('public-mobile-toggle');
  const mobileDrawer = document.getElementById('public-mobile-menu');

  const heroStatTotal = document.getElementById('hero-stat-total');
  const heroStatActive = document.getElementById('hero-stat-active');
  const heroStatCapacity = document.getElementById('hero-stat-capacity');

  const searchForm = document.getElementById('landing-search-form');
  const searchInput = document.getElementById('landing-facility-search');
  const floorSelect = document.getElementById('landing-floor-select');
  const reservableToggle = document.getElementById('landing-reservable-toggle');
  const categoryTabs = Array.from(document.querySelectorAll('#landing-category-tabs [data-category]'));
  const facilitiesContainer = document.getElementById('landing-facilities-container');

  const previewForm = document.getElementById('availability-preview-form');
  const previewFacilitySelect = document.getElementById('preview-facility-select');
  const previewDateInput = document.getElementById('preview-date-input');
  const previewValidationMsg = document.getElementById('preview-validation-msg');
  const previewScheduleBox = document.getElementById('preview-schedule-box');
  const previewFacilityLink = document.getElementById('preview-facility-link');

  const faqTriggers = Array.from(document.querySelectorAll('#landing-faq-list .faq-trigger'));

  function getDefaultTomorrowIso() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function statusClassName(status) {
    return 'status-' + String(status || 'pending').toLowerCase().replace(/\s+/g, '-');
  }

  function setActiveSection(sectionId) {
    if (!SECTION_IDS.includes(sectionId)) return;
    state.activeSection = sectionId;

    desktopNavLinks.forEach((link) => {
      const active = link.dataset.sectionLink === sectionId;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });

    mobileNavLinks.forEach((link) => {
      const active = link.dataset.sectionLink === sectionId;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function setMobileMenuOpen(open) {
    if (!mobileDrawer || !mobileToggle) return;
    mobileDrawer.hidden = !open;
    mobileToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    mobileToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  }

  function scrollToSection(sectionId, behavior) {
    if (sectionId === 'home') {
      window.scrollTo({ top: 0, behavior: behavior || 'smooth' });
      return;
    }
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: behavior || 'smooth', block: 'start' });
    }
  }

  // 1. Same-page smooth navigation & active section highlight tracking
  function initNavigation() {
    allSectionLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        const sectionId = link.dataset.sectionLink;
        if (!sectionId) return;
        event.preventDefault();
        setMobileMenuOpen(false);
        setActiveSection(sectionId);
        state.manualLockUntil = Date.now() + 850;
        window.history.replaceState(null, '', '#' + sectionId);
        scrollToSection(sectionId, 'smooth');
      });
    });

    if (mobileToggle) {
      mobileToggle.addEventListener('click', () => {
        const isOpen = mobileToggle.getAttribute('aria-expanded') === 'true';
        setMobileMenuOpen(!isOpen);
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1120) {
        setMobileMenuOpen(false);
      }
    });

    const visibleRatios = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleRatios.set(entry.target.id, entry.intersectionRatio);
          } else {
            visibleRatios.delete(entry.target.id);
          }
        });

        if (Date.now() < state.manualLockUntil) return;

        if (window.scrollY < 70) {
          setActiveSection('home');
          return;
        }

        const nearBottom =
          window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40;
        if (nearBottom) {
          setActiveSection('about');
          return;
        }

        let bestId = '';
        let bestScore = -Infinity;
        SECTION_IDS.forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          const rect = el.getBoundingClientRect();
          if (rect.bottom < 88 || rect.top > window.innerHeight * 0.72) return;
          const headerDistance = Math.abs(rect.top - 104);
          const ratioBonus = (visibleRatios.get(id) || 0) * 200;
          const score = ratioBonus - headerDistance;
          if (score > bestScore) {
            bestScore = score;
            bestId = id;
          }
        });

        if (bestId) {
          setActiveSection(bestId);
        }
      },
      {
        rootMargin: '-88px 0px -35% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75],
      }
    );

    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    const initialHash = window.location.hash ? window.location.hash.replace('#', '') : '';
    if (initialHash && SECTION_IDS.includes(initialHash)) {
      setActiveSection(initialHash);
      state.manualLockUntil = Date.now() + 1000;
      window.setTimeout(() => scrollToSection(initialHash, 'smooth'), 60);
    }
  }

  // 2. Render Compact Architectural Facility Cards cleanly (prevents XSS)
  function createFacilityCardElement(facility) {
    const article = document.createElement('article');
    article.className = 'facility-card';

    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'facility-media-wrap';
    const photo = document.createElement('img');
    photo.className = 'facility-media-img';
    photo.alt = facility.name || 'CICS facility';
    photo.loading = 'lazy';
    photo.decoding = 'async';
    const fallbackImage = facility.category === 'Administrative'
      ? '/assets/images/cics-smart-room.jpg'
      : facility.category === 'Support'
        ? '/assets/images/cics-building.jpg'
        : /laboratory|lab/i.test(facility.name || '')
          ? '/assets/images/cics-lab.jpg'
          : '/assets/images/cics-classroom.jpg';
    photo.src = facility.imageUrl || fallbackImage;
    photo.addEventListener('error', () => {
      if (photo.src !== new URL(fallbackImage, window.location.origin).href) {
        photo.src = fallbackImage;
      } else {
        mediaWrap.remove();
      }
    }, { once: true });
    mediaWrap.appendChild(photo);

    const body = document.createElement('div');
    body.className = 'facility-card-body';

    const metaTop = document.createElement('div');
    metaTop.className = 'meta-line';

    const codeSpan = document.createElement('span');
    codeSpan.className = 'tabular';
    codeSpan.style.fontWeight = '600';
    codeSpan.style.color = 'var(--accent-blue)';
    codeSpan.textContent = facility.code || '';

    const dot1 = document.createElement('span');
    dot1.setAttribute('aria-hidden', 'true');
    dot1.textContent = '·';

    const catSpan = document.createElement('span');
    catSpan.textContent = facility.category || '';

    const dot2 = document.createElement('span');
    dot2.setAttribute('aria-hidden', 'true');
    dot2.textContent = '·';

    const statusSpan = document.createElement('span');
    statusSpan.className = 'status-text ' + statusClassName(facility.status);
    statusSpan.textContent = facility.status || '';

    metaTop.append(codeSpan, dot1, catSpan, dot2, statusSpan);

    const title = document.createElement('h3');
    title.className = 'facility-card-title';
    title.textContent = facility.name || '';

    const desc = document.createElement('p');
    desc.className = 'facility-card-desc';
    desc.textContent = facility.description || '';

    const metaLoc = document.createElement('div');
    metaLoc.className = 'meta-line';
    metaLoc.style.marginTop = '0.2rem';

    const floorSpan = document.createElement('span');
    floorSpan.textContent = facility.floor || 'Floor unspecified';

    const dot3 = document.createElement('span');
    dot3.setAttribute('aria-hidden', 'true');
    dot3.textContent = '·';

    const cap = document.createElement('span');
    cap.textContent =
      facility.capacity != null
        ? 'Cap. ' + String(facility.capacity)
        : facility.isReservable === false
          ? 'Directory only'
          : 'Bookable room';

    metaLoc.append(floorSpan, dot3, cap);

    const footer = document.createElement('div');
    footer.className = 'facility-card-footer';

    const hoursTime = document.createElement('time');
    hoursTime.className = 'tabular';
    hoursTime.style.fontSize = '0.8rem';
    hoursTime.style.color = 'var(--ink-muted)';
    hoursTime.textContent = (facility.openHour || '') + '–' + (facility.closeHour || '');

    const detailsLink = document.createElement('a');
    detailsLink.className = 'btn btn-glass btn-sm';
    detailsLink.href = '/facilities/' + encodeURIComponent(facility.id);
    detailsLink.textContent = facility.isReservable === false ? 'View Room' : 'Inspect & Book';

    footer.append(hoursTime, detailsLink);
    body.append(metaTop, title, desc, metaLoc, footer);
    article.append(mediaWrap, body);
    return article;
  }

  function renderFacilities(rawList) {
    if (!facilitiesContainer) return;
    facilitiesContainer.textContent = '';

    const list = state.reservableOnly
      ? (rawList || []).filter((f) => f.isReservable !== false)
      : rawList || [];

    if (!Array.isArray(list) || list.length === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'glass-panel state-panel-center';

      const msg = document.createElement('p');
      msg.style.color = 'var(--ink-secondary)';
      msg.textContent = 'No CICS facilities match your current filter.';

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'btn btn-glass btn-sm';
      resetBtn.style.marginTop = '0.85rem';
      resetBtn.textContent = 'Reset Filters';
      resetBtn.addEventListener('click', () => {
        state.category = 'All';
        state.floor = 'All Floors';
        state.reservableOnly = false;
        state.search = '';
        if (searchInput) searchInput.value = '';
        if (floorSelect) floorSelect.value = 'All Floors';
        if (reservableToggle) {
          reservableToggle.setAttribute('aria-pressed', 'false');
          reservableToggle.classList.remove('btn-coral');
          reservableToggle.classList.add('btn-glass');
        }
        categoryTabs.forEach((t) => {
          const isAll = t.dataset.category === 'All';
          t.classList.toggle('active', isAll);
          t.setAttribute('aria-selected', isAll ? 'true' : 'false');
        });
        fetchFacilities();
      });

      emptyBox.append(msg, resetBtn);
      facilitiesContainer.appendChild(emptyBox);
      return;
    }

    const previewItems = list.slice(0, 6);
    const grid = document.createElement('div');
    grid.className = 'facilities-grid';
    previewItems.forEach((facility) => {
      grid.appendChild(createFacilityCardElement(facility));
    });
    facilitiesContainer.appendChild(grid);

    const footerBar = document.createElement('div');
    footerBar.className = 'directory-preview-footer';

    const countSpan = document.createElement('span');
    countSpan.textContent =
      'Showing ' +
      previewItems.length +
      ' of ' +
      list.length +
      ' matching CICS Building spaces.';

    const allLink = document.createElement('a');
    allLink.href = '/facilities';
    allLink.className = 'btn btn-glass btn-sm';
    allLink.textContent = 'Browse all ' + list.length + ' spaces →';

    footerBar.append(countSpan, allLink);
    facilitiesContainer.appendChild(footerBar);
  }

  async function fetchFacilities(isInitial) {
    if (facilitiesContainer) {
      facilitiesContainer.innerHTML =
        '<div class="glass-panel state-panel-center">Loading CICS Building facilities...</div>';
    }
    try {
      const params = new URLSearchParams();
      if (state.category !== 'All') params.set('category', state.category);
      if (state.floor && state.floor !== 'All Floors') params.set('floor', state.floor);
      if (state.search.trim()) params.set('search', state.search.trim());
      const qs = params.toString();
      const res = await fetch('/api/public/facilities' + (qs ? '?' + qs : ''));
      if (!res.ok) throw new Error('Unable to load facilities.');
      const data = await res.json();
      const list = Array.isArray(data.facilities) ? data.facilities : [];
      state.lastFetchedList = list;
      renderFacilities(list);

      if (isInitial) {
        state.facilities = list;
        const reservableActiveCount = list.filter(
          (f) => f.isReservable !== false && f.status === 'Available'
        ).length;
        const distinctFloors = new Set(list.map((f) => f.floor).filter(Boolean)).size || 5;
        if (heroStatTotal) heroStatTotal.textContent = '38';
        if (heroStatActive) heroStatActive.textContent = String(reservableActiveCount);
        if (heroStatCapacity) heroStatCapacity.textContent = String(distinctFloors);

        const previewCandidates = list.filter((f) => f.isReservable !== false);
        populatePreviewSelect(previewCandidates.length > 0 ? previewCandidates : list);
      }
    } catch {
      renderFacilities([]);
    }
  }

  // 3. Live Availability Preview Form Validation & Fetch
  function populatePreviewSelect(list) {
    if (!previewFacilitySelect) return;
    previewFacilitySelect.textContent = '';

    if (!list.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No reservable facilities available';
      previewFacilitySelect.appendChild(opt);
      return;
    }

    list.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = String(f.id);
      opt.textContent = f.code + ' · ' + f.name + (f.floor ? ' (' + f.floor + ')' : '');
      previewFacilitySelect.appendChild(opt);
    });

    previewFacilitySelect.value = String(list[0].id);
    if (previewFacilityLink) {
      previewFacilityLink.href = '/facilities/' + encodeURIComponent(list[0].id);
      previewFacilityLink.hidden = false;
    }
    validateAndLoadPreviewSchedule();
  }

  function showPreviewValidationError(message) {
    if (!previewValidationMsg) return;
    if (!message) {
      previewValidationMsg.hidden = true;
      previewValidationMsg.textContent = '';
    } else {
      previewValidationMsg.hidden = false;
      previewValidationMsg.textContent = message;
    }
  }

  function renderPreviewSchedule(detail, targetDate) {
    if (!previewScheduleBox) return;
    previewScheduleBox.textContent = '';

    if (!detail || !detail.facility) {
      const p = document.createElement('p');
      p.className = 'card-body-copy';
      p.textContent = 'Select a CICS facility to inspect its schedule.';
      previewScheduleBox.appendChild(p);
      return;
    }

    const head = document.createElement('div');
    head.className = 'preview-result-head';

    const left = document.createElement('div');
    const title = document.createElement('strong');
    title.style.fontSize = '0.96rem';
    title.style.color = 'var(--ink-primary)';
    title.textContent = detail.facility.name || '';

    const meta = document.createElement('div');
    meta.className = 'meta-line';
    const bld = document.createElement('span');
    bld.textContent = detail.facility.floor || detail.facility.building || '';
    const dot = document.createElement('span');
    dot.setAttribute('aria-hidden', 'true');
    dot.textContent = '·';
    const hrs = document.createElement('span');
    hrs.className = 'tabular';
    hrs.textContent = 'Hours ' + detail.facility.openHour + '–' + detail.facility.closeHour;
    meta.append(bld, dot, hrs);
    left.append(title, meta);

    const status = document.createElement('span');
    status.className = 'status-text ' + statusClassName(detail.facility.status);
    status.textContent = detail.facility.status || '';

    head.append(left, status);
    previewScheduleBox.appendChild(head);

    if (Array.isArray(detail.schedule) && detail.schedule.length > 0) {
      const list = document.createElement('div');
      list.className = 'schedule-list';
      detail.schedule.forEach((slot) => {
        const row = document.createElement('div');
        row.className = 'schedule-row';
        row.style.padding = '0.5rem 0';

        const timeRange = document.createElement('span');
        timeRange.className = 'tabular';
        timeRange.style.fontWeight = '600';
        timeRange.style.fontSize = '0.86rem';
        timeRange.textContent = slot.startTime + ' – ' + slot.endTime;

        const slotStatus = document.createElement('span');
        slotStatus.className = 'status-text ' + statusClassName(slot.status);
        slotStatus.textContent = slot.status || '';

        row.append(timeRange, slotStatus);
        list.appendChild(row);
      });
      previewScheduleBox.appendChild(list);
    } else {
      const p = document.createElement('p');
      p.style.fontSize = '0.86rem';
      p.style.color = 'var(--ink-secondary)';
      p.textContent =
        'No active reservations recorded for ' +
        targetDate +
        '. Hours between ' +
        detail.facility.openHour +
        '–' +
        detail.facility.closeHour +
        ' are currently open.';
      previewScheduleBox.appendChild(p);
    }
  }

  async function validateAndLoadPreviewSchedule() {
    if (!previewFacilitySelect || !previewDateInput) return;

    const facilityId = previewFacilitySelect.value.trim();
    const targetDate = previewDateInput.value.trim();

    if (!facilityId) {
      showPreviewValidationError('Please select a CICS facility before checking availability.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      showPreviewValidationError('Please enter a valid target date (YYYY-MM-DD).');
      return;
    }

    showPreviewValidationError('');
    if (previewFacilityLink) {
      previewFacilityLink.href = '/facilities/' + encodeURIComponent(facilityId);
      previewFacilityLink.hidden = false;
    }

    if (previewScheduleBox) {
      previewScheduleBox.innerHTML =
        '<p style="font-size:0.88rem;color:var(--ink-muted);">Checking recorded booking windows...</p>';
    }

    try {
      const res = await fetch(
        '/api/public/facilities/' +
          encodeURIComponent(facilityId) +
          '?date=' +
          encodeURIComponent(targetDate)
      );
      const data = await res.json();
      if (!res.ok) {
        showPreviewValidationError(data.error || 'Unable to inspect availability for that date.');
        renderPreviewSchedule(null, targetDate);
        return;
      }
      renderPreviewSchedule(data, targetDate);
    } catch {
      showPreviewValidationError('Network error while checking live availability.');
      renderPreviewSchedule(null, targetDate);
    }
  }

  // 4. Event Listeners
  function initInteractions() {
    categoryTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        state.category = tab.dataset.category || 'All';
        categoryTabs.forEach((btn) => {
          const active = btn === tab;
          btn.classList.toggle('active', active);
          btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        fetchFacilities(false);
      });
    });

    if (floorSelect) {
      floorSelect.addEventListener('change', () => {
        state.floor = floorSelect.value || 'All Floors';
        fetchFacilities(false);
      });
    }

    if (reservableToggle) {
      reservableToggle.addEventListener('click', () => {
        state.reservableOnly = !state.reservableOnly;
        reservableToggle.setAttribute('aria-pressed', state.reservableOnly ? 'true' : 'false');
        reservableToggle.classList.toggle('btn-coral', state.reservableOnly);
        reservableToggle.classList.toggle('btn-glass', !state.reservableOnly);
        renderFacilities(state.lastFetchedList || state.facilities);
      });
    }

    let searchTimer = null;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        state.search = searchInput.value;
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => fetchFacilities(false), 200);
      });
    }

    if (searchForm) {
      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        state.search = searchInput ? searchInput.value : '';
        fetchFacilities(false);
      });
    }

    if (previewDateInput && !previewDateInput.value) {
      previewDateInput.value = getDefaultTomorrowIso();
    }

    if (previewForm) {
      previewForm.addEventListener('submit', (event) => {
        event.preventDefault();
        validateAndLoadPreviewSchedule();
      });
    }

    if (previewFacilitySelect) {
      previewFacilitySelect.addEventListener('change', validateAndLoadPreviewSchedule);
    }
    if (previewDateInput) {
      previewDateInput.addEventListener('change', validateAndLoadPreviewSchedule);
    }

    faqTriggers.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const wasExpanded = trigger.getAttribute('aria-expanded') === 'true';
        faqTriggers.forEach((btn) => {
          const panelId = btn.getAttribute('aria-controls');
          const panel = panelId ? document.getElementById(panelId) : null;
          const expand = btn === trigger ? !wasExpanded : false;
          btn.setAttribute('aria-expanded', expand ? 'true' : 'false');
          if (panel) panel.hidden = !expand;
        });
      });
    });
  }

  initNavigation();
  initInteractions();
  fetchFacilities(true);
})();
