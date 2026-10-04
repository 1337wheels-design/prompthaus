#!/usr/bin/env node
/**
 * Cloud-Desktop: 3 Browser-Sessions (eigene sessionStorage) gegen live Deck Shop + Supabase.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const LIVE = 'https://1337wheels-design.github.io/prompthaus/deck-shop/';
const API =
  process.env.RESERVATION_API ||
  'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/reservation-api';
const SHOT_DIR = process.env.SHOT_DIR || '/opt/cursor/artifacts/screenshots';
const SKU = 'chrome-838';
const SESSION_IDS = ['desktop-session-a', 'desktop-session-b', 'desktop-session-c'];

mkdirSync(SHOT_DIR, { recursive: true });

const report = { steps: [], ok: true };

function step(name, ok, detail) {
  report.steps.push({ name, ok, detail });
  if (!ok) report.ok = false;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
}

async function apiRelease(sessionId) {
  await fetch(`${API}/v1/cart/release`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://1337wheels-design.github.io',
    },
    body: JSON.stringify({ sessionId }),
  }).catch(() => {});
}

async function unlockShop(page) {
  await page.waitForTimeout(2000);
  for (let i = 0; i < 6; i++) {
    await page.click('#nav-next', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('#shop-section.is-unlocked', { timeout: 60000 });
  await page.waitForTimeout(1200);
}

async function refreshAvail(page) {
  return page.evaluate(async (sku) => {
    const PR = window.PAYDAY_RESERVATIONS;
    if (!PR?.fetchAvailability) return { ok: false, reason: 'no_module' };
    const res = await PR.fetchAvailability();
    if (res.ok && res.availability) {
      window.dispatchEvent(
        new CustomEvent('payday-reservation-updated', { detail: { availability: res.availability } })
      );
    }
    return {
      ok: res.ok,
      avail: res.availability?.[sku],
      sessionId: PR.getSessionId?.(),
    };
  }, SKU);
}

async function readCardStock(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('.deck-card')];
    const card = cards.find(
      (c) =>
        c.textContent.includes('CHROME') &&
        (c.textContent.includes('8.38') || c.textContent.includes('8.38″'))
    );
    const stock = card?.querySelector('.deck-card__stock')?.textContent?.trim() || '';
    const disabled = card?.querySelector('.deck-card__add')?.disabled ?? true;
    return { stock, disabled };
  });
}

async function filterChrome838(page) {
  await page.click('#filter-design [data-design="chrome"]', { timeout: 10000 });
  await page.click('#filter-size [data-size="838"]', { timeout: 10000 });
  await page.waitForTimeout(400);
}

async function collapseCartPanel(page) {
  await page.evaluate(() => {
    const panel = document.getElementById('cart-panel');
    panel?.classList.remove('expanded');
  });
  await page.waitForTimeout(200);
}

async function addChrome838(page, times) {
  await filterChrome838(page);
  const add = page.locator('.deck-card').filter({ hasText: 'CHROME' }).first().locator('.deck-card__add');
  for (let i = 0; i < times; i++) {
    await collapseCartPanel(page);
    if (await add.isDisabled()) break;
    await add.click({ timeout: 15000 });
    await page.waitForTimeout(900);
  }
  return page.evaluate(() => ({
    cartLen: JSON.parse(localStorage.getItem('payday_deck_cart') || '[]').length,
  }));
}

async function snap(page, file) {
  const path = join(SHOT_DIR, file);
  await page.screenshot({ path, fullPage: false });
  return path;
}

for (const sid of [...SESSION_IDS, 'tri-session-a', 'tri-session-b', 'tri-session-c']) {
  await apiRelease(sid);
}

const headless = process.env.HEADLESS === '1' || process.env.HEADLESS === 'true';
const browser = await chromium.launch({
  headless,
  slowMo: headless ? 0 : 100,
});

const contexts = [];
const pages = [];

for (let i = 0; i < 3; i++) {
  const sessionId = SESSION_IDS[i];
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await ctx.addInitScript((sid) => {
    sessionStorage.setItem('payday_reserve_session_id', sid);
    localStorage.setItem('payday_deck_cart', '[]');
  }, sessionId);
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept().catch(() => {}));
  contexts.push(ctx);
  pages.push(page);
}

const [pageA, pageB, pageC] = pages;

try {
  await Promise.all(pages.map((p) => p.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 90000 })));
  step('pages_loaded', true, LIVE);

  await Promise.all(pages.map((p) => unlockShop(p)));
  await snap(pageA, 'three-sess-01-shop-unlocked.png');

  const cfgA = await pageA.evaluate(() => ({
    enabled: window.PAYDAY_RESERVATIONS?.isEnabled?.(),
    sid: window.PAYDAY_RESERVATIONS?.getSessionId?.(),
  }));
  step(
    'reservations_enabled',
    cfgA.enabled && SESSION_IDS.includes(cfgA.sid),
    JSON.stringify(cfgA)
  );

  const base = await refreshAvail(pageA);
  const b0 = base.avail;
  step('baseline_chrome838', typeof b0 === 'number' && b0 >= 3, `global=${b0}`);

  const afterA = await addChrome838(pageA, 2);
  await snap(pageA, 'three-sess-02-a-two-in-cart.png');
  const globAfterA = (await refreshAvail(pageB)).avail;
  step('session_a_two_in_cart', afterA.cartLen === 2, `cart=${afterA.cartLen}`);
  step(
    'after_a_global_on_b',
    globAfterA === b0 - 2,
    `B sieht chrome-838=${globAfterA} (erwartet ${b0 - 2})`
  );

  const cardB1 = await readCardStock(pageB);
  step('session_b_ui_stock_after_a', /von/.test(cardB1.stock), cardB1.stock);

  const afterB = await addChrome838(pageB, 2);
  await snap(pageB, 'three-sess-03-b-after-adds.png');
  const globAfterB = (await refreshAvail(pageC)).avail;
  const expectedAfterB = Math.max(0, b0 - 2 - Math.min(2, b0 - 2));
  step(
    'session_b_add_attempt',
    afterB.cartLen >= 1,
    `cart=${afterB.cartLen} global=${globAfterB} erwartet~=${expectedAfterB}`
  );
  step(
    'after_b_global_on_c',
    globAfterB === expectedAfterB,
    `C sieht chrome-838=${globAfterB}`
  );

  const beforeC = await addChrome838(pageC, 2);
  const globAfterCtry = (await refreshAvail(pageA)).avail;
  if (beforeC.cartLen < 2 && globAfterCtry > 0) {
    await addChrome838(pageC, 1);
  }
  await snap(pageC, 'three-sess-04-c-final.png');
  const finalGlob = (await refreshAvail(pageA)).avail;
  step(
    'session_c_competition',
    finalGlob === 0 || (b0 <= 4 && finalGlob <= 1),
    `global chrome-838=${finalGlob} nach A+B+C`
  );

  const cardC = await readCardStock(pageC);
  step(
    'chrome838_sold_out_or_low',
    finalGlob === 0 ? cardC.disabled || /Ausverkauft|0 von/.test(cardC.stock) : true,
    cardC.stock
  );

  await pageA.evaluate(() => window.PAYDAY_RESERVATIONS?.releaseCart?.());
  await pageA.waitForTimeout(600);
  const afterReleaseA = (await refreshAvail(pageB)).avail;
  step(
    'release_a_frees_stock',
    afterReleaseA >= 2,
    `nach Release A: global=${afterReleaseA}`
  );
  await snap(pageB, 'three-sess-05-after-release-a.png');

  await Promise.all(
    pages.map((p) => p.evaluate(() => window.PAYDAY_RESERVATIONS?.releaseCart?.()))
  );
  await pageA.waitForTimeout(800);
  const restored = (await refreshAvail(pageA)).avail;
  step('cleanup_restored_baseline', restored === b0, `chrome-838=${restored} (baseline ${b0})`);
} catch (err) {
  step('run', false, String(err.message || err));
  await snap(pageA, 'three-sess-error.png').catch(() => {});
} finally {
  await browser.close();
}

writeFileSync(join(SHOT_DIR, 'three-sessions-desktop-report.json'), JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('\nThree-session desktop test OK. Screenshots:', SHOT_DIR);
