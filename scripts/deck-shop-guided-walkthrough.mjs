#!/usr/bin/env node
/**
 * Langsamer Cloud-Desktop-Walkthrough + Supabase-Log-Korrelation.
 * Usage: DISPLAY=:1 node scripts/deck-shop-guided-walkthrough.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const LIVE = 'https://1337wheels-design.github.io/prompthaus/deck-shop/';
const SHOT_DIR = process.env.SHOT_DIR || '/opt/cursor/artifacts/screenshots';
const LOG_PATH =
  process.env.WALKTHROUGH_LOG || '/opt/cursor/artifacts/supabase-walkthrough-log.md';
const PAUSE_MS = Number(process.env.WALKTHROUGH_PAUSE_MS || 3500);
const SLOW_MO = Number(process.env.WALKTHROUGH_SLOW_MO || 900);

mkdirSync(SHOT_DIR, { recursive: true });

const supabaseEvents = [];
const logParts = [];

function ts() {
  return new Date().toISOString();
}

function narr(title, body) {
  const block = `\n## ${title}\n\n_${ts()}_\n\n${body}\n`;
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log(body.replace(/\*\*/g, ''));
  logParts.push(block);
}

function logSupabase(ev) {
  supabaseEvents.push(ev);
  const lines = [
    `- **${ev.time}** \`${ev.method} ${ev.path}\` → HTTP **${ev.status}**`,
    ev.rpc ? `  - Postgres RPC: \`${ev.rpc}\`` : '',
    ev.note ? `  - ${ev.note}` : '',
    ev.bodyPreview ? `  - Response: \`${ev.bodyPreview}\`` : '',
  ].filter(Boolean);
  logParts.push(lines.join('\n') + '\n');
}

