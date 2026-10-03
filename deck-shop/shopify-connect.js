/**
 * Shopify-Verbindung im Browser (Cursor / lokal) — ohne Secrets im Repo.
 * Speichert Domain + Storefront-Token in localStorage, lädt Variant-IDs per API.
 */
(function (global) {
  const STORAGE_KEY = 'payday_shopify_runtime';
  const CONNECT_SCRIPT_VERSION = '2026.03.03-storefront-id-only';
  const API_VERSION = '2024-10';

  function readRuntime() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function writeRuntime(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getEffectiveConfig() {
    const base = { ...(global.PAYDAY_SHOP || {}) };
    const rt = readRuntime();
    if (rt.shopDomain) base.shopDomain = rt.shopDomain;
    if (rt.storefrontAccessToken) base.storefrontAccessToken = rt.storefrontAccessToken;
    base.deckVariants = { ...(base.deckVariants || {}), ...(rt.deckVariants || {}) };
    return base;
  }

  function isConfigured(cfg) {
    cfg = cfg || getEffectiveConfig();
    return Boolean(cfg.shopDomain && !String(cfg.shopDomain).includes('YOUR-STORE'));
  }

  async function storefrontQuery(cfg, query, variables) {
    const domain = cfg.shopDomain;
    const token = cfg.storefrontAccessToken;
    if (!domain || !token) {
      throw new Error('Shop-Domain und Storefront Access Token erforderlich.');
    }
    const res = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join('; '));
    }
    return json.data;
  }

  async function fetchVariantForHandle(cfg, handle) {
    const data = await storefrontQuery(
      cfg,
      `query ProductVariant($handle: String!) {
        product(handle: $handle) {
          variants(first: 1) {
            nodes { id }
          }
        }
      }`,
      { handle }
    );
    const node = data?.product?.variants?.nodes?.[0];
    if (!node?.id) return null;
    const gid = String(node.id);
    const numericId = gid.includes('/') ? gid.split('/').pop() : gid;
    return {
      variantId: numericId,
      variantGid: gid,
    };
  }

  async function syncAllDeckVariants(onProgress) {
    const cfg = getEffectiveConfig();
    if (!isConfigured(cfg)) throw new Error('Shop-Domain fehlt.');
    if (!cfg.storefrontAccessToken) {
      throw new Error('Storefront Access Token fehlt (Admin → Apps → Headless / Custom App).');
    }

    const rt = readRuntime();
    rt.deckVariants = rt.deckVariants || {};
    const entries = Object.entries(cfg.deckVariants || {});
    let ok = 0;
    for (const [sku, entry] of entries) {
      if (!entry?.handle) continue;
      onProgress?.(`Lade ${entry.handle}…`);
      const v = await fetchVariantForHandle(cfg, entry.handle);
      if (v) {
        rt.deckVariants[sku] = { ...entry, ...v };
        ok += 1;
      }
    }
    rt.shopDomain = cfg.shopDomain;
    rt.storefrontAccessToken = cfg.storefrontAccessToken;
    writeRuntime(rt);
    global.dispatchEvent(new CustomEvent('payday-shopify-updated'));
    return { mapped: ok, total: entries.length };
  }

  function clearRuntime() {
    localStorage.removeItem(STORAGE_KEY);
    global.dispatchEvent(new CustomEvent('payday-shopify-updated'));
  }

  function mountConnectUI(options) {
    const root = document.getElementById('shopify-connect');
    if (!root) return;

    const rt = readRuntime();
    const base = global.PAYDAY_SHOP || {};

    root.innerHTML = `
      <div class="shopify-connect__backdrop" data-close></div>
      <div class="shopify-connect__panel" role="dialog" aria-labelledby="shopify-connect-title">
        <button type="button" class="shopify-connect__close" data-close aria-label="Schließen">×</button>
        <h2 id="shopify-connect-title" class="shopify-connect__title">Shopify verbinden</h2>
        <p class="shopify-connect__lead">Läuft nur in deinem Browser (localStorage). Nichts wird ins Repo geschrieben.</p>
        <label class="shopify-connect__field">
          <span>Shop-Domain</span>
          <input type="text" id="sc-domain" placeholder="dein-store.myshopify.com" autocomplete="off"
            value="${(rt.shopDomain || base.shopDomain || '').replace(/YOUR-STORE[^"]*/, '')}">
        </label>
        <label class="shopify-connect__field">
          <span>Storefront Access Token</span>
          <input type="password" id="sc-token" placeholder="shpat_… / public storefront token" autocomplete="off"
            value="${rt.storefrontAccessToken || ''}">
        </label>
        <p class="shopify-connect__hint">
          Token: Headless → Storefront → <strong>Public access token</strong> (nicht Private/Admin).
          Scopes: <code>unauthenticated_read_product_listings</code> + Cart/Checkout.
        </p>
        <p class="shopify-connect__hint shopify-connect__version" id="sc-version"></p>
        <div class="shopify-connect__actions">
          <button type="button" class="shopify-connect__btn shopify-connect__btn--primary" id="sc-sync">Verbinden &amp; Varianten laden</button>
          <button type="button" class="shopify-connect__btn" id="sc-clear">Verbindung löschen</button>
        </div>
        <p class="shopify-connect__log" id="sc-log" aria-live="polite"></p>
        <p class="shopify-connect__hint">
          Produkte importieren:
          <a href="../shopify/products.csv" download>products.csv</a>
          ·
          <a href="https://admin.shopify.com/store" target="_blank" rel="noopener">Shopify Admin</a>
        </p>
      </div>`;

    const panel = root.querySelector('.shopify-connect__panel');
    const log = root.querySelector('#sc-log');
    const ver = root.querySelector('#sc-version');
    if (ver) {
      ver.textContent = `Verbindungs-Script: ${CONNECT_SCRIPT_VERSION}`;
    }

    function open() {
      root.classList.add('is-open');
      panel.focus();
    }
    function close() {
      root.classList.remove('is-open');
    }

    root.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

    root.querySelector('#sc-sync').addEventListener('click', async () => {
      const domain = root.querySelector('#sc-domain').value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const token = root.querySelector('#sc-token').value.trim();
      if (!domain || domain.includes('YOUR-STORE')) {
        log.textContent = 'Bitte gültige myshopify.com-Domain eintragen.';
        return;
      }
      writeRuntime({ shopDomain: domain, storefrontAccessToken: token, deckVariants: readRuntime().deckVariants || {} });
      if (global.PAYDAY_SHOP) {
        global.PAYDAY_SHOP.shopDomain = domain;
        global.PAYDAY_SHOP.storefrontAccessToken = token;
      }
      log.textContent = 'Verbinde…';
      try {
        const result = await syncAllDeckVariants((msg) => {
          log.textContent = msg;
        });
        log.textContent = `Fertig: ${result.mapped}/${result.total} Deck-Varianten verknüpft. Checkout bereit.`;
        close();
      } catch (err) {
        log.textContent = 'Fehler: ' + (err.message || String(err));
      }
    });

    root.querySelector('#sc-clear').addEventListener('click', () => {
      clearRuntime();
      log.textContent = 'Gespeicherte Verbindung gelöscht.';
    });

    document.getElementById('shopify-connect-open')?.addEventListener('click', open);

    if (options?.openOnLoad || location.hash === '#shopify-connect') {
      setTimeout(open, 400);
    }

    return { open, close };
  }

  global.PAYDAY_SHOPIFY_CONNECT = {
    CONNECT_SCRIPT_VERSION,
    STORAGE_KEY,
    readRuntime,
    writeRuntime,
    getEffectiveConfig,
    isConfigured,
    syncAllDeckVariants,
    clearRuntime,
    mountConnectUI,
    storefrontQuery,
  };
})(window);
