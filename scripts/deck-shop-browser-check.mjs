#!/usr/bin/env node
/**
 * Headless browser check — sichtbare Inhalte, Console, Reservierungs-API.
 */
import { chromium } from 'playwright';

const LIVE = 'https://1337wheels-design.github.io/prompthaus/deck-shop/';
const LOCAL = 'http://127.0.0.1:8080/?reserveApi=http://127.0.0.1:8791';

async function unlockShop(page) {
  await page.waitForTimeout(2000);
  const unlocked = await page.evaluate(
    () => document.getElementById('shop-section')?.classList.contains('is-unlocked')
  );
  if (unlocked) return true;
  for (let i = 0; i < 6; i++) {
    await page.click('#nav-next', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  try {
    await page.waitForSelector('#shop-section.is-unlocked', { timeout: 35000 });
    return true;
  } catch {
    return false;
  }
}

async function inspectPage(page, label, url) {
  const consoleErrors = [];
  const failedReqs = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    failedReqs.push(`${req.url()} — ${req.failure()?.errorText || 'failed'}`);
  });

  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const report = {
    label,
    url,
    httpStatus: res?.status(),
    title: await page.title(),
    scripts: await page.evaluate(() =>
      [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'))
    ),
    reservationEnabled: await page.evaluate(() => window.PAYDAY_RESERVATIONS?.isEnabled?.()),
    reservationApi: await page.evaluate(() => window.PAYDAY_RESERVATIONS?.getConfig?.()?.apiBase),
    cartToggle: await page.textContent('#cart-toggle').catch(() => null),
    phaseBadge: await page.textContent('#phase-badge').catch(() => null),
    shopifyStatusVisible: await page.evaluate(() => {
      const el = document.getElementById('shopify-status');
      return el ? el.textContent?.trim() : '';
    }),
    unlocked: await unlockShop(page),
    cartAfterUnlock: await page.textContent('#cart-toggle').catch(() => null),
    firstAddBtnDisabled: await page.evaluate(() => {
      const b = document.querySelector('.deck-card__add');
      return b ? b.disabled : null;
    }),
    consoleErrors: [],
    failedReqs: [],
    reservationFetch: null,
  };

  if (report.unlocked) {
    const add = page.locator('.deck-card__add:not([disabled])').first();
    if (await add.count()) {
      await add.click();
      await page.waitForTimeout(800);
      report.cartAfterAdd = await page.textContent('#cart-toggle');
    }
  }

  report.consoleErrors = [...new Set(consoleErrors)].slice(0, 15);
  report.failedReqs = [...new Set(failedReqs)].slice(0, 15);
  report.reservationEnabled = await page.evaluate(() => window.PAYDAY_RESERVATIONS?.isEnabled?.());

  return report;
}

async function twoSessionReserveTest() {
  const browser = await chromium.launch({ headless: true });
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  try {
    await pageA.goto(LOCAL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await pageB.goto(LOCAL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await unlockShop(pageA);
    await unlockShop(pageB);

    const skuLine = await pageA.evaluate(async () => {
      const cards = [...document.querySelectorAll('.deck-card')];
      for (const card of cards) {
        const meta = card.querySelector('.deck-card__meta')?.textContent?.trim();
        const stock = card.querySelector('.deck-card__stock')?.textContent || '';
        const add = card.querySelector('.deck-card__add');
        if (meta && stock.includes('1 von') && add && !add.disabled) {
          return { meta, stock };
        }
      }
      return null;
    });

    let clicks = 0;
    if (skuLine) {
      await pageA.evaluate(() => {
        const cards = [...document.querySelectorAll('.deck-card')];
        for (const card of cards) {
          const stock = card.querySelector('.deck-card__stock')?.textContent || '';
          const add = card.querySelector('.deck-card__add');
          if (stock.includes('1 von') && add && !add.disabled) {
            add.click();
            return;
          }
        }
      });
      clicks++;
      await pageA.waitForTimeout(500);
      pageB.once('dialog', (d) => d.accept());
      await pageB.evaluate(() => {
        const cards = [...document.querySelectorAll('.deck-card')];
        for (const card of cards) {
          const stock = card.querySelector('.deck-card__stock')?.textContent || '';
          const add = card.querySelector('.deck-card__add');
          if (stock.includes('1 von') && add && !add.disabled) {
            add.click();
            return;
          }
        }
      });
      await pageB.waitForTimeout(500);
    }

    return {
      localUrl: LOCAL,
      skuTried: skuLine,
      cartA: await pageA.textContent('#cart-toggle'),
      cartB: await pageB.textContent('#cart-toggle'),
      reserveEnabledA: await pageA.evaluate(() => window.PAYDAY_RESERVATIONS?.isEnabled?.()),
    };
  } catch (e) {
    return { error: String(e.message || e) };
  } finally {
    await browser.close();
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const live = await inspectPage(page, 'live-gh-pages', LIVE);
await browser.close();

console.log('=== LIVE GitHub Pages ===');
console.log(JSON.stringify(live, null, 2));

let local = { skipped: true };
try {
  const health = await fetch('http://127.0.0.1:8791/health');
  if (health.ok) {
    const browser2 = await chromium.launch({ headless: true });
    const page2 = await browser2.newPage();
    local = await inspectPage(page2, 'local-reserve', LOCAL);
    await browser2.close();
    console.log('\n=== LOCAL mit Reservierung ===');
    console.log(JSON.stringify(local, null, 2));
    console.log('\n=== Zwei Sessions ===');
    console.log(JSON.stringify(await twoSessionReserveTest(), null, 2));
  }
} catch (e) {
  console.log('\nLOCAL skip:', e.message);
}
