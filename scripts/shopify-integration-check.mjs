#!/usr/bin/env node
/**
 * Shopify ↔ GitHub Deck Shop integration checks (no Admin token).
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const SHOP = 'xwk1u9-6z.myshopify.com';
const DECK_BASE = 'https://1337wheels-design.github.io/prompthaus/deck-shop/';
const CONFIG_PATH = new URL('../deck-shop/config.js', import.meta.url);

const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail: String(detail).slice(0, 600) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}: ${detail}`);
}

function parseVariantIdsFromConfig() {
  const src = readFileSync(CONFIG_PATH, 'utf8');
  const handles = [...src.matchAll(/handle:\s*'([^']+)'/g)].map((m) => m[1]);
  const variantIds = [...src.matchAll(/variantId:\s*(\d+)/g)].map((m) => m[1]);
  const deckHandles = handles.filter((h) => h.startsWith('payday-deck-'));
  return deckHandles;
}

async function fetchProduct(handle) {
  const url = `https://${SHOP}/products/${handle}.json`;
  const res = await fetch(url);
  if (!res.ok) return { ok: false, status: res.status, handle };
  const data = await res.json();
  const p = data.product;
  const v = p?.variants?.[0];
  const images = p?.images || [];
  const qty = v?.inventory_quantity;
  const inStock =
    v?.available === true ||
    (typeof qty === 'number' && qty > 0) ||
    (v?.inventory_policy === 'continue' && v?.inventory_management != null);
  return {
    ok: true,
    handle,
    title: p?.title,
    price: v?.price,
    inventory_quantity: qty,
    inStock,
    sku: v?.sku,
    imageCount: images.length,
    firstImage: images[0]?.src?.split('?')[0],
  };
}

async function run() {
  const handles = parseVariantIdsFromConfig();
  record('I0_config_handles', handles.length === 12, `deck handles in config: ${handles.length}`);

  let priceOk = 0;
  let withImages = 0;
  let twoImages = 0;
  const productDetails = [];

  for (const handle of handles) {
    const info = await fetchProduct(handle);
    if (!info.ok) {
      productDetails.push(`${handle}: HTTP ${info.status}`);
      continue;
    }
    productDetails.push(`${handle}: ${info.price}€ imgs=${info.imageCount}`);
    if (info.price === '59.00' || info.price === '59.0') priceOk += 1;
    if (info.imageCount >= 1) withImages += 1;
    if (info.imageCount >= 2) twoImages += 1;
  }

  record('I1_all_products_json', productDetails.every((l) => !l.includes('HTTP')), productDetails.slice(0, 3).join('; ') + '…');
  record('I2_price_59_eur', priceOk === handles.length, `${priceOk}/${handles.length} at 59.00`);
  record('I3_product_images', withImages === handles.length, `${withImages}/${handles.length} with ≥1 image`);
  record('I4_deck_two_images', twoImages >= 10, `${twoImages}/${handles.length} with preview+thumb (CSV import)`);

  const sfToken = process.env.SHOPIFY_STOREFRONT_TOKEN;
  if (sfToken) {
    let saleOk = 0;
    for (const handle of handles.slice(0, 4)) {
      const res = await fetch(`https://${SHOP}/api/2024-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': sfToken,
        },
        body: JSON.stringify({
          query: `{ product(handle: "${handle}") { availableForSale } }`,
        }),
      });
      const data = await res.json();
      if (data?.data?.product?.availableForSale) saleOk += 1;
    }
    record('I4b_storefront_sample', saleOk >= 3, `${saleOk}/4 sample handles availableForSale`);
  }

  // Password / storefront root
  const rootRes = await fetch(`https://${SHOP}/`, { redirect: 'manual' });
  const rootOk = rootRes.status === 200;
  record('I5_shop_not_password', rootOk, `GET / → ${rootRes.status}`);

  // Cart permalink (chrome-838)
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const cartUrl = `https://${SHOP}/cart/67670522429725:1`;
    await page.goto(cartUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const url = page.url();
    record(
      'I6_cart_to_checkout',
      url.includes('/checkouts/') && !url.includes('/password'),
      url.split('?')[0]
    );
  } catch (e) {
    record('I6_cart_to_checkout', false, e.message);
  }

  // Deck shop in-page checkout builder + live status
  try {
    await page.goto(DECK_BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.PAYDAY_SHOPIFY_CHECKOUT?.getConfig);
    const built = await page.evaluate(() => {
      const SH = window.PAYDAY_SHOPIFY_CHECKOUT;
      const cfg = SH.getConfig();
      const mapped = Object.values(cfg.deckVariants || {}).filter((v) => v?.variantId).length;
      const item = { id: 'chrome-838', title: 'CHROME', sizeLabel: '8.38"' };
      const checkout = SH.buildCartCheckout(cfg, [item]);
      return { mapped, domain: cfg.shopDomain, checkout };
    });
    record(
      'I7_deck_shop_variant_map',
      built.mapped === 12,
      `12 SKUs mapped: ${built.mapped === 12} (count=${built.mapped})`
    );
    record(
      'I8_permalink_build',
      built.checkout.ok && built.checkout.url.includes('67670522429725'),
      built.checkout.url || built.checkout.reason
    );
    const locked = await page.evaluate(
      (d) => window.PAYDAY_SHOPIFY_CHECKOUT.isShopPasswordLocked(d),
      SHOP
    );
    record('I9_password_probe_from_deck', locked === false, locked ? 'locked' : 'live');
  } catch (e) {
    record('I7_deck_shop_variant_map', false, e.message);
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.ok).length;
  const out = {
    shop: SHOP,
    deckShop: DECK_BASE,
    passed,
    failed: results.length - passed,
    total: results.length,
    results,
    ranAt: new Date().toISOString(),
  };
  const outPath = '/opt/cursor/artifacts/shopify-integration-results.json';
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nIntegration: ${passed}/${results.length} passed → ${outPath}`);
  process.exit(passed === results.length ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
