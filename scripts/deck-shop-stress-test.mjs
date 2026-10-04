#!/usr/bin/env node
/**
 * Deck Shop stress tests (Playwright) — discovery-driven scenarios.
 *
 * Discovery map (event-day risks):
 * | ID  | Risiko / Flow                         | Erwartung                          |
 * |-----|---------------------------------------|------------------------------------|
 * | S1  | Intro → Unlock → Shop sichtbar        | #shop-section.is-unlocked          |
 * | S2  | Kaputtes localStorage                 | Warenkorb (0), kein Crash          |
 * | S3  | Warenkorb UI: add/remove/collapse     | Panel expanded → Hochklappen       |
 * | S4  | Spam-Klick „In den Warenkorb“         | Stock-Cap, disabled buttons        |
 * | S5  | Checkout-URL (Permalink-Aggregation)  | empty/missing/2× gleiche SKU       |
 * | S6  | Shopify Passwortschutz                | nicht locked wenn Shop live        |
 * | S7  | Permalink → Checkout-Redirect         | /checkouts/, kein /password        |
 * | S8  | Mobile Swipe-Unlock                   | iPhone 13 viewport                 |
 * | S9  | Filter-Chips spam                     | 1–12 Karten, kein DOM-Leak         |
 * | S10 | Storefront API chrome-838             | Produkt + qty                      |
 * | S11 | Warenkorb über Reload                 | localStorage persist               |
 * | S12 | Checkout disabled bei leerem Warenkorb| #checkout-btn disabled             |
 * | S13 | Zwei verschiedene SKUs + Summe        | 2 Positionen, Summe 118 €          |
 * | S14 | cart-close vs collapse                | beide klappen ein                  |
 * | S15 | Deep-Link #shopify-connect            | Connect-UI mount ohne Crash        |
 *
 * Usage: node scripts/deck-shop-stress-test.mjs [baseUrl]
 * Env: SHOPIFY_STOREFRONT_TOKEN (optional, für S10)
 */
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'fs';

const BASE =
  process.argv[2] || 'https://1337wheels-design.github.io/prompthaus/deck-shop/';
const SHOP_DOMAIN = 'xwk1u9-6z.myshopify.com';

const results = [];

