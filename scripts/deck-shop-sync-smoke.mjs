#!/usr/bin/env node
/** Health + optional Sync gegen live shop-sync Edge Function. */
const PROJECT = process.env.SUPABASE_PROJECT_REF || 'yoeehrdsrfwolzdtgmel';
const BASE = `https://${PROJECT}.supabase.co/functions/v1/shop-sync`;
const SECRET = process.env.DECK_SYNC_CRON_SECRET || '';

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
  const sync = await post();
  console.log('\nsync', sync.status, JSON.stringify(sync.json, null, 2));
  if (!sync.json?.ok) process.exit(1);
  const chrome = sync.json?.applied?.availability?.['chrome-838'];
  if (typeof chrome === 'number') {
    console.log('\nchrome-838 availability after sync:', chrome);
  }
}

console.log('\nOK shop-sync smoke');
