#!/usr/bin/env node
/**
 * Erzeugt deck-report/snapshot.json + aktualisiert Bericht-Zeitstempel.
 * Usage: node scripts/deck-ops-report-build.mjs
 */
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = join(__dirname, '../deck-report');

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
const SUPABASE_PROJECT = 'yoeehrdsrfwolzdtgmel';

async function probe(name, fn) {
  try {
    const data = await fn();
    return { name, ok: true, ...data };
  } catch (e) {
    return { name, ok: false, error: String(e.message || e) };
  }
}

const at = new Date().toISOString();
const panels = [];

panels.push(
  await probe('supabase_reservation', async () => {
    const h = await fetch(`${RES}/health`, { headers: { Origin: ORIGIN } }).then((r) => r.json());
    const a = await fetch(`${RES}/v1/availability?sessionId=ops-report`, {
      headers: { Origin: ORIGIN },
    }).then((r) => r.json());
    const availability = a.availability ?? {};
    return {
      rateLimit: h.rateLimit,
      rateLimitDb: h.rateLimitDb,
      ttlMs: h.ttlMs,
      availability,
      totalAvail: Object.values(availability).reduce((s, n) => s + (Number(n) || 0), 0),
    };
  })
);

panels.push(
  await probe('supabase_shop_sync', async () => {
    const h = await fetch(`${SYNC}/health`).then((r) => r.json());
    return { configured: h.configured, checks: h.checks };
  })
);

panels.push(
  await probe('shopify_storefront', async () => {
    const root = await fetch(`https://${SHOPIFY}/`, { redirect: 'manual' });
    return { storefrontHttp: root.status, passwordLocked: root.status !== 200 };
  })
);

panels.push(
  await probe('github_pages_deck_shop', async () => {
    const res = await fetch(PAGES_SHOP, { redirect: 'manual' });
    return { http: res.status, url: PAGES_SHOP };
  })
);

const reservation = panels.find((p) => p.name === 'supabase_reservation');
const shopSync = panels.find((p) => p.name === 'supabase_shop_sync');
const degraded = panels.some((p) => !p.ok);

const snapshot = {
  at,
  overall: degraded ? 'degraded' : 'ok',
  panels,
  links: {
    supabaseFunctions: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT}/functions`,
    supabaseSql: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT}/sql/new`,
    supabaseTables: `https://supabase.com/dashboard/project/${SUPABASE_PROJECT}/editor`,
    deckShop: PAGES_SHOP,
    shopifyAdmin: `https://${SHOPIFY}/admin`,
  },
};

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(join(REPORT_DIR, 'snapshot.json'), JSON.stringify(snapshot, null, 2));

const berichtPath = join(REPORT_DIR, 'bericht.json');
let bericht;
try {
  bericht = JSON.parse(readFileSync(berichtPath, 'utf8'));
} catch {
  bericht = { title: 'Deck Shop — Ops-Bericht', sections: [] };
}

bericht.generatedAt = at;
bericht.liveSummary = {
  overall: snapshot.overall,
  rateLimit: reservation?.rateLimit ?? 'unknown',
  totalAvail: reservation?.totalAvail ?? null,
  shopSyncConfigured: shopSync?.configured ?? null,
};

bericht.sections = [
  {
    id: 'executive',
    title: 'Kurzfassung',
    paragraphs: [
      `Stand ${new Date(at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })} (Europe/Berlin): Gesamtstatus **${snapshot.overall.toUpperCase()}**.`,
      reservation?.ok
        ? `Reservierungs-API aktiv (Rate-Limit **${reservation.rateLimit}**). Freie Einheiten gesamt: **${reservation.totalAvail}**.`
        : 'Reservierungs-API nicht erreichbar oder fehlerhaft.',
      shopSync?.ok && shopSync.configured
        ? 'Shop-Sync ist konfiguriert (Shopify Storefront → Postgres).'
        : 'Shop-Sync prüfen (Secrets / Health).',
    ],
  },
  {
    id: 'ingress',
    title: 'Eingangsverhalten (Supabase Edge)',
    paragraphs: [
      'Browser-Traffic von GitHub Pages trifft auf die Edge Function **reservation-api** (CORS nur für 1337wheels-design.github.io).',
      'Stufe-1-Limits zählen pro **IP** und **sessionId** in `deck_rate_limit_buckets` (Postgres). Typische Live-Last: GET `/v1/availability` alle 75 s pro Tab.',
      'Drop-Tests von **einer IP** ohne Limit-Abschaltung stoßen schnell an **sync-burst** (8/10 s) und **40 sync/min/IP** — im Dashboard SQL Editor siehe `supabase/sql/ingress-dashboard.sql`.',
    ],
  },
  {
    id: 'drop-test',
    title: 'Letzte Drop-Simulation (Referenz)',
    paragraphs: [
      'Szenario **empty**: 25 parallele Syncs, ~49 Einheiten auf `drop-user-*` Sessions — danach gestaffeltes Release über 60 s.',
      'Rate-Limit-Secret wurde danach **unset**; Produktion wieder **stufe1** (429 ab ~81 Availability-Requests/Session/Minute).',
    ],
    bullets: [
      '25×200 beim Drop (Limit kurz aus)',
      '0 aktive drop-Holds nach Cleanup/Release',
      '~93 Rate-Limit-Buckets nach Testphase (inspect db table-stats)',
    ],
  },
  {
    id: 'actions',
    title: 'Empfohlene Checks am Event-Tag',
    bullets: [
      'Supabase → Edge Functions → reservation-api → Logs (429 vs 409 vs 5xx)',
      'SQL Editor: Top-Buckets + aktive Holds (ingress-dashboard.sql)',
      'CLI: npm run ops:status / npm run test:go-live',
      'Cron shop-sync alle 3–5 min (POST + DECK_SYNC_CRON_SECRET)',
    ],
  },
];

writeFileSync(berichtPath, JSON.stringify(bericht, null, 2));
console.log('Wrote', join(REPORT_DIR, 'snapshot.json'));
console.log('Updated', berichtPath);
console.log('Overall:', snapshot.overall, '| totalAvail:', reservation?.totalAvail);
