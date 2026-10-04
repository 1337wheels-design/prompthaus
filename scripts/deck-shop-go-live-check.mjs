#!/usr/bin/env node
/** Go-Live Smoke — keine Secrets nötig außer optional DECK_SYNC_CRON_SECRET für Sync. */
const RES =
  'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/reservation-api';
const SYNC = 'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/shop-sync';
const SHOP = 'https://1337wheels-design.github.io/prompthaus/deck-shop/';
const ORIGIN = 'https://1337wheels-design.github.io';

const results = [];
function ok(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}: ${detail}`);
}

const h = await fetch(`${RES}/health`, { headers: { Origin: ORIGIN } }).then((r) => r.json());
ok('reservation_health', h.ok && h.rateLimit === 'stufe1', JSON.stringify(h));

const sh = await fetch(`${SYNC}/health`).then((r) => r.json());
ok('shop_sync_configured', sh.ok && sh.configured, JSON.stringify(sh.checks || sh));

const avail = await fetch(`${RES}/v1/availability?sessionId=go-live-probe`, {
  headers: { Origin: ORIGIN },
}).then((r) => r.json());
ok(
  'availability',
  avail.ok && typeof avail.availability?.['chrome-838'] === 'number',
  `chrome-838=${avail.availability?.['chrome-838']}`
);

const cron = process.env.DECK_SYNC_CRON_SECRET?.trim();
if (cron) {
  const sync = await fetch(SYNC, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cron}`, 'Content-Type': 'application/json' },
    body: '{}',
  }).then((r) => r.json());
  ok('shop_sync_post', sync.ok === true, sync.ok ? `skus=${sync.syncedSkus}` : JSON.stringify(sync));
} else {
  ok('shop_sync_post', true, 'SKIP (DECK_SYNC_CRON_SECRET nicht gesetzt)');
}

const root = await fetch('https://xwk1u9-6z.myshopify.com/', { redirect: 'manual' });
ok('shopify_not_password', root.status === 200, `GET / → ${root.status}`);

const pages = await fetch(SHOP, { redirect: 'manual' });
ok('deck_shop_pages', pages.status === 200, String(pages.status));

const failed = results.filter((r) => !r.pass);
console.log(`\nGo-live check: ${results.length - failed.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
