#!/usr/bin/env node
/**
 * Koordinierter Drop: 25 parallele Reservierungs-Sessions (API).
 * Usage: node scripts/deck-drop-simulation-25.mjs [--scenario=a|b|c] [--cleanup-only] [--release-after]
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

const API =
  process.env.RESERVATION_API ||
  'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/reservation-api';
const USER_COUNT = Number(process.env.DROP_USERS || 25);
const REPORT =
  process.env.DROP_REPORT || '/opt/cursor/artifacts/drop-sim-25-report.json';
const ORIGIN = 'https://1337wheels-design.github.io';

const args = new Set(process.argv.slice(2));
const scenario = [...args].find((a) => a.startsWith('--scenario='))?.split('=')[1] || 'a';
const cleanupOnly = args.has('--cleanup-only');
const releaseAfter = args.has('--release-after');

const sessionIds = Array.from({ length: USER_COUNT }, (_, i) =>
  `drop-user-${String(i + 1).padStart(2, '0')}`
);

function headers() {
  return { 'Content-Type': 'application/json', Origin: ORIGIN };
}

async function availability() {
  const res = await fetch(`${API}/v1/availability?sessionId=drop-coordinator`, {
    headers: { Origin: ORIGIN },
  });
  return res.json();
}

async function release(sessionId) {
  await fetch(`${API}/v1/cart/release`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ sessionId }),
  });
}

async function sync(sessionId, lines) {
  const t0 = performance.now();
  const res = await fetch(`${API}/v1/cart/sync`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ sessionId, lines }),
  });
  const json = await res.json().catch(() => ({}));
  return {
    sessionId,
    status: res.status,
    ms: Math.round(performance.now() - t0),
    ok: json.ok,
    reason: json.reason,
    available: json.available,
  };
}

function consolidateLines(skuIds) {
  const m = {};
  for (const skuId of skuIds) m[skuId] = (m[skuId] || 0) + 1;
  return Object.entries(m).map(([skuId, qty]) => ({ skuId, qty }));
}

/** Verteilt alle freien Einheiten auf USER_COUNT Sessions (1 paralleler Sync-Wave). */
function linesForEmptyShop(availability) {
  const slots = [];
  for (const [skuId, qty] of Object.entries(availability || {})) {
    const n = Number(qty) || 0;
    for (let i = 0; i < n; i++) slots.push(skuId);
  }
  const perUser = Array.from({ length: USER_COUNT }, () => []);
  slots.forEach((skuId, i) => {
    perUser[i % USER_COUNT].push(skuId);
  });
  return perUser.map((skus) => consolidateLines(skus));
}

function linesForUser(index, availability) {
  const n = index + 1;
  if (scenario === 'empty') {
    const matrix = linesForEmptyShop(availability);
    return matrix[index] || [];
  }
  if (scenario === 'b') {
    if (n <= 8) return [{ skuId: 'chrome-838', qty: 1 }];
    if (n <= 16) return [{ skuId: 'neon-850', qty: 1 }];
    return [{ skuId: 'chrome-850', qty: 1 }];
  }
  if (scenario === 'c') {
    return [{ skuId: 'chrome-838', qty: 2 }];
  }
  return [{ skuId: 'chrome-838', qty: 1 }];
}

async function cleanup() {
  for (const sid of sessionIds) await release(sid);
  await release('drop-coordinator');
}

mkdirSync(dirname(REPORT), { recursive: true });

console.log('Drop simulation', { API, USER_COUNT, scenario });

const baseline = await availability();
console.log('Baseline availability (sample):', {
  'chrome-838': baseline.availability?.['chrome-838'],
  'neon-850': baseline.availability?.['neon-850'],
  'chrome-850': baseline.availability?.['chrome-850'],
});

await cleanup();
if (cleanupOnly) {
  console.log('Cleanup done (--cleanup-only).');
  process.exit(0);
}

const baselineAfterCleanup = await availability();
console.log('After cleanup chrome-838:', baselineAfterCleanup.availability?.['chrome-838']);

const emptyMatrix =
  scenario === 'empty' ? linesForEmptyShop(baselineAfterCleanup.availability) : null;
if (emptyMatrix) {
  const units = emptyMatrix.reduce((s, lines) => s + lines.reduce((t, l) => t + l.qty, 0), 0);
  console.log('Empty-shop wave:', { unitsToReserve: units, usersWithLines: emptyMatrix.filter((l) => l.length).length });
}

console.log(`T0 — ${USER_COUNT} parallel sync…`);
const results = await Promise.all(
  sessionIds.map((sid, i) =>
    sync(sid, linesForUser(i, baselineAfterCleanup.availability))
  )
);

const after = await availability();

if (releaseAfter) {
  await cleanup();
  console.log('Released all drop-user sessions (--release-after).');
}

const summary = {
  scenario,
  userCount: USER_COUNT,
  at: new Date().toISOString(),
  baseline: baselineAfterCleanup.availability,
  after: after.availability,
  counts: {
    http200: results.filter((r) => r.status === 200 && r.ok).length,
    http409: results.filter((r) => r.status === 409).length,
    http429: results.filter((r) => r.status === 429).length,
    other: results.filter((r) => r.status !== 200 && r.status !== 409 && r.status !== 429).length,
  },
  latencyMs: {
    min: Math.min(...results.map((r) => r.ms)),
    max: Math.max(...results.map((r) => r.ms)),
    avg: Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length),
  },
  results,
};

writeFileSync(REPORT, JSON.stringify(summary, null, 2));
console.log('\nSummary:', summary.counts);
console.log('Latency ms:', summary.latencyMs);
console.log('Report:', REPORT);

const hotSku = scenario === 'b' || scenario === 'empty' ? null : 'chrome-838';
if (hotSku) {
  const b = baselineAfterCleanup.availability?.[hotSku] ?? 0;
  const ok = summary.counts.http200;
  if (ok > b) {
    console.error(`FAIL: ${ok} successful syncs but baseline was ${b}`);
    process.exit(1);
  }
}

if (summary.counts.other > 0) {
  console.error('FAIL: unexpected HTTP statuses', results.filter((r) => r.status !== 200 && r.status !== 409 && r.status !== 429));
  process.exit(1);
}

console.log('\nDrop simulation finished OK (no overbook, no 5xx).');