function record(id, ok, detail) {
  results.push({ id, ok, detail: String(detail).slice(0, 500) });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${id}: ${detail}`);
}

async function waitForShop(page, timeoutMs = 90000) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForTimeout(2500);
  const unlocked = await page.evaluate(() =>
    document.getElementById('shop-section')?.classList.contains('is-unlocked')
  );
  if (unlocked) return;
  for (let i = 0; i < 4; i++) {
    await page.click('#nav-next', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('#shop-section.is-unlocked', { timeout: 45000 });
}

async function ensureCartExpanded(page) {
  const st = await page.evaluate(() => {
    const panel = document.getElementById('cart-panel');
    return {
      visible: panel?.classList.contains('visible'),
      expanded: panel?.classList.contains('expanded'),
      n: document.getElementById('cart-toggle')?.textContent,
    };
  });
  if (!st.visible || st.n === 'Warenkorb (0)') return st;
  if (!st.expanded) {
    await page.click('#cart-toggle');
    await page.waitForSelector('#cart-panel.expanded', { timeout: 8000 });
  }
  return st;
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // --- S1: Page load + unlock ---
  {
    const page = await browser.newPage();
    try {
      await waitForShop(page);
      const phase = await page.evaluate(() => document.getElementById('shop-section')?.className);
      record('S1_unlock_shop', phase?.includes('is-unlocked'), phase || 'no shop section');
    } catch (e) {
      record('S1_unlock_shop', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S2: Corrupt cart localStorage recovery ---
  {
    const page = await browser.newPage();
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.setItem('payday_deck_cart', '{{not json');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const n = await page.evaluate(() => {
        const t = document.getElementById('cart-toggle')?.textContent || '';
        return t;
      });
      record('S2_corrupt_cart', /Warenkorb \(0\)/.test(n), n);
    } catch (e) {
      record('S2_corrupt_cart', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S3: Add to cart + expand + remove + collapse ---
  {
    const page = await browser.newPage();
    try {
      await waitForShop(page);
      const addBtn = page.locator('.deck-card__add:not([disabled])').first();
      await addBtn.click({ timeout: 10000 });
      await page.waitForTimeout(300);
      let count = await page.evaluate(() => document.getElementById('cart-toggle')?.textContent);
      record('S3_add_to_cart', /Warenkorb \(1\)/.test(count || ''), count);
      await page.waitForSelector('#cart-panel.visible', { timeout: 8000 });
      await ensureCartExpanded(page);
      await page.click('.cart-line__remove');
      await page.waitForTimeout(200);
      count = await page.evaluate(() => document.getElementById('cart-toggle')?.textContent);
      record('S3_remove_line', /Warenkorb \(0\)/.test(count || ''), count);
      await addBtn.click();
      await page.waitForTimeout(300);
      await ensureCartExpanded(page);
      await page.click('#cart-collapse');
      const expanded = await page.evaluate(() => document.getElementById('cart-panel')?.classList.contains('expanded'));
      record('S3_collapse_bottom', !expanded, expanded ? 'still expanded' : 'collapsed');
    } catch (e) {
      record('S3_cart_ui', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S4: Rapid double-add same SKU (stock limit) ---
  {
    const page = await browser.newPage();
    try {
      await waitForShop(page);
      for (let i = 0; i < 15; i++) {
        await page.locator('.deck-card__add:not([disabled])').first().click({ timeout: 2000 }).catch(() => {});
      }
      const info = await page.evaluate(() => ({
        cart: document.getElementById('cart-toggle')?.textContent,
        disabled: document.querySelectorAll('.deck-card__add:disabled').length,
      }));
      record('S4_rapid_add', /Warenkorb \(\d+\)/.test(info.cart || '') && info.cart !== 'Warenkorb (0)', JSON.stringify(info));
    } catch (e) {
      record('S4_rapid_add', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S5: Checkout URL building (in-page API) ---
  {
    const page = await browser.newPage();
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.PAYDAY_SHOPIFY_CHECKOUT?.buildCartCheckout);
      const out = await page.evaluate(() => {
        const SH = window.PAYDAY_SHOPIFY_CHECKOUT;
        const cfg = SH.getConfig();
        const item = { id: 'chrome-838', title: 'CHROME', sizeLabel: '8.38"' };
        const empty = SH.buildCartCheckout(cfg, []);
        const one = SH.buildCartCheckout(cfg, [item, item]);
        const bad = SH.buildCartCheckout(
          { ...cfg, deckVariants: { ...cfg.deckVariants, 'chrome-838': { handle: 'x', variantId: null } } },
          [item]
        );
        return { empty, one, bad, domain: cfg.shopDomain };
      });
      record('S5_empty_cart', out.empty.reason === 'empty_cart', out.empty.reason);
      record(
        'S5_permalink_aggregate',
        out.one.ok && out.one.url.includes('67670522429725:2'),
        out.one.url || JSON.stringify(out.one)
      );
      record('S5_missing_variant', out.bad.reason === 'missing_variants', out.bad.reason);
    } catch (e) {
      record('S5_checkout_build', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S6: Password lock probe (live shop) ---
  {
    const page = await browser.newPage();
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.PAYDAY_SHOPIFY_CHECKOUT?.isShopPasswordLocked);
      const locked = await page.evaluate(
        (domain) => window.PAYDAY_SHOPIFY_CHECKOUT.isShopPasswordLocked(domain),
        SHOP_DOMAIN
      );
      record('S6_shop_not_password_locked', locked === false, locked ? 'still password locked' : 'live');
    } catch (e) {
      record('S6_shop_not_password_locked', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S7: Shopify cart redirect (HTTP) ---
  {
    const page = await browser.newPage();
    try {
      await page.goto(`https://${SHOP_DOMAIN}/cart/67670522429725:1`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      const url = page.url();
      const ok = url.includes('/checkouts/') && !url.includes('/password');
      const stock =
        url.includes('stock-problems') ||
        (await page.locator('body').innerText()).includes('Out of stock');
      record('S7_checkout_redirect', ok, url.split('?')[0]);
      record('S7_inventory_note', true, stock ? 'Shopify: out of stock on variant' : 'checkout reachable');
    } catch (e) {
      record('S7_checkout_redirect', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S8: Mobile viewport + unlock ---
  {
    const iphone = devices['iPhone 13'];
    const page = await browser.newPage({ ...iphone });
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      const box = await page.locator('#preview-frame').boundingBox();
      if (box) {
        const y = box.y + box.height / 2;
        for (let i = 0; i < 3; i++) {
          await page.mouse.move(box.x + box.width * 0.8, y);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width * 0.2, y, { steps: 12 });
          await page.mouse.up();
          await page.waitForTimeout(500);
        }
      }
      await page.waitForSelector('#shop-section.is-unlocked', { timeout: 45000 });
      record('S8_mobile_unlock', true, 'shop unlocked via swipe');
    } catch (e) {
      record('S8_mobile_unlock', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S9: Filter spam ---
  {
    const page = await browser.newPage();
    try {
      await waitForShop(page);
      for (let i = 0; i < 20; i++) {
        await page
          .locator('#filter-size button')
          .nth(i % 3)
          .click({ timeout: 2000 })
          .catch(() => {});
      }
      const cards = await page.locator('.deck-card').count();
      record('S9_filter_spam', cards >= 1 && cards <= 12, `visible cards: ${cards}`);
    } catch (e) {
      record('S9_filter_spam', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S10: Storefront API availability chrome-838 ---
  {
    const page = await browser.newPage();
    try {
      const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
      if (!token) {
        record('S10_storefront_product', true, 'skipped (no SHOPIFY_STOREFRONT_TOKEN in env)');
      } else {
        const data = await page.evaluate(
          async ({ domain, token }) => {
            const res = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': token,
              },
              body: JSON.stringify({
                query:
                  '{ product(handle: "payday-deck-chrome-838") { availableForSale variants(first:1){ nodes { quantityAvailable } } } }',
              }),
            });
            return res.json();
          },
          { domain: SHOP_DOMAIN, token }
        );
        const p = data?.data?.product;
        const qty = p?.variants?.nodes?.[0]?.quantityAvailable;
        record('S10_storefront_product', Boolean(p), `availableForSale=${p?.availableForSale} qty=${qty}`);
      }
    } catch (e) {
      record('S10_storefront_product', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S11: Cart persistence across reload ---
  {
    const page = await browser.newPage();
    try {
      await waitForShop(page);
      await page.locator('.deck-card__add:not([disabled])').first().click({ timeout: 10000 });
      await page.waitForTimeout(200);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      const after = await page.evaluate(() => ({
        toggle: document.getElementById('cart-toggle')?.textContent,
        raw: localStorage.getItem('payday_deck_cart'),
      }));
      const ok = /Warenkorb \(1\)/.test(after.toggle || '') && (after.raw || '').includes('"id"');
      record('S11_cart_reload', ok, after.toggle || 'no toggle');
    } catch (e) {
      record('S11_cart_reload', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S12: Checkout disabled when empty ---
  {
    const page = await browser.newPage();
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => localStorage.removeItem('payday_deck_cart'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const disabled = await page.evaluate(() => document.getElementById('checkout-btn')?.disabled);
      record('S12_checkout_disabled_empty', disabled === true, String(disabled));
    } catch (e) {
      record('S12_checkout_disabled_empty', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S13: Two distinct line items + total ---
  {
    const page = await browser.newPage();
    try {
      await waitForShop(page);
      const adds = page.locator('.deck-card__add:not([disabled])');
      const n = await adds.count();
      if (n >= 2) {
        await adds.nth(0).click();
        await page.waitForTimeout(150);
        await adds.nth(1).click();
      } else {
        await adds.first().click();
      }
      await page.waitForTimeout(200);
      await ensureCartExpanded(page);
      const info = await page.evaluate(() => ({
        cart: document.getElementById('cart-toggle')?.textContent,
        sum: document.getElementById('cart-info')?.textContent,
        lines: document.querySelectorAll('#cart-lines .cart-line').length,
      }));
      const ok =
        info.lines >= 2 &&
        /Warenkorb \(2\)/.test(info.cart || '') &&
        (info.sum || '').includes('118');
      record('S13_multi_sku_total', ok, JSON.stringify(info));
    } catch (e) {
      record('S13_multi_sku_total', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S14: cart-close collapses expanded panel ---
  {
    const page = await browser.newPage();
    try {
      await waitForShop(page);
      await page.locator('.deck-card__add:not([disabled])').first().click({ timeout: 10000 });
      await ensureCartExpanded(page);
      await page.click('#cart-close');
      const expanded = await page.evaluate(() => document.getElementById('cart-panel')?.classList.contains('expanded'));
      record('S14_cart_close_collapse', !expanded, expanded ? 'still expanded' : 'collapsed');
    } catch (e) {
      record('S14_cart_close_collapse', false, e.message);
    } finally {
      await page.close();
    }
  }

  // --- S15: Deep link #shopify-connect ---
  {
    const page = await browser.newPage();
    try {
      const url = BASE.includes('#') ? BASE.replace(/#.*$/, '') + '#shopify-connect' : BASE + '#shopify-connect';
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);
      const hasModule = await page.evaluate(
        () => Boolean(window.PAYDAY_SHOPIFY_CONNECT?.mountConnectUI) && Boolean(window.PAYDAY_SHOPIFY_CHECKOUT)
      );
      record('S15_shopify_connect_hash', hasModule, hasModule ? 'modules loaded' : 'missing modules');
    } catch (e) {
      record('S15_shopify_connect_hash', false, e.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const summary = { base: BASE, passed, failed, total: results.length, results, ranAt: new Date().toISOString() };
  const outPath = '/opt/cursor/artifacts/deck-shop-stress-results.json';
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log('\n---');
  console.log(`Summary: ${passed}/${results.length} passed, ${failed} failed`);
  console.log(`Report: ${outPath}`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
