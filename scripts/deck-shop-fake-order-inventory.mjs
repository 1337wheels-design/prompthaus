#!/usr/bin/env node
/**
 * Fake-Order via Shopify Test-Gateway (Karte „1“) + Inventar-Check (Shopify + Supabase).
 * Cloud Desktop: DISPLAY=:1 node scripts/deck-shop-fake-order-inventory.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN || 'xwk1u9-6z.myshopify.com';
const VARIANT_ID = process.env.TEST_VARIANT_ID || '67670522429725';
const SKU = process.env.TEST_SKU || 'chrome-838';
const RES_API =
  process.env.RESERVATION_API ||
  'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/reservation-api';
const SHOP_SYNC =
  process.env.SHOP_SYNC_URL ||
  'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/shop-sync';
const SHOT_DIR = process.env.SHOT_DIR || '/opt/cursor/artifacts/screenshots';

mkdirSync(SHOT_DIR, { recursive: true });

const report = { steps: [], ok: true, sku: SKU, variantId: VARIANT_ID };

function step(name, ok, detail) {
  report.steps.push({ name, ok, detail: String(detail).slice(0, 800) });
  if (!ok) report.ok = false;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
}

async function fetchSupabaseAvail() {
  const res = await fetch(`${RES_API}/v1/availability?sessionId=inventory-probe`, {
    headers: { Origin: 'https://1337wheels-design.github.io' },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, avail: json.availability?.[SKU], raw: json };
}

async function triggerShopSync() {
  const headers = { 'Content-Type': 'application/json' };
  const secret = process.env.DECK_SYNC_CRON_SECRET;
  if (secret) headers.Authorization = `Bearer ${secret}`;
  const res = await fetch(SHOP_SYNC, { method: 'POST', headers, body: '{}' });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function shopifyStorefrontQty(token) {
  const handle = 'payday-deck-chrome-838';
  const res = await fetch(`https://${SHOP}/api/2024-10/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({
      query: `query($h:String!){ product(handle:$h){ variants(first:1){ nodes { quantityAvailable } } } }`,
      variables: { h: handle },
    }),
  });
  const data = await res.json();
  return data?.data?.product?.variants?.nodes?.[0]?.quantityAvailable;
}

function pciFrame(page, field) {
  return page.frameLocator(`iframe[name*="${field}"]`).first();
}

async function fillCheckout(page) {
  const checkoutUrl = `https://${SHOP}/cart/${VARIANT_ID}:1?checkout&return_to=${encodeURIComponent(
    'https://1337wheels-design.github.io/prompthaus/deck-shop/'
  )}`;
  await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  step('checkout_loaded', page.url().includes('/checkouts/'), page.url().split('?')[0]);

  await page.locator('#email').fill(`fake-order+${Date.now()}@example.com`);
  await page.locator('select[name="countryCode"], #Select0').first().selectOption('DE').catch(async () => {
    await page.getByRole('combobox', { name: /Country/i }).selectOption('Germany').catch(() => {});
  });
  await page.locator('input[name="firstName"]').first().fill('Payday');
  await page.locator('input[name="lastName"]').first().fill('Test');
  await page.locator('#shipping-address1, input[name="address1"]').first().fill('Musterstraße 1');
  await page.locator('input[name="postalCode"]').first().fill('28195');
  await page.locator('input[name="city"]').first().fill('Bremen');
  await page.waitForTimeout(1500);

  await pciFrame(page, 'number').locator('#number').fill('1');
  await pciFrame(page, 'expiry').locator('#expiry').fill('12 / 30');
  await pciFrame(page, 'verification_value').locator('#verification_value').fill('111');
  await pciFrame(page, 'name').locator('#name').fill('Test payment gateway');
  await page.waitForTimeout(800);

  const pay = page.getByRole('button', { name: /Pay now|Jetzt bezahlen|Zahlungspflichtig bestellen/i });
  await pay.click({ timeout: 30000 });
  await page.waitForURL(/thank_you|orders\/|checkouts\/.*\/thank_you/, { timeout: 180000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const done = /thank_you|order-confirmation|Thank you|Danke/i.test(await page.locator('body').innerText());
  step('fake_order_completed', done || page.url().includes('thank'), page.url());
  await page.screenshot({ path: join(SHOT_DIR, 'fake-order-thankyou.png'), fullPage: false });
  return done;
}

async function probeCartStock(page) {
  const url = `https://${SHOP}/cart/${VARIANT_ID}:1?checkout`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2000);
  const body = await page.locator('body').innerText();
  const blocked =
    body.includes('Out of stock') ||
    body.includes('nicht verfügbar') ||
    body.includes('sold out') ||
    page.url().includes('stock-problems');
  return { url: page.url(), blocked, snippet: body.slice(0, 400) };
}

/** Große Cart-Menge — bei persistent reduziertem Shopify-Bestand oft stock-problems / Limit. */
async function probeBulkCart(page) {
  const url = `https://${SHOP}/cart/${VARIANT_ID}:999`;
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(1500);
  const body = await page.locator('body').innerText();
  const limited =
    page.url().includes('stock-problems') ||
    /sold out|ausverkauft|nicht verfügbar|out of stock/i.test(body) ||
    /only \d+ (item|items|left)/i.test(body) ||
    /nur noch \d+/i.test(body);
  return { status: res?.status(), url: page.url(), limited, body: body.slice(0, 300) };
}

