#!/usr/bin/env node
/**
 * 25 Drop-Sim-Profile inkl. Warenkorb-Zuordnung (Szenario empty, round-robin).
 * Usage: node scripts/deck-drop-profiles-build.mjs [path/to/drop-sim-25-report.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT =
  process.argv[2] ||
  process.env.DROP_REPORT ||
  '/opt/cursor/artifacts/drop-sim-25-report.json';
const OUT = join(__dirname, '../deck-report/profiles.json');
const USER_COUNT = 25;

const SKU_LABEL = {
  'chrome-838': 'Chrome · 8.38″',
  'chrome-850': 'Chrome · 8.5″',
  'neon-838': 'Neon · 8.38″',
  'neon-850': 'Neon · 8.5″',
  'payday-linear-838': 'Linear · 8.38″',
  'payday-linear-850': 'Linear · 8.5″',
  'arctic-838': 'Arctic · 8.38″',
  'arctic-850': 'Arctic · 8.5″',
  'night-838': 'Night · 8.38″',
  'night-850': 'Night · 8.5″',
  'payday-camo-838': 'Camo · 8.38″',
  'payday-camo-850': 'Camo · 8.5″',
};

const DISPLAY_NAMES = [
  'Mira K.',
  'Jonas W.',
  'Selin A.',
  'Tim R.',
  'Lena H.',
  'Felix B.',
  'Zeynep Ö.',
  'Noah S.',
  'Emma L.',
  'Luca M.',
  'Aylin D.',
  'Ben P.',
  'Sofia T.',
  'Kaan Y.',
  'Hannah G.',
  'Elias N.',
  'Lea F.',
  'Moritz C.',
  'Jana V.',
  'Omar I.',
  'Nina Z.',
  'Paul J.',
  'Ruby E.',
  'Max U.',
  'Kim Q.',
];

function consolidateLines(skuIds) {
  const m = {};
  for (const skuId of skuIds) m[skuId] = (m[skuId] || 0) + 1;
  return Object.entries(m).map(([skuId, qty]) => ({
    skuId,
    qty,
    label: SKU_LABEL[skuId] || skuId,
  }));
}

function linesForEmptyShop(availability) {
  const slots = [];
  for (const [skuId, qty] of Object.entries(availability || {})) {
    for (let i = 0; i < Number(qty); i++) slots.push(skuId);
  }
  const perUser = Array.from({ length: USER_COUNT }, () => []);
  slots.forEach((skuId, i) => perUser[i % USER_COUNT].push(skuId));
  return perUser.map((skus) => consolidateLines(skus));
}

const report = JSON.parse(readFileSync(REPORT, 'utf8'));
const matrix = linesForEmptyShop(report.baseline);
const resultBySession = Object.fromEntries(
  (report.results || []).map((r) => [r.sessionId, r])
);

const profiles = matrix.map((cart, i) => {
  const sessionId = `drop-user-${String(i + 1).padStart(2, '0')}`;
  const sync = resultBySession[sessionId] || {};
  return {
    id: i + 1,
    sessionId,
    displayName: DISPLAY_NAMES[i] || `User ${i + 1}`,
    role: 'Drop-Simulation',
    cart,
    deckCount: cart.reduce((s, l) => s + l.qty, 0),
    sync: {
      status: sync.status ?? null,
      ok: sync.ok ?? null,
      latencyMs: sync.ms ?? null,
    },
  };
});

const payload = {
  generatedAt: new Date().toISOString(),
  scenario: report.scenario || 'empty',
  dropAt: report.at,
  distribution: 'round-robin über alle freien Einheiten (1 Sync-Wave)',
  note: 'Holds wurden danach per Release/TTL freigegeben — Zuordnung rekonstruiert aus Baseline + Algorithmus.',
  profiles,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log('Wrote', OUT, '| profiles:', profiles.length);
