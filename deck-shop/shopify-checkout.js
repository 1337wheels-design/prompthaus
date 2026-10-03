/**
 * Payday Deck Shop ↔ Shopify (Permalink + Storefront Checkout)
 */
(function (global) {
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
    return `https://${cfg.shopDomain}/products/${entry.handle}`;
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

    const segments = [...counts.entries()].map(([id, qty]) => `${id}:${qty}`);
    const url = `https://${cfg.shopDomain}/cart/${segments.join(',')}`;
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
    const token = cfg.storefrontAccessToken;

    if (token && isConfigured(cfg)) {
      try {
        const sf = await checkoutViaStorefront(cfg, cartItems);
        if (sf.ok && sf.url) {
          maybeWarnPasswordStore(cfg);
          window.location.href = sf.url;
          return sf;
        }
      } catch (err) {
        console.warn('[shopify-checkout] Storefront failed, fallback permalink', err);
      }
    }

    const result = buildCartCheckout(cfg, cartItems);

    if (result.ok && result.url) {
      maybeWarnPasswordStore(cfg);
      window.location.href = result.url;
      return result;
    }

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

  const PASSWORD_HINT_KEY = 'payday_shopify_password_hint_v1';

  /** Dev-Shops mit „Opening soon“ / Passwortseite — kein Code-Bug. */
  function maybeWarnPasswordStore(cfg) {
    try {
      if (localStorage.getItem(PASSWORD_HINT_KEY)) return;
      localStorage.setItem(PASSWORD_HINT_KEY, '1');
    } catch {
      return;
    }
    const domain = cfg?.shopDomain || '';
    console.info(
      '[Payday Deck Shop] Wenn Shopify „Opening soon“ oder eine Passwortseite zeigt: ' +
        'Admin → Online Store → Preferences → Passwortschutz deaktivieren (Shop für Käufer öffnen). Domain:',
      domain
    );
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
    resolveVariantId,
    getConfig,
  };
})(window);