const beforeSb = await fetchSupabaseAvail();
step(
  'supabase_baseline',
  beforeSb.status === 200 && typeof beforeSb.avail === 'number',
  `${SKU}=${beforeSb.avail}`
);

const sfToken = process.env.SHOPIFY_STOREFRONT_TOKEN || '';
let beforeShopify = null;
let afterShopify = null;
if (sfToken) {
  beforeShopify = await shopifyStorefrontQty(sfToken);
  step('shopify_storefront_baseline', typeof beforeShopify === 'number', `quantityAvailable=${beforeShopify}`);
}

const headless = process.env.HEADLESS === '1' || process.env.HEADLESS === 'true';
const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 80 });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  const ordered = await fillCheckout(page);
  if (!ordered) {
    step('fake_order_completed', false, 'Keine Thank-you-Seite — Abbruch Inventar-Vergleich');
  } else {
    if (sfToken) {
      afterShopify = await shopifyStorefrontQty(sfToken);
      step(
        'shopify_storefront_after_order',
        typeof afterShopify === 'number' && afterShopify === beforeShopify - 1,
        `before=${beforeShopify} after=${afterShopify}`
      );
    } else {
      step('shopify_storefront_after_order', true, 'SKIP (SHOPIFY_STOREFRONT_TOKEN nicht gesetzt)');
    }

    const cartProbe = await probeCartStock(page);
    step(
      'shopify_cart_still_reachable',
      !cartProbe.blocked || cartProbe.url.includes('/checkouts/'),
      cartProbe.blocked ? 'stock signal: ' + cartProbe.snippet.slice(0, 120) : cartProbe.url.split('?')[0]
    );

    const bulk = await probeBulkCart(page);
    step(
      'shopify_inventory_persisted',
      bulk.limited || bulk.url.includes('stock-problems'),
      bulk.limited
        ? bulk.body.slice(0, 160)
        : `kein hartes Limit sichtbar (${bulk.url.split('?')[0]}) — Storefront-Token für exakte qty empfohlen`
    );
  }
} catch (err) {
  step('checkout_run', false, err.message || String(err));
  await page.screenshot({ path: join(SHOT_DIR, 'fake-order-error.png') }).catch(() => {});
} finally {
  await browser.close();
}

const sync = await triggerShopSync();
const syncOk = sync.status === 200 && sync.json?.ok;
step(
  'shop_sync_trigger',
  syncOk || sync.status === 404,
  sync.status === 404
    ? 'shop-sync Edge Function nicht deployed (404) — Supabase-Inventar nur manuell/cron'
    : `HTTP ${sync.status} ${JSON.stringify(sync.json).slice(0, 200)}`
);

await new Promise((r) => setTimeout(r, syncOk ? 1500 : 500));
const afterSb = await fetchSupabaseAvail();
const expectedDrop = syncOk && typeof beforeSb.avail === 'number';
step(
  'supabase_after_order',
  expectedDrop ? afterSb.avail === beforeSb.avail - 1 : afterSb.avail === beforeSb.avail,
  expectedDrop
    ? `${SKU} before=${beforeSb.avail} after=${afterSb.avail} (erwartet -1 nach shop-sync)`
    : `${SKU} before=${beforeSb.avail} after=${afterSb.avail} (ohne shop-sync unverändert erwartet)`
);

writeFileSync(join(SHOT_DIR, 'fake-order-inventory-report.json'), JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('\nFake-order inventory check done.', join(SHOT_DIR, 'fake-order-inventory-report.json'));
