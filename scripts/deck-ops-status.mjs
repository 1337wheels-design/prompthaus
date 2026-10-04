#!/usr/bin/env node
/**
 * Ops-Snapshot (CLI) — Vorstufe zum Dashboard.
 * Usage: node scripts/deck-ops-status.mjs [--json]
 */
const RES =
  process.env.RESERVATION_API ||
  'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/reservation-api';
const SYNC =
  process.env.SHOP_SYNC_URL ||
  'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/shop-sync';
const PAGES_SHOP =
  process.env.DECK_SHOP_URL ||
  'https://1337wheels-design.github.io/prompthaus/deck-shop/';
const SHOPIFY = process.env.SHOPIFY_SHOP_DOMAIN || 'xwk1u9-6z.myshopify.com';
const ORIGIN = 'https://1337wheels-design.github.io';
const jsonOut = process.argv.includes('--json');

async function probe(name, fn) {
  try {
    const data = await fn();
    return { name, ok: true, ...data };
  } catch (e) {
    return { name, ok: false, error: String(e.message || e) };
  }
}

const snapshot = {
  at: new Date().toISOString(),
  panels: [],
};

snapshot.panels.push(
  await probe('supabase_reservation', async () => {
    const h = await fetch(`${RES}/health`, { headers: { Origin: ORIGIN } }).then((r) =>
      r.json()
    );
    const a = await fetch(`${RES}/v1/availability?sessionId=ops-cli`, {
      headers: { Origin: ORIGIN },
    }).then((r) => r.json());
    return {
      rateLimit: h.rateLimit,
      rateLimitDb: h.rateLimitDb,
      chrome838: a.availability?.['chrome-838'],
      totalAvail: Object.values(a.availability || {}).reduce((s, n) => s + (n || 0), 0),
    };
  })
);

snapshot.panels.push(
  await probe('supabase_shop_sync', async () => {
    const h = await fetch(`${SYNC}/health`).then((r) => r.json());
    let lastSync = null;
    const cron = process.env.DECK_SYNC_CRON_SECRET?.trim();
    if (cron) {
      const s = await fetch(SYNC, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cron}`, 'Content-Type': 'application/json' },
        body: '{}',
      }).then((r) => r.json());
      lastSync = s.ok ? { syncedSkus: s.syncedSkus, chrome838: s.applied?.availability?.['chrome-838'] } : s;
    }
    return { configured: h.configured, checks: h.checks, manualSync: lastSync || 'SKIP (no DECK_SYNC_CRON_SECRET)' };
  })
);

snapshot.panels.push(
  await probe('shopify_storefront', async () => {
    const root = await fetch(`https://${SHOPIFY}/`, { redirect: 'manual' });
    return { storefrontHttp: root.status, passwordLocked: root.status !== 200 };
  })
);

snapshot.panels.push(
  await probe('github_pages_deck_shop', async () => {
    const res = await fetch(PAGES_SHOP, { redirect: 'manual' });
    return { http: res.status, url: PAGES_SHOP };
  })
);

snapshot.panels.push(
  await probe('github_config_public', async () => {
    const url =
      'https://raw.githubusercontent.com/1337wheels-design/prompthaus/gh-pages/deck-shop/config.js';
    const res = await fetch(url);
    const text = await res.text();
    const hasReserve = /reservationApiUrl:\s*['"]https:\/\/yoeehrdsrfwolzdtgmel/.test(text);
    return { configFetch: res.status, reservationApiConfigured: hasReserve };
  })
);

const degraded = snapshot.panels.some((p) => !p.ok);
snapshot.overall = degraded ? 'degraded' : 'ok';

if (jsonOut) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('\n=== Deck Shop Ops Snapshot ===');
  console.log('Time:', snapshot.at);
  console.log('Overall:', snapshot.overall.toUpperCase());
  for (const p of snapshot.panels) {
    console.log(`\n[${p.ok ? 'OK' : 'FAIL'}] ${p.name}`);
    console.log(JSON.stringify(p, null, 2).split('\n').slice(1, -1).join('\n'));
  }
  console.log('\nHinweis: Holds, sync_runs, Shopify qty — benötigen ops-api (siehe docs/deck-ops-dashboard-plan.md)');
}

process.exit(degraded ? 1 : 0);
