(function () {
    const INV = window.PAYDAY_DECK_INVENTORY;
    const R = window.PaydayDeckRenderer;
    const previewCanvas = document.getElementById('preview-canvas');
    const previewFrame = document.getElementById('preview-frame');
    const assetLoader = document.getElementById('asset-loader');
    const assetLoaderName = document.getElementById('asset-loader-name');
    const assetLoaderSub = document.getElementById('asset-loader-sub');

    const DEV_MODE = new URLSearchParams(location.search).get('dev') === '1';
    if (DEV_MODE) {
      document.body.classList.add('dev-mode');
      document.getElementById('shopify-connect-open').hidden = false;
      document.getElementById('shopify-status').hidden = false;
      const dv = document.getElementById('dev-vitals-wrap');
      if (dv) dv.removeAttribute('aria-hidden');
      window.PAYDAY_DEV_VITALS?.init?.();
    }

    function appendDevQuery(url) {
      if (!DEV_MODE) return url;
      try {
        const u = new URL(url, location.href);
        u.searchParams.set('dev', '1');
        return u.pathname + u.search;
      } catch {
        return url;
      }
    }
    const navCfg = document.getElementById('nav-configurator');
    if (navCfg) {
      const editorHref =
        (window.PAYDAY_PATHS && window.PAYDAY_PATHS.editorUrl) || navCfg.getAttribute('href') || '../decks/editor.html';
      navCfg.href = appendDevQuery(editorHref);
    }

    function logShopConfig(reason) {
      const d = currentDesign?.();
      const size = INV.SIZES?.[state.sizeIndex];
      window.PAYDAY_CONFIG_LOG?.push({
        source: 'shop',
        label: reason,
        design: d ? d.name || d.id : null,
        size: size ? size.label || size.id : null,
        cart: state.cart.map((c) => c.id).join(', ') || 'leer',
      });
      if (DEV_MODE) window.PAYDAY_CONFIG_LOG?.renderList('session-config-log');
    }

    const state = {
      phase: 'loading',
      designIndex: 0,
      sizeIndex: 0,
      unlocked: false,
      cart: [],
      stock: INV.cloneStock(),
      shopifyPrices: {},
      shopifyCompareAt: {},
      storefrontLive: false,
      storefrontSyncAt: null,
      storefrontPrefetchDone: false,
      reservationAvailability: null,
      baseStock: null,
      reservationsActive: false,
      filterDesign: null,
      filterSize: null,
      visitedDesigns: new Set(),
      rendererReady: false,
      swipeCount: 0,
      introRunning: false,
    };

    const SWIPE_MIN = 40;
    const TAP_MAX_MOVE = 14;
    const INTRO_DURATION_MS = 1000;
    const SWIPES_REQUIRED = 3;
    const INTRO_PROGRESS_SHARE = 25;
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerActive = false;
    let pointerTargetEl = null;
    let suppressTapUntil = 0;
    let loadTickerTimer = null;

    function navVerb() {
      return 'Wischen / Tippen / Weiter';
    }

    function boardArtifactQueue() {
      const names = [];
      INV.DESIGNS.forEach((d) => {
        const meta = INV.getBoardMeta(d);
        if (meta?.source) names.push(meta.source);
      });
      R.ILLUSTRATIONS.forEach((ill) => names.push(ill.name));
      names.push('payday_logo_aligned');
      return names;
    }

    function setLoaderName(name, sub) {
      if (!assetLoaderName) return;
      assetLoaderName.textContent = name;
      if (sub && assetLoaderSub) assetLoaderSub.textContent = sub;
    }

    function showAssetLoader(show) {
      assetLoader?.classList.toggle('is-hidden', !show);
      previewFrame?.classList.toggle('is-interactive', !show && !state.unlocked);
    }

    function startLoadTicker() {
      const queue = boardArtifactQueue();
      let i = 0;
      setLoaderName(queue[0] || 'payday_CHROME', 'Artefakte werden geladen…');
      loadTickerTimer = setInterval(() => {
        i = (i + 1) % queue.length;
        setLoaderName(queue[i], 'Board-Archiv · ' + (i + 1) + '/' + queue.length);
      }, 420);
    }

    function stopLoadTicker() {
      if (loadTickerTimer) clearInterval(loadTickerTimer);
      loadTickerTimer = null;
    }

    function preloadBoardThumbs(onName) {
      const tasks = INV.DESIGNS.map((design) => () => new Promise((resolve) => {
        const meta = INV.getBoardMeta(design);
        onName(meta.source);
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = INV.thumbUrl(design);
      }));
      return tasks.reduce((p, task) => p.then(task), Promise.resolve());
    }

    function currentDesign() { return INV.DESIGNS[state.designIndex]; }
    function currentSize() { return INV.SIZES[state.sizeIndex]; }

    function reservationsEnabled() {
      return Boolean(window.PAYDAY_RESERVATIONS?.isEnabled?.());
    }

    function sumStockMap(map) {
      if (!map || typeof map !== 'object') return 0;
      return Object.values(map).reduce((s, n) => s + (Math.max(0, Number(n)) || 0), 0);
    }

    /** SSOT: Postgres availability (reservation-api), sonst Katalog state.stock. */
    function displayTotalBoards() {
      if (state.reservationsActive && state.reservationAvailability) {
        return sumStockMap(state.reservationAvailability);
      }
      return INV.totalStock(state.stock);
    }

    function updateShopSubtitle() {
      const sub = document.getElementById('shop-subtitle');
      if (!sub) return;
      const total = displayTotalBoards();
      const live = state.storefrontLive ? ' · Preise live (Shopify)' : '';
      sub.textContent =
        total + ' Decks · Alle ' + INV.DESIGNS.length + ' Designs · 8.38″ & 8.5″' + live;
    }

    function applyReservationFromSync(sync) {
      if (!sync?.availability) return;
      applyReservationAvailability({
        availability: sync.availability,
        baseStock: sync.baseStock,
      });
    }

    function applyReservationAvailability(detail) {
      const availability =
        detail && detail.availability && typeof detail.availability === 'object'
          ? detail.availability
          : detail;
      if (!availability || typeof availability !== 'object') return;

      const baseStock =
        detail?.baseStock && typeof detail.baseStock === 'object' ? detail.baseStock : null;
      const availSum = sumStockMap(availability);
      const baseSum = sumStockMap(baseStock);

      if (availSum === 0 && baseSum === 0) {
        state.reservationsActive = false;
        state.reservationAvailability = null;
        console.warn(
          '[reservations] Postgres-Bestand ist 0 — UI nutzt Katalog-Fallback. Shopify-Inventar prüfen und shop-sync ausführen.'
        );
        updateStockLabels();
        if (state.unlocked) {
          updateShopSubtitle();
          renderShopGrid();
        }
        return;
      }

      state.reservationAvailability = { ...availability };
      if (baseStock) {
        state.baseStock = { ...baseStock };
        Object.keys(state.baseStock).forEach((sku) => {
          state.stock[sku] = state.baseStock[sku];
        });
        rebuildCatalogFromState();
      }
      state.reservationsActive = true;
      updateStockLabels();
      if (state.unlocked) {
        updateShopSubtitle();
        renderShopGrid();
      }
    }

    function displayBaseStock(skuId, item) {
      if (state.baseStock && skuId in state.baseStock) return Math.max(0, Number(state.baseStock[skuId]) || 0);
      const fromItem = item?.stock ?? state.stock[skuId];
      return Math.max(0, Number(fromItem) || 0);
    }

    function formatAvailabilityLabel(avail, base) {
      if (avail <= 0) return 'Ausverkauft';
      const denom = Math.max(base, avail);
      if (denom <= 0) return `${avail} verfügbar`;
      return `${avail} von ${denom} verfügbar`;
    }

    function availableStock(skuId) {
      if (state.reservationsActive && state.reservationAvailability && skuId in state.reservationAvailability) {
        return Math.max(0, state.reservationAvailability[skuId]);
      }
      const reserved = state.cart.filter(i => i.id === skuId).length;
      return Math.max(0, (state.stock[skuId] ?? 0) - reserved);
    }

    async function syncReservationsForCart(cart) {
      const PR = window.PAYDAY_RESERVATIONS;
      if (!PR?.isEnabled?.()) return { ok: true, disabled: true };
      if (!state.reservationsActive) {
        return { ok: true, disabled: true, reason: 'reservations_degraded' };
      }
      return PR.syncCart(cart || []);
    }

    function shopifyInventoryOnly() {
      return window.PAYDAY_SHOP?.shopifyInventoryOnly === true;
    }

    async function initReservations() {
      const PR = window.PAYDAY_RESERVATIONS;
      if (!PR?.isEnabled?.() || shopifyInventoryOnly()) {
        await refreshStorefrontCatalog({ force: true }).catch(() => {});
        updateStockLabels();
        if (typeof updateShopSubtitle === 'function') updateShopSubtitle();
        if (!PR?.isEnabled?.() || shopifyInventoryOnly()) return;
      }
      try {
        if (state.cart.length) {
          const sync = await PR.syncCart(state.cart);
          if (sync.ok && sync.availability) {
            applyReservationFromSync(sync);
          } else if (!sync.ok) {
            state.cart = [];
            persistCart();
          }
        } else {
          const res = await PR.fetchAvailability();
          if (res.ok && res.availability) {
            applyReservationFromSync(res);
          }
        }
        PR.startHeartbeat(() => state.cart);
      } catch (err) {
        console.warn('[reservations]', err);
      }
    }

    function updateStockLabels() {
      const total = displayTotalBoards();
      const live = state.storefrontLive ? ' · Shopify live' : '';
      const text = `${total} verfügbar${live}`;
      document.getElementById('nav-stock').textContent = text;
      document.getElementById('hero-stock').textContent = `${total} Decks · 8.38″ & 8.5″${live}`;
    }

    function formatItemPrice(item) {
      const SF = window.PAYDAY_STOREFRONT_CATALOG;
      const p = item.price;
      if (SF?.formatEuro) return SF.formatEuro(p) + ' inkl. Griptape';
      return p + ',00 € inkl. Griptape';
    }

    function rebuildCatalogFromState() {
      catalog = INV.buildCatalog(state.stock).map((item) => ({
        ...item,
        price: state.shopifyPrices[item.id] ?? item.price,
        compareAtPrice: state.shopifyCompareAt[item.id] ?? null,
        stock: state.stock[item.id] ?? item.stock,
      }));
    }

    function applyStorefrontItems(result) {
      const items = result?.items || {};
      let applied = 0;
      Object.entries(items).forEach(([sku, row]) => {
        if (!row?.ok) return;
        if (!state.reservationsActive) {
          state.stock[sku] = row.quantity;
        }
        if (row.price != null) state.shopifyPrices[sku] = row.price;
        if (row.compareAtPrice != null) state.shopifyCompareAt[sku] = row.compareAtPrice;
        applied += 1;
      });
      state.storefrontLive = applied > 0 && result?.ok;
      state.storefrontSyncAt = state.storefrontLive ? new Date() : null;
      rebuildCatalogFromState();
      return applied;
    }

    async function refreshStorefrontCatalog(options) {
      const SF = window.PAYDAY_STOREFRONT_CATALOG;
      if (!SF?.fetchDeckCatalog) return { ok: false, reason: 'no_module' };
      try {
        const result = await SF.fetchDeckCatalog({ force: Boolean(options?.force) });
        const n = applyStorefrontItems(result);
        if (state.unlocked) {
          updateStockLabels();
          updateShopSubtitle();
          renderShopGrid();
        }
        return { ok: result.ok, count: n, source: result.source };
      } catch (err) {
        console.warn('[storefront-catalog]', err);
        return { ok: false, reason: String(err.message || err) };
      }
    }

    function prefetchStorefrontCatalog() {
      if (state.storefrontPrefetchDone) return;
      state.storefrontPrefetchDone = true;
      refreshStorefrontCatalog({ silent: true });
    }

    function startStorefrontPolling() {
      if (state.storefrontPollTimer) return;
      const pollMs = shopifyInventoryOnly() ? 60 * 1000 : 5 * 60 * 1000;
      state.storefrontPollTimer = setInterval(() => {
        if (state.unlocked && document.visibilityState === 'visible') {
          refreshStorefrontCatalog({ force: true });
        }
      }, pollMs);
      document.addEventListener('visibilitychange', () => {
        if (state.unlocked && document.visibilityState === 'visible') {
          refreshStorefrontCatalog({ force: true });
        }
      });
    }

    function renderCanvasPreview() {
      const design = currentDesign();
      if (!state.rendererReady) return;
      R.renderFromDesign(previewCanvas, design);
      previewFrame.classList.remove('generating');
      void previewFrame.offsetWidth;
      previewFrame.classList.add('generating');
    }

    function updateDesignStrip() {
      const strip = document.getElementById('design-strip');
      strip.innerHTML = '';
      INV.DESIGNS.forEach((d, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isUnlocked = state.unlocked || state.visitedDesigns.has(d.id);
        btn.className = 'design-strip__item'
          + (i === state.designIndex ? ' active' : '')
          + (isUnlocked ? ' visited' : '');
        btn.title = d.name;
        btn.disabled = !state.unlocked && !isUnlocked;
        const img = document.createElement('img');
        img.src = INV.thumbUrl(d);
        img.alt = d.name;
        img.loading = 'lazy';
        btn.appendChild(img);
        btn.addEventListener('click', () => {
          if (!state.unlocked) return;
          selectDesignByIndex(i);
        });
        strip.appendChild(btn);
      });
    }

    function updatePatternPills() {
      const design = currentDesign();
      const camoPill = document.getElementById('pill-camo');
      const linearPill = document.getElementById('pill-linear');
      if (design.camoStyle === 'linear') {
        camoPill.style.display = 'none';
        linearPill.style.display = 'inline-block';
      } else {
        camoPill.style.display = 'inline-block';
        linearPill.style.display = 'none';
      }
    }

    function selectDesignByIndex(index) {
      state.designIndex = index;
      if (state.unlocked) logShopConfig('Design gewählt');
      renderCanvasPreview();
      updateDesignStrip();
      updatePatternPills();
      if (state.unlocked) renderShopGrid();
    }

    function selectDesignById(designId) {
      const idx = INV.DESIGNS.findIndex((d) => d.id === designId);
      if (idx >= 0) selectDesignByIndex(idx);
    }

    function shiftDesign(delta) {
      const n = INV.DESIGNS.length;
      state.designIndex = (state.designIndex + delta + n) % n;
      state.visitedDesigns.add(currentDesign().id);
      renderCanvasPreview();
      updateDesignStrip();
    }

    function flashSwipe(dir, fast) {
      previewFrame.classList.remove('preview-frame--swipe-left', 'preview-frame--swipe-right', 'preview-frame--intro-swipe');
      void previewFrame.offsetWidth;
      if (fast) {
        previewFrame.classList.add('preview-frame--intro-swipe');
      } else {
        previewFrame.classList.add(dir < 0 ? 'preview-frame--swipe-left' : 'preview-frame--swipe-right');
      }
    }

    function setProgressBar(percent, introMode) {
      const fill = document.getElementById('unlock-progress-fill');
      fill.style.width = Math.min(100, Math.max(0, percent)) + '%';
      fill.classList.toggle('unlock-progress__fill--intro', !!introMode);
    }

    function updateProgressLabel() {
      const label = document.getElementById('unlock-progress-label');
      if (state.phase === 'loading') {
        label.innerHTML = 'Generator lädt…';
        return;
      }
      if (state.phase === 'intro') {
        label.innerHTML = 'Vorschau · <span>alle ' + INV.DESIGNS.length + ' Designs</span>';
        return;
      }
      if (state.phase === 'swipe') {
        const left = SWIPES_REQUIRED - state.swipeCount;
        label.innerHTML = 'Noch <span>' + left + '× ' + navVerb().toLowerCase() + '</span> bis Shop';
        return;
      }
      label.innerHTML = '<span>Shop freigeschaltet</span>';
    }

    function progressPercent() {
      if (state.phase === 'loading') return 0;
      if (state.phase === 'intro') return INTRO_PROGRESS_SHARE;
      if (state.phase === 'swipe') {
        const swipeShare = (100 - INTRO_PROGRESS_SHARE) / SWIPES_REQUIRED;
        return INTRO_PROGRESS_SHARE + state.swipeCount * swipeShare;
      }
      return 100;
    }

    function updateSwipeDots() {
      for (let i = 1; i <= SWIPES_REQUIRED; i++) {
        const dot = document.getElementById('dot-swipe-' + i);
        if (!dot) continue;
        const done = state.swipeCount >= i;
        const active = state.phase === 'swipe' && state.swipeCount === i - 1;
        dot.className = 'round-dot' + (done ? ' done' : '') + (active ? ' active' : '');
      }
    }

    function runIntroAnimation() {
      state.phase = 'intro';
      state.introRunning = true;
      state.designIndex = 0;
      const n = INV.DESIGNS.length;
      const start = performance.now();
      let lastIdx = -1;

      function tick(now) {
        if (!state.introRunning) return;
        const elapsed = now - start;
        const t = Math.min(elapsed / INTRO_DURATION_MS, 1);
        const idx = Math.min(Math.floor(t * n), n - 1);

        setProgressBar(t * INTRO_PROGRESS_SHARE, true);
        updateProgressLabel();

        if (idx !== lastIdx) {
          lastIdx = idx;
          state.designIndex = idx;
          state.visitedDesigns.add(INV.DESIGNS[idx].id);
          renderCanvasPreview();
          flashSwipe(-1, true);
          updateDesignStrip();
        }

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          state.introRunning = false;
          state.phase = 'swipe';
          state.swipeCount = 0;
          setProgressBar(INTRO_PROGRESS_SHARE, false);
          prefetchStorefrontCatalog();
          updateUI();
        }
      }

      updateUI();
      requestAnimationFrame(tick);
      // Fallback falls rAF nach Navigation (z. B. von shop/) stockt
      setTimeout(() => {
        if (!state.introRunning || state.phase !== 'intro') return;
        state.introRunning = false;
        state.phase = 'swipe';
        state.swipeCount = 0;
        setProgressBar(INTRO_PROGRESS_SHARE, false);
        prefetchStorefrontCatalog();
        updateUI();
      }, INTRO_DURATION_MS + 400);
    }

    function skipIntroToSwipe() {
      if (!state.introRunning && state.phase !== 'intro') return;
      state.introRunning = false;
      state.phase = 'swipe';
      state.swipeCount = 0;
      setProgressBar(INTRO_PROGRESS_SHARE, false);
      prefetchStorefrontCatalog();
      updateUI();
    }

    function registerUnlockStep(direction) {
      const dx = direction < 0 ? -80 : 80;
      shiftDesign(dx < 0 ? 1 : -1);
      flashSwipe(dx, false);
      state.swipeCount += 1;
      setProgressBar(progressPercent(), false);
      updateProgressLabel();
      updateSwipeDots();
      const prog = document.getElementById('click-progress');
      const left = SWIPES_REQUIRED - state.swipeCount;
      prog.textContent = left > 0 ? left + '× ' + navVerb() + ' bis Shop' : 'Shop wird freigeschaltet…';
      if (state.swipeCount >= SWIPES_REQUIRED) {
        setTimeout(unlockShop, 180);
      } else {
        updateUI();
      }
    }

    function handleUnlockAdvance(direction) {
      if (state.phase === 'loading') return;
      if (state.unlocked) {
        shiftDesign(direction > 0 ? -1 : 1);
        flashSwipe(direction > 0 ? 80 : -80, false);
        updateUI();
        return;
      }
      if (state.introRunning || state.phase === 'intro') {
        skipIntroToSwipe();
        return;
      }
      if (state.phase === 'swipe') {
        registerUnlockStep(direction);
      }
    }

    function handleNavStep(direction) {
      handleUnlockAdvance(direction);
    }

    function handleSwipe(dx) {
      if (state.phase === 'loading') return;
      if (state.unlocked) {
        shiftDesign(dx < 0 ? 1 : -1);
        flashSwipe(dx, false);
        updateUI();
        return;
      }
      if (state.introRunning || state.phase === 'intro') {
        skipIntroToSwipe();
        return;
      }
      if (state.phase !== 'swipe') return;
      registerUnlockStep(dx < 0 ? 1 : -1);
    }

    function updateUI() {
      const design = currentDesign();
      const prog = document.getElementById('click-progress');
      const badge = document.getElementById('phase-badge');
      const title = document.getElementById('phase-title');
      const hint = document.getElementById('phase-hint');

      const navActive = state.phase === 'swipe' || state.phase === 'intro' || state.unlocked;
      const sidebar = document.querySelector('.configurator__sidebar');
      if (sidebar) sidebar.classList.toggle('configurator__sidebar--swipeable', navActive && !state.unlocked);

      const designNav = document.getElementById('design-nav');
      designNav.classList.toggle('is-hidden', state.phase === 'loading');
      previewFrame?.classList.toggle('is-interactive', state.phase !== 'loading' && !state.unlocked);
      document.getElementById('zone-progress').classList.toggle('is-done', state.unlocked);
      document.getElementById('zone-controls').classList.toggle('is-hidden', state.unlocked);

      if (state.phase === 'loading') {
        badge.textContent = 'Lädt';
        title.textContent = 'Payday Decks';
        hint.textContent = 'Generator wird vorbereitet…';
        prog.textContent = 'Bitte kurz warten';
      } else if (state.phase === 'intro') {
        badge.textContent = 'Vorschau';
        title.textContent = 'Alle Designs';
        hint.textContent = '1 Sekunde — alle ' + INV.DESIGNS.length + ' Boards im Schnelldurchlauf.';
        prog.textContent = 'Vorschau läuft…';
      } else if (state.phase === 'swipe') {
        const left = SWIPES_REQUIRED - state.swipeCount;
        badge.textContent = 'Schritt ' + (state.swipeCount + 1) + ' von ' + SWIPES_REQUIRED;
        title.textContent = design.name;
        hint.textContent = left + '× bis Shop — Wischen, Tippen aufs Deck oder „Weiter“.';
        prog.textContent = left + '× ' + navVerb() + ' bis Shop';
      } else {
        badge.textContent = 'Shop offen';
        title.textContent = 'Verfügbare Decks';
        hint.textContent = design.name + ' · Größe im Shop wählen';
        prog.textContent = 'Shop offen';
      }

      const navHint = document.getElementById('preview-nav-hint');
      if (state.unlocked || state.phase === 'loading') {
        navHint.hidden = true;
      } else if (state.phase === 'intro') {
        navHint.hidden = false;
        navHint.textContent = 'Tippen / Weiter überspringt die Vorschau';
      } else if (state.phase === 'swipe') {
        navHint.hidden = false;
        navHint.textContent = '← Wischen · Tippen · Weiter →';
      } else {
        navHint.hidden = true;
      }

      setProgressBar(progressPercent(), state.introRunning);
      updateProgressLabel();
      updateSwipeDots();
      const dotsWrap = document.getElementById('swipe-dots');
      if (dotsWrap) dotsWrap.style.visibility = state.phase === 'swipe' ? 'visible' : 'hidden';
      updatePatternPills();
      updateDesignStrip();
      if (!state.introRunning) renderCanvasPreview();
    }

    function unlockAllDesigns() {
      INV.DESIGNS.forEach((d) => state.visitedDesigns.add(d.id));
    }

    function resetShopFilters() {
      state.filterDesign = null;
      state.filterSize = null;
    }

    function unlockShop() {
      state.introRunning = false;
      state.phase = 'shop';
      state.unlocked = true;
      setProgressBar(100, false);
      updateProgressLabel();
      unlockAllDesigns();
      resetShopFilters();
      document.getElementById('configurator').classList.add('is-unlocked');
      document.getElementById('shop-section').classList.add('is-unlocked');
      rebuildCatalogFromState();
      updateShopSubtitle();
      buildFilters();
      renderShopGrid();
      updateUI();
      refreshStorefrontCatalog({ force: true });
      startStorefrontPolling();
      if (!shopifyInventoryOnly()) {
        window.PAYDAY_RESERVATIONS?.startAvailabilityPolling?.({
          isActive: () => state.unlocked,
        });
      }
      logShopConfig('Shop freigeschaltet');
    }

    function isSwipeExcludedTarget(target) {
      return target.closest('.design-strip')
        || target.closest('button')
        || target.closest('a');
    }

    function bindPreviewInteraction(el) {
      el.addEventListener('pointerdown', (e) => {
        if (state.phase === 'loading') return;
        if (isSwipeExcludedTarget(e.target)) return;
        pointerActive = true;
        pointerTargetEl = el;
        pointerStartX = e.clientX;
        pointerStartY = e.clientY;
      });
      el.addEventListener('pointerup', (e) => {
        if (!pointerActive || pointerTargetEl !== el) return;
        pointerActive = false;
        if (isSwipeExcludedTarget(e.target)) return;
        const dx = e.clientX - pointerStartX;
        const dy = e.clientY - pointerStartY;
        if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
          handleSwipe(dx);
          suppressTapUntil = Date.now() + 300;
          return;
        }
        if (Math.abs(dx) <= TAP_MAX_MOVE && Math.abs(dy) <= TAP_MAX_MOVE && Date.now() > suppressTapUntil) {
          handleUnlockAdvance(1);
        }
      });
      el.addEventListener('pointercancel', () => {
        pointerActive = false;
        pointerTargetEl = null;
      });
    }

    bindPreviewInteraction(document.querySelector('.configurator__sidebar'));
    bindPreviewInteraction(previewFrame);
    document.getElementById('nav-prev').addEventListener('click', () => handleNavStep(-1));
    document.getElementById('nav-next').addEventListener('click', () => handleNavStep(1));
    document.addEventListener('keydown', (e) => {
      if (state.unlocked || state.phase === 'loading') return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleUnlockAdvance(1);
      }
      if (e.key === 'ArrowLeft') handleUnlockAdvance(-1);
    });

    let catalog = [];

    function buildFilters() {
      const sizeBar = document.getElementById('filter-size');
      const designBar = document.getElementById('filter-design');
      sizeBar.innerHTML = '<button class="filter-chip' + (!state.filterSize ? ' active' : '') + '" data-size="all">Alle Größen</button>';
      INV.SIZES.forEach(s => {
        const btn = document.createElement('button');
        const isPick = state.filterSize === s.id;
        btn.className = 'filter-chip' + (isPick ? ' active' : '');
        btn.dataset.size = s.id;
        btn.textContent = s.label;
        sizeBar.appendChild(btn);
      });
      designBar.innerHTML = '<button class="filter-chip' + (!state.filterDesign ? ' active' : '') + '" data-design="all">Alle Designs</button>';
      INV.DESIGNS.forEach(d => {
        const btn = document.createElement('button');
        btn.className = 'filter-chip' + (state.filterDesign === d.id ? ' active' : '');
        btn.dataset.design = d.id;
        btn.textContent = d.name;
        designBar.appendChild(btn);
      });
    }

    document.getElementById('shop-section').addEventListener('click', e => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      if (chip.dataset.size !== undefined) {
        state.filterSize = chip.dataset.size === 'all' ? null : chip.dataset.size;
        buildFilters();
        renderShopGrid();
      } else if (chip.dataset.design !== undefined) {
        state.filterDesign = chip.dataset.design === 'all' ? null : chip.dataset.design;
        buildFilters();
        renderShopGrid();
      }
    });

    function renderShopGrid() {
      const grid = document.getElementById('deck-grid');
      grid.innerHTML = '';
      catalog.filter(item => {
        if (state.filterSize && item.sizeId !== state.filterSize) return false;
        if (state.filterDesign && item.designId !== state.filterDesign) return false;
        return true;
      }).forEach(item => {
        const avail = availableStock(item.id);
        const design = INV.getDesignById(item.designId);
        const card = document.createElement('article');
        card.className = 'deck-card' + (avail === 0 ? ' sold-out' : '');
        if (item.designId === currentDesign().id) card.classList.add('selected');

        const pattern = document.createElement('div');
        pattern.className = 'deck-card__pattern';
        pattern.textContent = design.patternLabel;

        const img = document.createElement('img');
        img.className = 'board-img board-img--thumb';
        img.src = item.thumbUrl;
        img.alt = item.title;
        img.loading = 'lazy';

        const title = document.createElement('div');
        title.className = 'deck-card__title';
        title.textContent = item.title;

        const sizeEl = document.createElement('div');
        sizeEl.className = 'deck-card__size';
        sizeEl.textContent = item.sizeLabel;

        const stockEl = document.createElement('div');
        stockEl.className = 'deck-card__stock' + (avail <= 2 ? ' low' : '') + (avail === 0 ? ' out' : '');
        stockEl.textContent = formatAvailabilityLabel(avail, displayBaseStock(item.id, item));

        const price = document.createElement('div');
        price.className = 'deck-card__price';
        if (item.compareAtPrice && item.price && item.compareAtPrice > item.price) {
          const was = document.createElement('span');
          was.className = 'deck-card__price-was';
          was.textContent = window.PAYDAY_STOREFRONT_CATALOG?.formatEuro(item.compareAtPrice) || item.compareAtPrice + ' €';
          price.appendChild(was);
          price.appendChild(document.createTextNode(formatItemPrice(item)));
        } else {
          price.textContent = formatItemPrice(item);
        }

        const addBtn = document.createElement('button');
        addBtn.className = 'deck-card__add';
        addBtn.type = 'button';
        addBtn.textContent = avail === 0 ? 'Nicht verfügbar' : 'In den Warenkorb';
        addBtn.disabled = avail === 0;
        addBtn.addEventListener('click', e => { e.stopPropagation(); if (availableStock(item.id) > 0) addToCart(item); });

        card.addEventListener('click', () => selectDesignById(item.designId));
        card.appendChild(pattern);
        card.appendChild(img);
        card.appendChild(title);
        card.appendChild(sizeEl);
        card.appendChild(stockEl);
        card.appendChild(price);
        card.appendChild(addBtn);
        grid.appendChild(card);
      });
    }

    async function addToCart(item) {
      if (availableStock(item.id) <= 0) {
        alert(
          'Gerade nicht verfügbar. Wenn der Shop leer wirkt: Inventar in Shopify pflegen und shop-sync/Cron ausführen (Postgres deck_base_stock).'
        );
        return;
      }
      const nextCart = state.cart.concat([{ ...item }]);
      const sync = await syncReservationsForCart(nextCart);
      if (!sync.ok && !sync.disabled) {
        applyReservationFromSync(sync);
        renderShopGrid();
        alert(
          sync.reason === 'insufficient'
            ? 'Gerade nicht mehr verfügbar (andere Session oder Reservierung abgelaufen).'
            : sync.reason === 'rate_limited'
              ? 'Zu viele Anfragen — bitte ' +
                (sync.retryAfterSeconds ? sync.retryAfterSeconds + ' Sek. ' : '') +
                'warten und erneut versuchen.'
              : 'Reservierung fehlgeschlagen — bitte erneut versuchen.'
        );
        return;
      }
      applyReservationFromSync(sync);
      state.cart = nextCart;
      updateCart(true);
      renderShopGrid();
      window.PAYDAY_RESERVATIONS?.startHeartbeat?.(() => state.cart);
      logShopConfig('In den Warenkorb');
    }

    async function removeFromCart(index) {
      if (index < 0 || index >= state.cart.length) return;
      const nextCart = state.cart.slice();
      nextCart.splice(index, 1);
      const sync = await syncReservationsForCart(nextCart);
      if (!sync.ok && !sync.disabled) {
        applyReservationFromSync(sync);
        return;
      }
      applyReservationFromSync(sync);
      state.cart = nextCart;
      updateCart(true);
      renderShopGrid();
      if (!state.cart.length) window.PAYDAY_RESERVATIONS?.stopHeartbeat?.();
    }

    function clearCart() {
      state.cart = [];
      try {
        localStorage.setItem('payday_deck_cart', '[]');
      } catch {
        /* ignore */
      }
      window.PAYDAY_RESERVATIONS?.releaseCart?.().then((res) => {
        applyReservationFromSync(res);
      });
      window.PAYDAY_RESERVATIONS?.stopHeartbeat?.();
      updateCart(false);
      renderShopGrid();
    }

    function persistCart() {
      try {
        localStorage.setItem('payday_deck_cart', JSON.stringify(state.cart));
      } catch {
        /* ignore */
      }
    }

    function loadCartFromStorage() {
      try {
        const raw = localStorage.getItem('payday_deck_cart');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        state.cart = parsed.filter((e) => e && e.id);
      } catch {
        state.cart = [];
      }
    }

    function renderCartLines() {
      const list = document.getElementById('cart-lines');
      if (!list) return;
      list.innerHTML = '';
      state.cart.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'cart-line';
        const main = document.createElement('div');
        const t = document.createElement('div');
        t.className = 'cart-line__title';
        t.textContent = item.title + ' · ' + item.sizeLabel;
        const m = document.createElement('div');
        m.className = 'cart-line__meta';
        m.textContent = item.id;
        main.appendChild(t);
        main.appendChild(m);
        const price = document.createElement('div');
        price.className = 'cart-line__price';
        price.textContent =
          window.PAYDAY_STOREFRONT_CATALOG?.formatEuro(item.price) || item.price + ',00 €';
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'cart-line__remove';
        rm.textContent = 'Entfernen';
        rm.addEventListener('click', () => removeFromCart(index));
        li.appendChild(main);
        li.appendChild(price);
        li.appendChild(rm);
        list.appendChild(li);
      });
    }

    function setCartPanelOpen(expanded) {
      const panel = document.getElementById('cart-panel');
      if (!panel) return;
      if (state.cart.length === 0) {
        panel.classList.remove('visible', 'expanded');
        panel.setAttribute('aria-hidden', 'true');
        return;
      }
      panel.classList.add('visible');
      panel.setAttribute('aria-hidden', 'false');
      if (expanded) panel.classList.add('expanded');
      else panel.classList.remove('expanded');
    }

    function updateCart(expandPanel) {
      const n = state.cart.length;
      document.getElementById('cart-toggle').textContent = 'Warenkorb (' + n + ')';
      document.getElementById('cart-panel-title').textContent = 'Warenkorb (' + n + ')';
      const info = document.getElementById('cart-info');
      const checkoutBtn = document.getElementById('checkout-btn');
      renderCartLines();
      if (n === 0) {
        info.textContent = 'Kein Deck im Warenkorb';
        if (checkoutBtn) checkoutBtn.disabled = true;
        setCartPanelOpen(false);
        persistCart();
        return;
      }
      if (checkoutBtn) checkoutBtn.disabled = false;
      const total = state.cart.reduce((s, i) => s + i.price, 0);
      info.innerHTML = 'Summe: <strong>' + total + ',00 €</strong> · ' + n + ' Position' + (n > 1 ? 'en' : '');
      persistCart();
      const panel = document.getElementById('cart-panel');
      const stayExpanded = Boolean(expandPanel) || Boolean(panel?.classList.contains('expanded'));
      setCartPanelOpen(stayExpanded);
    }

    document.getElementById('checkout-btn').addEventListener('click', async () => {
      const items = state.cart.slice();
      if (!items.length) return;
      const btn = document.getElementById('checkout-btn');
      if (btn) btn.disabled = true;
      try {
        const result = await window.PAYDAY_SHOPIFY_CHECKOUT.goToCheckout(items);
        if (result?.ok) clearCart();
        else if (btn) btn.disabled = state.cart.length === 0;
      } catch (err) {
        console.error('[deck-shop] checkout', err);
        if (btn) btn.disabled = state.cart.length === 0;
      }
    });

    window.addEventListener('payday-checkout-started', () => {
      clearCart();
    });

    window.addEventListener('payday-reservation-updated', (ev) => {
      applyReservationAvailability({
        availability: ev.detail?.availability,
        baseStock: ev.detail?.baseStock,
      });
    });

    window.addEventListener('pageshow', () => {
      try {
        if (!sessionStorage.getItem('payday_checkout_pending')) return;
        sessionStorage.removeItem('payday_checkout_pending');
        clearCart();
      } catch {
        /* ignore */
      }
    });

    window.addEventListener('payday-checkout-started', () => {
      clearCart();
    });

    window.addEventListener('pageshow', () => {
      try {
        if (!sessionStorage.getItem('payday_checkout_pending')) return;
        sessionStorage.removeItem('payday_checkout_pending');
        clearCart();
      } catch {
        /* ignore */
      }
    });

    function renderShopifyStatus() {
      const el = document.getElementById('shopify-status');
      const SH = window.PAYDAY_SHOPIFY_CHECKOUT;
      if (!el || !SH) return;
      if (!DEV_MODE) {
        el.textContent = '';
        el.classList.remove('shopify-status--ready', 'shopify-status--locked');
        return;
      }
      el.classList.remove('shopify-status--ready', 'shopify-status--locked');
      const cfg = SH.getConfig ? SH.getConfig() : window.PAYDAY_SHOP || {};
      el.textContent = SH.statusLine();
      const mapped = Object.values(cfg.deckVariants || {}).filter((v) => v && v.variantId).length;
      if (SH.isConfigured() && mapped > 0) {
        el.classList.add('shopify-status--ready');
      } else if (SH.isConfigured()) {
        el.innerHTML = 'Domain gesetzt — <button type="button" id="shopify-status-sync" style="font:inherit;color:var(--accent);cursor:pointer;border:none;background:none;text-decoration:underline">Varianten laden</button> (Dev)';
      } else {
        el.innerHTML = 'Shopify: <button type="button" id="shopify-status-open" style="font:inherit;color:var(--purple);cursor:pointer;border:none;background:none;text-decoration:underline">Jetzt verbinden</button>';
      }
      document.getElementById('shopify-status-open')?.addEventListener('click', () => connectUI?.open());
      document.getElementById('shopify-status-sync')?.addEventListener('click', () => connectUI?.open());

      SH.shopLiveStatusLine?.(cfg).then((live) => {
        if (!live || !el) return;
        el.querySelector('#shopify-live-status')?.remove();
        const extra = document.createElement('div');
        extra.id = 'shopify-live-status';
        extra.style.marginTop = '4px';
        extra.style.fontSize = '9px';
        if (live.locked) {
          el.classList.add('shopify-status--locked');
          extra.innerHTML =
            '⚠ ' +
            live.text +
            ' — <a href="' +
            live.adminUrl +
            '" target="_blank" rel="noopener" style="color:var(--accent)">Passwortschutz in Shopify deaktivieren</a>';
        } else {
          extra.textContent = '✓ ' + live.text;
        }
        el.appendChild(extra);
      });
    }

    const connectUI = window.PAYDAY_SHOPIFY_CONNECT?.mountConnectUI({
      openOnLoad: DEV_MODE && location.hash === '#shopify-connect',
    });
    window.addEventListener('payday-shopify-updated', () => {
      renderShopifyStatus();
      if (state.unlocked) refreshStorefrontCatalog({ force: true });
    });
    renderShopifyStatus();

    document.getElementById('cart-toggle').addEventListener('click', () => {
      if (state.cart.length === 0) return;
      const panel = document.getElementById('cart-panel');
      setCartPanelOpen(!panel.classList.contains('expanded'));
    });
    function collapseCartPanel() {
      setCartPanelOpen(false);
    }
    document.getElementById('cart-close')?.addEventListener('click', collapseCartPanel);
    document.getElementById('cart-collapse')?.addEventListener('click', collapseCartPanel);

    rebuildCatalogFromState();
    loadCartFromStorage();
    try {
      if (sessionStorage.getItem('payday_checkout_pending')) {
        sessionStorage.removeItem('payday_checkout_pending');
        state.cart = [];
      }
    } catch {
      /* ignore */
    }

    updateCart(false);
    initReservations().finally(() => {
      if (!state.reservationsActive) updateStockLabels();
    });
    if (DEV_MODE) window.PAYDAY_CONFIG_LOG?.renderList('session-config-log');

    state.phase = 'loading';
    showAssetLoader(true);
    startLoadTicker();
    updateUI();

    const onAssetProgress = (ev) => {
      const label = ev.label || ev.name || '…';
      setLoaderName(label, ev.kind === 'illus' ? 'Illustration · ' + label : 'Generator · ' + label);
    };

    Promise.all([
      R.loadAssets(
        (window.PAYDAY_PATHS && window.PAYDAY_PATHS.decksBase) || '../decks/',
        onAssetProgress
      ),
      preloadBoardThumbs((name) => setLoaderName(name, 'Board-JPEG · ' + name)),
    ]).then(() => {
      stopLoadTicker();
      setLoaderName(INV.getBoardMeta(currentDesign()).source, 'Shop wird vorbereitet…');
      state.rendererReady = true;
      state.designIndex = 0;
      state.visitedDesigns.clear();
      state.visitedDesigns.add(currentDesign().id);
      showAssetLoader(false);