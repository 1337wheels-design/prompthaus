#!/usr/bin/env node
/**
 * Desktop browser test — live Deck Shop + Supabase Reservierung.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const LIVE = 'https://1337wheels-design.github.io/prompthaus/deck-shop/';
const SHOT_DIR = process.env.SHOT_DIR || '/opt/cursor/artifacts/screenshots';
const VIEWPORT = { width: 1440, height: 900 };

mkdirSync(SHOT_DIR, { recursive: true });

const report = { steps: [], ok: true, supabaseCalls: [] };

function step(name, ok, detail) {
  report.steps.push({ name, ok, detail });
  if (!ok) report.ok = false;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
}

async function snap(page, file) {
  const path = join(SHOT_DIR, file);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function unlockShop(page) {
  await page.waitForTimeout(2000);
  for (let i = 0; i < 6; i++) {
    await page.click('#nav-next', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(450);
  }
  await page.waitForSelector('#shop-section.is-unlocked', { timeout: 50000 });
}

const headless = process.env.HEADLESS === '1' || process.env.HEADLESS === 'true';
const browser = await chromium.launch({
  headless,
  slowMo: headless ? 0 : 120,
});
const context = await browser.newContext({ viewport: VIEWPORT });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('yoeehrdsrfwolzdtgmel.supabase.co')) {
    report.supabaseCalls.push(u.split('?')[0]);
  }
});

try {
  await page.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await snap(page, 'desktop-01-loaded.png');

  const cfg = await page.evaluate(() => ({
    enabled: window.PAYDAY_RESERVATIONS?.isEnabled?.(),
    api: window.PAYDAY_RESERVATIONS?.getConfig?.()?.apiBase,
  }));
  step('reservation_config', cfg.enabled && cfg.api?.includes('yoeehrdsrfwolzdtgmel'), JSON.stringify(cfg));

  await unlockShop(page);
  await snap(page, 'desktop-02-shop-unlocked.png');
  step('shop_unlocked', true, 'is-unlocked');

  await page.waitForTimeout(1500);
  const hadAvail = report.supabaseCalls.some((u) => u.includes('/v1/availability'));
  step('supabase_availability_on_load', hadAvail, report.supabaseCalls.join(' | ') || 'none yet');

  const addBtn = page.locator('.deck-card__add:not([disabled])').first();
  const addCount = await addBtn.count();
  step('add_button_visible', addCount > 0, String(addCount));

  if (addCount) {
    await addBtn.click();
    await page.waitForTimeout(1500);
    await snap(page, 'desktop-03-after-add.png');
    const cart = await page.textContent('#cart-toggle');
    step('cart_after_add', /Warenkorb \(1\)/.test(cart || ''), cart || '');
    const hadSync = report.supabaseCalls.some((u) => u.includes('/v1/cart/sync'));
    step('supabase_sync_on_add', hadSync, report.supabaseCalls.filter((u) => u.includes('cart')).join(' | '));
  }

  await page.click('#cart-toggle').catch(() => {});
  await page.waitForTimeout(400);
  await snap(page, 'desktop-04-cart-panel.png');

  const checkoutDisabled = await page.evaluate(() => document.getElementById('checkout-btn')?.disabled);
  step('checkout_enabled', checkoutDisabled === false, String(checkoutDisabled));

  const badConsole = consoleErrors.filter(
    (e) => !e.includes('config.local.js') && !e.includes('404')
  );
  step('no_critical_console_errors', badConsole.length === 0, badConsole.slice(0, 3).join('; ') || 'clean');
} catch (err) {
  step('run', false, String(err.message || err));
  await snap(page, 'desktop-error.png').catch(() => {});
} finally {
  await browser.close();
}

writeFileSync(join(SHOT_DIR, 'desktop-test-report.json'), JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
console.log('\nDesktop test OK. Screenshots:', SHOT_DIR);
