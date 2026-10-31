/**
 * Storefront API — Live-Katalog (Shopify = SSOT für Preis & Bestand).
 */
(function (global) {
  const API_VERSION = '2024-10';
  const CACHE_KEY = 'payday_storefront_catalog_cache';
  const CACHE_MS = 90 * 1000;

  function aliasForSku(sku) {
    return 's_' + String(sku).replace(/[^a-zA-Z0-9]/g, '_');
  }

  function getCfg() {
    if (global.PAYDAY_SHOPIFY_CONNECT?.getEffectiveConfig) {
      return global.PAYDAY_SHOPIFY_CONNECT.getEffectiveConfig();
    }
    return global.PAYDAY_SHOP || {};
  }

  function parseMoney(m) {
    if (!m || m.amount == null) return null;
    const n = parseFloat(m.amount);
    return Number.isFinite(n) ? n : null;
  }

  function buildQuery(deckVariants) {
    const fields = `
      availableForSale
      title
      featuredImage { url altText }
      variants(first: 5) {
        nodes {
          availableForSale
          quantityAvailable
          sku
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
        }
      }`;
    const lines = [];
    const skus = [];
    Object.entries(deckVariants || {}).forEach(([sku, entry]) => {
      if (!entry?.handle) return;
      skus.push(sku);
      lines.push(`${aliasForSku(sku)}: product(handle: ${JSON.stringify(entry.handle)}) {${fields}}`);
    });
    if (!lines.length) return null;
    return { query: `query StorefrontDeckCatalog {\n${lines.join('\n')}\n}`, skus };
  }

  async function storefrontRequest(cfg, query) {
    const domain = cfg.shopDomain;
    const token = cfg.storefrontAccessToken;
    if (!domain || !token) {
      return { ok: false, reason: 'missing_token_or_domain' };
    }
    const res = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    if (json.errors?.length) {
      return { ok: false, reason: 'graphql', detail: json.errors.map((e) => e.message).join('; ') };
    }
    return { ok: true, data: json.data };
  }

  function pickVariant(product, sku, entry) {
    const nodes = product?.variants?.nodes || [];
    if (!nodes.length) return null;
    const wantSku = entry?.sku;
    if (wantSku) {
      const bySku = nodes.find((v) => v.sku === wantSku);
      if (bySku) return bySku;
    }
    return nodes[0];
  }

  function normalizeProduct(sku, product, entry) {
    if (!product) {
      return { sku, ok: false, reason: 'not_found' };
    }
    const variant = pickVariant(product, sku, entry);
    if (!variant) {
      return { sku, ok: false, reason: 'no_variant' };
    }
    let qty = variant.quantityAvailable;
    if (qty == null || qty < 0) {
      qty = product.availableForSale && variant.availableForSale ? 99 : 0;
    }
    if (!product.availableForSale || !variant.availableForSale) qty = 0;

    const price = parseMoney(variant.price);
    const compareAt = parseMoney(variant.compareAtPrice);
    return {
      sku,
      ok: true,
      quantity: Math.max(0, Math.floor(qty)),
      price,
      compareAtPrice: compareAt,
      title: product.title || null,
      imageUrl: product.featuredImage?.url || null,
      currency: variant.price?.currencyCode || 'EUR',
    };
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.at || Date.now() - parsed.at > CACHE_MS) return null;
      return parsed.items;
    } catch {
      return null;
    }
  }

  function writeCache(items) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
    } catch {
      /* ignore */
    }
  }

  async function fetchDeckCatalog(options) {
    const cfg = getCfg();
    const deckVariants = cfg.deckVariants || {};
    const built = buildQuery(deckVariants);
    if (!built) {
      return { ok: false, reason: 'no_handles', items: {} };
    }

    if (!options?.force) {
      const cached = readCache();
      if (cached) return { ok: true, source: 'cache', items: cached };
    }

    const res = await storefrontRequest(cfg, built.query);
    if (!res.ok) return { ok: false, reason: res.reason, detail: res.detail, items: {} };

    const items = {};
    built.skus.forEach((sku) => {
      const alias = aliasForSku(sku);
      items[sku] = normalizeProduct(sku, res.data[alias], deckVariants[sku]);
    });
    const anyOk = Object.values(items).some((i) => i.ok);
    if (anyOk) writeCache(items);
    return { ok: anyOk, source: 'storefront', items };
  }

  function formatEuro(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '—';
    return (
      n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
    );
  }

  global.PAYDAY_STOREFRONT_CATALOG = {
    fetchDeckCatalog,
    formatEuro,
    aliasForSku,
  };
})(window);
