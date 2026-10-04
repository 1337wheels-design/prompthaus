#!/usr/bin/env node
/**
 * Shop-Sync Secrets + Deploy-Hilfe (Supabase CLI).
 * Usage: node scripts/supabase-shop-sync-setup.mjs [--deploy] [--generate-cron-secret]
 */
import { readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { randomBytes } from 'crypto';

const PROJECT = process.env.SUPABASE_PROJECT_REF || 'yoeehrdsrfwolzdtgmel';
const MAP_PATH = new URL('../deck-shop/deck-sku-handle-map.json', import.meta.url);
const SHOP = process.env.SHOPIFY_SHOP_DOMAIN || 'xwk1u9-6z.myshopify.com';

const args = new Set(process.argv.slice(2));
const mapJson = readFileSync(MAP_PATH, 'utf8').trim();
const mapCompact = JSON.stringify(JSON.parse(mapJson));

function run(cmd, cmdArgs, input) {
  const r = spawnSync(cmd, cmdArgs, {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
  }
  return (r.stdout || '').trim();
}

const cronSecret =
  process.env.DECK_SYNC_CRON_SECRET ||
  (args.has('--generate-cron-secret') ? randomBytes(24).toString('hex') : '');

console.log('Supabase project:', PROJECT);
console.log('Shop domain:', SHOP);
console.log('SKU map entries:', Object.keys(JSON.parse(mapJson)).length);

run('npx', ['supabase', 'secrets', 'set', `SHOPIFY_SHOP_DOMAIN=${SHOP}`, '--project-ref', PROJECT]);
run('npx', [
  'supabase',
  'secrets',
  'set',
  `DECK_SKU_HANDLE_MAP_JSON=${mapCompact}`,
  '--project-ref',
  PROJECT,
]);

if (cronSecret) {
  run('npx', [
    'supabase',
    'secrets',
    'set',
    `DECK_SYNC_CRON_SECRET=${cronSecret}`,
    '--project-ref',
    PROJECT,
  ]);
  console.log('\nDECK_SYNC_CRON_SECRET gesetzt (lokal für Cron-Tests in .env speichern, nicht committen).');
  if (args.has('--generate-cron-secret')) {
    const envHint = `\nDECK_SYNC_CRON_SECRET=${cronSecret}\n`;
    console.log(envHint);
  }
} else {
  console.log('\nHinweis: DECK_SYNC_CRON_SECRET fehlt — optional mit --generate-cron-secret erzeugen.');
}

const sf = process.env.SHOPIFY_STOREFRONT_TOKEN;
if (sf) {
  run('npx', [
    'supabase',
    'secrets',
    'set',
    `SHOPIFY_STOREFRONT_TOKEN=${sf}`,
    '--project-ref',
    PROJECT,
  ]);
  console.log('SHOPIFY_STOREFRONT_TOKEN gesetzt.');
} else {
  console.log(`
Noch erforderlich (Shopify Admin → Headless / Storefront API public token):
  export SHOPIFY_STOREFRONT_TOKEN='…'
  npx supabase secrets set SHOPIFY_STOREFRONT_TOKEN="$SHOPIFY_STOREFRONT_TOKEN" --project-ref ${PROJECT}
`);
}

if (args.has('--deploy')) {
  console.log('\nDeploy shop-sync…');
  run('npx', ['supabase', 'functions', 'deploy', 'shop-sync', '--project-ref', PROJECT]);
}

console.log(`
Health:  curl -sS https://${PROJECT}.supabase.co/functions/v1/shop-sync/health
Sync:    curl -X POST -H "Authorization: Bearer \$DECK_SYNC_CRON_SECRET" \\
           https://${PROJECT}.supabase.co/functions/v1/shop-sync

Cron: Dashboard → Edge Functions → shop-sync → Schedules (z. B. */5 * * * *)
      Header: Authorization: Bearer <DECK_SYNC_CRON_SECRET>
`);
