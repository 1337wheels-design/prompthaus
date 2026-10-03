/**
 * Payday Deck Shop ↔ Shopify (Permalink + Storefront Checkout)
 */
(function (global) {
  const LIVE_CACHE_KEY = 'payday_shopify_live_check';

  function normalizeDomain(domain) {
    return String(domain || '')
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
  }

  function storeHandleFromDomain(domain) {
    const d = normalizeDomain(domain);
    const m = d.match(/^([^.]+)\.myshopify\.com$/i);
    return m ? m[1] : d.split('.')[0];
  }

  function adminPreferencesUrl(domain) {
    const handle = storeHandleFromDomain(domain);
    return `https://admin.shopify.com/store/${handle}/online_store/preferences`;
  }

  function getConfig() {
    if (global.PAYDAY_SHOPIFY_CONNECT?.getEffectiveConfig) {
      return global.PAYDAY_SHOPIFY_CONNECT.getEffectiveConfig();
    }
    return global.PAYDAY_SHOP || {};
  }

  function isConfigured(cfg) {
    cfg = cfg || getConfig();
    return Boolean(cfg.shopDomain && !String(cfg.shopDomain).includes('YOUR-STORE'));
  }

  function variantEntry(cfg, skuId) {
    const map = cfg.deckVariants || {};
    return map[skuId] || null;
  }

  function resolveVariantId(cfg, item) {
    const entry = variantEntry(cfg, item.id);
    if (entry && entry.variantId) return String(entry.variantId);
    return null;
  }

  function resolveVariantGid(cfg, item) {
    const entry = variantEntry(cfg, item.id);
    if (entry?.variantGid) return entry.variantGid;
    const id = resolveVariantId(cfg, item);
    if (id) return `gid://shopify/ProductVariant/${id}`;
    return null;
  }

  function resolveProductUrl(cfg, item) {
    const entry = variantEntry(cfg, item);
    if (!entry?.handle || !isConfigured(cfg)) return null;
    return `https://${normalizeDomain(cfg.shopDomain)}/products/${entry.handle}`;
  }

  /** Shopify leitet bei Passwortschutz alles auf /password („Opening soon“). */
  async function isShopPasswordLocked(domain) {
    const d = normalizeDomain(domain);
    if (!d) return false;
    try {
      const cached = sessionStorage.getItem(LIVE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.domain === d && Date.now() - parsed.at < 120000) {
          return Boolean(parsed.locked);
        }
      }
    } catch {
      /* ignore */
    }

    let locked = false;
    try {
      const res = await fetch(`https://${d}/`, { method: 'HEAD', redirect: 'manual', credentials: 'omit' });
      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const loc = (res.headers.get('Location') || '').toLowerCase();
        locked = loc.includes('/password');
      }
    } catch {
      locked = false;
    }

    try {
      sessionStorage.setItem(
        LIVE_CACHE_KEY,
        JSON.stringify({ domain: d, locked, at: Date.now() })
      );
    } catch {
      /* ignore */
    }
    return locked;
  }

  function notifyPasswordBlocked(cfg) {
    const admin = adminPreferencesUrl(cfg.shopDomain);
    const msg =
      'Dein Shopify-Shop ist noch im Modus „Opening soon“ (Passwortschutz).\n\n' +
      'Solange der Passwortschutz AN ist, landen alle Checkout-Links auf /password — das ist eine Shopify-Einstellung, kein Fehler im Deck Shop.\n\n' +
      'Fix: Shopify Admin → Online Store → Preferences → Password protection → deaktivieren / Remove password.\n\n' +
      'OK = Admin-Einstellungen in neuem Tab öffnen';
    if (window.confirm(msg)) {
      window.open(admin, '_blank', 'noopener,noreferrer');
    }
    return { ok: false, reason: 'shop_password', adminUrl: admin };
  }

  async function ensureShopLive(cfg) {
    if (!isConfigured(cfg)) return true;
    const locked = await isShopPasswordLocked(cfg.shopDomain);
    if (locked) {
      notifyPasswordBlocked(cfg);
      return false;
    }
    return true;
  }

  function buildCartCheckout(cfg, cartItems) {
    cfg = cfg || getConfig();
    if (!isConfigured(cfg)) {
      return { ok: false, reason: 'not_configured' };
    }
    if (!cartItems?.length) {
      return { ok: false, reason: 'empty_cart' };
    }

    const counts = new Map();
    const missing = [];

    cartItems.forEach((item) => {
      const vid = resolveVariantId(cfg, item);
      if (vid) {
        counts.set(vid, (counts.get(vid) || 0) + 1);
        return;
      }
      missing.push(item.id);
    });

    if (missing.length) {
      return { ok: false, reason: 'missing_variants', missing };
    }

    const domain = normalizeDomain(cfg.shopDomain);
    const segments = [...counts.entries()].map(([id, qty]) => `${id}:${qty}`);
    const url = `https://${domain}/cart/${segments.join(',')}`;
    return { ok: true, url, mode: 'permalink' };
  }

  async function checkoutViaStorefront(cfg, cartItems) {
    const lines = [];
    const missing = [];
    cartItems.forEach((item) => {
      const gid = resolveVariantGid(cfg, item);
      if (!gid) {
        missing.push(item.id);
        return;
      }
      lines.push({
        merchandiseId: gid,
        quantity: 1,
        attributes: [
          { key: 'Design', value: item.title || item.designName || '' },
          { key: 'Größe', value: item.sizeLabel || '' },
        ],
      });
    });
    if (missing.length) {
      return { ok: false, reason: 'missing_variants', missing };
    }

    const connect = global.PAYDAY_SHOPIFY_CONNECT;
    if (!connect?.storefrontQuery) {
      return { ok: false, reason: 'no_storefront' };
    }

    const data = await connect.storefrontQuery(
      cfg,
      `mutation CartCreate($lines: [CartLineInput!]!) {
        cartCreate(input: { lines: $lines }) {
          cart { checkoutUrl id }
          userErrors { field message }
        }
      }`,
      { lines }
    );

    const payload = data?.cartCreate;
    if (payload?.userErrors?.length) {
      throw new Error(payload.userErrors.map((e) => e.message).join('; '));
    }
    const url = payload?.cart?.checkoutUrl;
    if (!url) throw new Error('Keine checkoutUrl von Shopify erhalten.');
    return { ok: true, url, mode: 'storefront' };
  }

  async function goToCheckout(cartItems) {
    const cfg = getConfig();

    if (!(await ensureShopLive(cfg))) {
      return { ok: false, reason: 'shop_password' };
    }

    // Permalink (/cart/{variantId}:qty) → stabiler Checkout auf Live-Shops
    const permalink = buildCartCheckout(cfg, cartItems);
    if (permalink.ok && permalink.url) {
      window.location.href = permalink.url;
      return permalink;
    }

    const token = cfg.storefrontAccessToken;
    if (token && isConfigured(cfg)) {
      try {
        const sf = await checkoutViaStorefront(cfg, cartItems);
        if (sf.ok && sf.url) {
          window.location.href = sf.url;
          return sf;
        }
      } catch (err) {
        console.warn('[shopify-checkout] Storefront failed after permalink miss', err);
      }
    }

    const result = permalink;

    if (result.reason === 'missing_variants' && cartItems.length === 1) {
      const fallback = resolveProductUrl(cfg, cartItems[0]);
      if (fallback) {
        window.location.href = fallback;
        return { ok: true, url: fallback, fallback: true };
      }
    }

    if (result.reason === 'not_configured') {
      global.PAYDAY_SHOPIFY_CONNECT?.mountConnectUI?.({ openOnLoad: true });
      return result;
    }

    if (result.reason === 'missing_variants') {
      alert(
        'Variant-IDs fehlen für:\n' +
          result.missing.join('\n') +
          '\n\nIm Deck Shop auf „Shopify“ klicken → Verbinden & Varianten laden.'
      );
      return result;
    }

    alert('Warenkorb ist leer.');
    return result;
  }

  async function shopLiveStatusLine(cfg) {
    cfg = cfg || getConfig();
    if (!isConfigured(cfg)) return null;
    const locked = await isShopPasswordLocked(cfg.shopDomain);
    if (locked) {
      return {
        locked: true,
        text: 'Shop: Opening soon (Passwort) — Checkout blockiert bis Passwortschutz AUS',
        adminUrl: adminPreferencesUrl(cfg.shopDomain),
      };
    }
    return { locked: false, text: 'Shop: live (kein Passwortschutz)' };
  }

  function statusLine() {
    const cfg = getConfig();
    if (!isConfigured(cfg)) {
      return 'Shopify: nicht verbunden — Button „Shopify“ oben rechts';
    }
    const mapped = Object.values(cfg.deckVariants || {}).filter((v) => v && v.variantId).length;
    const total = Object.keys(cfg.deckVariants || {}).length;
    const via = cfg.storefrontAccessToken ? 'Storefront' : 'Permalink';
    return `Shopify (${via}): ${cfg.shopDomain} · Varianten ${mapped}/${total}`;
  }

  global.PAYDAY_SHOPIFY_CHECKOUT = {
    isConfigured,
    buildCartCheckout,
    goToCheckout,
    statusLine,
    shopLiveStatusLine,
    isShopPasswordLocked,
    adminPreferencesUrl,
    resolveVariantId,
    getConfig,
  };
})(window);
