#!/usr/bin/env node
/** Health + optional Sync gegen live shop-sync Edge Function. */
const PROJECT = process.env.SUPABASE_PROJECT_REF || 'yoeehrdsrfwolzdtgmel';
const BASE = `https://${PROJECT}.supabase.co/functions/v1/shop-sync`;
function readCronSecret() {
  const raw = (process.env.DECK_SYNC_CRON_SECRET || '').trim();
  if (!raw) return '';
  if (raw === '…' || raw.includes('\u2026') || !/^[\x21-\x7E]+$/.test(raw)) {
    console.error(
      'DECK_SYNC_CRON_SECRET ungültig: kein Platzhalter „…“ aus der Doku — echtes ASCII-Secret setzen.\n' +
        'Neu erzeugen: npm run supabase:shop-sync:setup (Ausgabe DECK_SYNC_CRON_SECRET=…)\n' +
        'Nicht verwechseln mit SHOPIFY_STOREFRONT_TOKEN.'
    );
    process.exit(1);
  }
  if (/^[a-f0-9]{32}$/i.test(raw)) {
    console.error(
      'DECK_SYNC_CRON_SECRET sieht aus wie der SHOPIFY_STOREFRONT_TOKEN (32 Hex).\n' +
        'Das Cron-Secret ist ein anderes, längeres Secret aus npm run supabase:shop-sync:setup.'
    );
    process.exit(1);
  }
  return raw;
}

const SECRET = readCronSecret();

async function get(path) {
  const headers = {};
  if (SECRET) headers.Authorization = `Bearer ${SECRET}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function post() {
  const headers = { 'Content-Type': 'application/json' };
  if (SECRET) headers.Authorization = `Bearer ${SECRET}`;
  const res = await fetch(BASE, { method: 'POST', headers, body: '{}' });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const health = await get('/health');
console.log('health', health.status, JSON.stringify(health.json, null, 2));

if (!health.json?.configured) {
  console.error('\nShop-Sync nicht vollständig konfiguriert — SHOPIFY_STOREFRONT_TOKEN setzen.');
  process.exit(health.status === 200 ? 2 : 1);
}

if (process.argv.includes('--sync')) {
  if (!SECRET) {
    console.error(
      '\nFür --sync: export DECK_SYNC_CRON_SECRET="<hex aus npm run supabase:shop-sync:setup>"\n' +
        '(Nicht der Storefront-Token — nur shop-sync Cron/Authorization.)'
    );
    process.exit(1);
  }
  const sync = await post();
  console.log('\nsync', sync.status, JSON.stringify(sync.json, null, 2));
  if (sync.status === 401) {
    console.error(
      '\n401 unauthorized: Secret in Supabase ≠ DECK_SYNC_CRON_SECRET in deiner Shell.\n' +
        'Neu setzen: npm run supabase:shop-sync:setup — dann die ausgegebene Zeile exportieren.'
    );
    process.exit(1);
  }
  if (!sync.json?.ok) process.exit(1);
  const chrome = sync.json?.applied?.availability?.['chrome-838'];
  if (typeof chrome === 'number') {
    console.log('\nchrome-838 availability after sync:', chrome);
  }
}

console.log('\nOK shop-sync smoke');
