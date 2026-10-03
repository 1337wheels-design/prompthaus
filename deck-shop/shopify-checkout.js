/**
 * Payday Deck Shop ↔ Shopify (Hybrid / Cart Permalink)
 * Siehe deck-shop/config.js und shopify/SETUP.md
 */
(function (global) {
  function getConfig() {
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

  function resolveProductUrl(cfg, item) {
    const entry = variantEntry(cfg, item);
    if (!entry?.handle || !isConfigured(cfg)) return null;
    return `https://${cfg.shopDomain}/products/${entry.handle}`;
  }

  /**
   * @returns {{ ok: boolean, url?: string, missing?: string[], reason?: string }}
   */
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
    return { ok: true, url };
  }

  function goToCheckout(cartItems) {
    const cfg = getConfig();
    const result = buildCartCheckout(cfg, cartItems);

    if (result.ok && result.url) {
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
      alert(
        'Shopify noch nicht verbunden.\n\n' +
          '1. Produkte importieren: shopify/products.csv\n' +
          '2. Variant-IDs in deck-shop/config.js eintragen\n' +
          '3. shopDomain setzen\n\n' +
          'Deine Auswahl liegt im Browser (localStorage: payday_deck_cart).'
      );
      return result;
    }

    if (result.reason === 'missing_variants') {
      alert(
        'Variant-IDs fehlen für:\n' +
          result.missing.join('\n') +
          '\n\nShopify Admin → Produkt → Variante → ID in config.js eintragen.'
      );
      return result;
    }

    alert('Warenkorb ist leer.');
    return result;
  }

  function statusLine() {
    const cfg = getConfig();
    if (!isConfigured(cfg)) {
      return 'Shopify: bitte deck-shop/config.js ausfüllen';
    }
    const mapped = Object.values(cfg.deckVariants || {}).filter((v) => v && v.variantId).length;
    const total = Object.keys(cfg.deckVariants || {}).length;
    return `Shopify: ${cfg.shopDomain} · Varianten ${mapped}/${total}`;
  }

  global.PAYDAY_SHOPIFY_CHECKOUT = {
    isConfigured,
    buildCartCheckout,
    goToCheckout,
    statusLine,
    resolveVariantId,
  };
})(window);