function normalizeApiPath(pathname) {
  const p = pathname || '';
  const v1 = p.indexOf('/v1/availability');
  if (v1 >= 0) return p.slice(v1);
  const cart = p.match(/\/v1\/cart\/(sync|release|heartbeat)/);
  if (cart) return `/v1/cart/${cart[1]}`;
  if (p.includes('/health')) return '/health';
  return p;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

logParts.push(
  `# Deck Shop Walkthrough ↔ Supabase Log\n\nProjekt: \`yoeehrdsrfwolzdtgmel\`\n\n` +
    `**Dashboard:** [Edge Functions → reservation-api → Logs](https://supabase.com/dashboard/project/yoeehrdsrfwolzdtgmel/functions/reservation-api/logs)\n\n` +
    `Jeder Browser-Schritt unten erzeugt Einträge in den **Edge Function Logs** (Request-Zeile + ggf. \`console\`). ` +
    `In Postgres laufen die RPCs \`deck_availability\`, \`deck_sync_cart\`, \`deck_release_session\` (SQL → Tabellen \`deck_reservation_holds\`, \`deck_base_stock\`).\n`
);

narr(
  'Schritt 0 — Vorbereitung',
  `Browser startet **headed** auf dem Cloud Desktop (slowMo ${SLOW_MO} ms, Pause ${PAUSE_MS} ms).\n` +
    `Im Supabase-Dashboard Logs-Tab **vorher öffnen** und Auto-Refresh an — dann siehst du jeden Request live.`
);

const headless = process.env.HEADLESS === '1';
const browser = await chromium.launch({ headless, slowMo: SLOW_MO });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on('response', async (res) => {
  const u = res.url();
  if (!u.includes('yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/reservation-api')) return;
  const url = new URL(u);
  const path = normalizeApiPath(url.pathname);

  let bodyPreview = '';
  try {
    const txt = await res.text();
    bodyPreview = txt.slice(0, 180).replace(/\s+/g, ' ');
  } catch {
    bodyPreview = '';
  }

  let rpc = '';
  let note = '';
  if (path === '/health') {
    rpc = '—';
    note = 'Kein DB-Zugriff; prüft Secrets (SUPABASE_URL, SERVICE_ROLE).';
  } else if (path === '/v1/availability') {
    rpc = 'deck_availability()';
    note = 'Löscht abgelaufene Holds, aggregiert `deck_base_stock` − aktive `deck_reservation_holds`.';
  } else if (path === '/v1/cart/sync') {
    rpc = 'deck_sync_cart(session, lines, ttl)';
    note = 'Transaktion: Session-Holds ersetzen, Konflikt → 409 insufficient.';
  } else if (path === '/v1/cart/release') {
    rpc = 'deck_release_session(session)';
    note = 'DELETE holds für Session; gibt neue availability zurück.';
  } else if (path === '/v1/cart/heartbeat') {
    rpc = 'deck_heartbeat_cart(...)';
    note = 'Sync + TTL verlängern (alle 30–120 s im Shop bei vollem Warenkorb).';
  }

  const ev = {
    time: ts(),
    method: res.request().method(),
    path,
    status: res.status(),
    rpc,
    note,
    bodyPreview,
  };
  logSupabase(ev);
  console.log(`  [Supabase] ${ev.method} ${ev.path} → ${ev.status} | RPC: ${rpc || '?'}`);
});

try {
  narr(
    'Schritt 1 — Deck Shop laden',
    `URL: ${LIVE}\n` +
      `Erwartung im Browser: Loader → Intro/Vorschau.\n` +
      `Supabase: Nach Init oft **GET /v1/availability** (\`initReservations()\` in index.html).`
  );
  await page.goto(LIVE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.screenshot({ path: join(SHOT_DIR, 'guided-01-load.png') });
  await sleep(PAUSE_MS);

  narr(
    'Schritt 2 — Shop freischalten',
    'Klicks auf **Weiter** (Intro). Kein Supabase-Call — nur UI.\n' +
      'Logs bleiben unverändert bis Availability/Sync.'
  );
  await sleep(1500);
  for (let i = 0; i < 6; i++) {
    await page.click('#nav-next').catch(() => {});
    await sleep(800);
  }
  await page.waitForSelector('#shop-section.is-unlocked', { timeout: 50000 });
  await page.screenshot({ path: join(SHOT_DIR, 'guided-02-shop.png') });
  await sleep(PAUSE_MS);

  const enabled = await page.evaluate(() => window.PAYDAY_RESERVATIONS?.isEnabled?.());
  narr(
    'Schritt 3 — Reservierung prüfen',
    `Client: PAYDAY_RESERVATIONS enabled = **${enabled}**\n` +
      `Prüfe im Log den letzten **GET /v1/availability** — Response enthält \`availability\` pro SKU.`
  );
  await sleep(PAUSE_MS);

  narr(
    'Schritt 4 — Erstes Deck in den Warenkorb',
    'Klick **In den Warenkorb**.\n' +
      'Supabase: **POST /v1/cart/sync** → RPC **deck_sync_cart** → Zeile(n) in `deck_reservation_holds` mit `expires_at` ≈ now+5min.'
  );
  const addBtn = page.locator('.deck-card__add:not([disabled])').first();
  await addBtn.click();
  await sleep(PAUSE_MS);
  await page.screenshot({ path: join(SHOT_DIR, 'guided-03-added.png') });

  narr(
    'Schritt 5 — Warenkorb öffnen',
    'Klick **Warenkorb (1)**. Kein neuer Supabase-Call (nur UI).\n' +
      'Hold bleibt in Postgres bis Release, Checkout oder TTL.'
  );
  await page.click('#cart-toggle');
  await sleep(PAUSE_MS);
  await page.screenshot({ path: join(SHOT_DIR, 'guided-04-cart.png') });

  narr(
    'Schritt 6 — Zweites Deck (optionaler Sync)',
    'Noch ein **In den Warenkorb** → erneut **POST /v1/cart/sync** (kompletter Warenkorb wird gesendet).'
  );
  await page.click('#cart-collapse').catch(() => {});
  await sleep(1200);
  const add2 = page.locator('.deck-card__add:not([disabled])').first();
  if (await add2.count()) {
    await add2.click();
    await sleep(PAUSE_MS);
  }
  await page.screenshot({ path: join(SHOT_DIR, 'guided-05-two-items.png') });

  narr(
    'Schritt 7 — Entfernen (Sync mit weniger Zeilen)',
    '**Entfernen** auf einer Cart-Zeile → wieder **POST /v1/cart/sync** mit aktualisierten `lines`.'
  );
  const removeBtn = page.locator('.cart-line__remove').first();
  if (await removeBtn.count()) {
    await removeBtn.click();
    await sleep(PAUSE_MS);
  }
  await page.screenshot({ path: join(SHOT_DIR, 'guided-06-removed.png') });

  narr(
    'Schritt 8 — Checkout-Klick (Release)',
    '**Zur Kasse** startet Shopify-Redirect; vorher **clearCart** → **POST /v1/cart/release**.\n' +
      'Log: **deck_release_session** — Holds dieser Session gelöscht, Bestand für andere sofort frei.'
  );
  await page.click('#checkout-btn');
  await sleep(PAUSE_MS * 2);
  await page.screenshot({ path: join(SHOT_DIR, 'guided-07-checkout.png') }).catch(() => {});

  logParts.push(
    `\n---\n\n## Zusammenfassung\n\n${supabaseEvents.length} Supabase-HTTP-Events erfasst.\n\n` +
      `| # | Zeit | Request | Status | Postgres |\n|---|------|---------|--------|----------|\n` +
      supabaseEvents
        .map(
          (e, i) =>
            `| ${i + 1} | ${e.time.split('T')[1].replace('Z', '')} | ${e.method} ${e.path} | ${e.status} | ${e.rpc || '—'} |`
        )
        .join('\n') +
      '\n'
  );

  narr(
    'Fertig',
    `Walkthrough-Log: \`${LOG_PATH}\`\nScreenshots: \`${SHOT_DIR}/guided-*.png\``
  );
} catch (err) {
  narr('Fehler', String(err.message || err));
  await page.screenshot({ path: join(SHOT_DIR, 'guided-error.png') }).catch(() => {});
  throw err;
} finally {
  await browser.close();
  writeFileSync(LOG_PATH, logParts.join(''));
}

console.log('\nWalkthrough complete. Log:', LOG_PATH);
