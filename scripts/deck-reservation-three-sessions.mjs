#!/usr/bin/env node
/**
 * Verfügbarkeit bei 3 parallelen Sessions (live Supabase reservation-api).
 * Nutzt relative Erwartungen zur Baseline — orphan Holds anderer Browser-Sessions
 * (zufällige UUID in sessionStorage) reduzieren nur die Start-Baseline, nicht die Logik.
 */
const API =
  process.env.RESERVATION_API ||
  'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/reservation-api';

const sessions = ['tri-session-a', 'tri-session-b', 'tri-session-c'];

const KNOWN_SESSIONS = [
  ...sessions,
  'ghost',
  'http-a',
  'http-b',
  'session-a',
  'session-b',
  'probe',
];

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://1337wheels-design.github.io',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}

function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => {
    out[k] = obj?.[k];
  });
  return out;
}

const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}: ${detail}`);
}

async function releaseKnown() {
  for (const sid of KNOWN_SESSIONS) {
    await api('POST', '/v1/cart/release', { sessionId: sid });
  }
}

async function getAvail() {
  const r = await api('GET', '/v1/availability?sessionId=probe');
  return r.availability || {};
}

console.log('API:', API);

await releaseKnown();

let avail = await getAvail();
const b0Chrome = avail['chrome-838'];
const b0Neon = avail['neon-850'];

record(
  'baseline_read',
  typeof b0Chrome === 'number' && typeof b0Neon === 'number',
  JSON.stringify({ 'chrome-838': b0Chrome, 'neon-850': b0Neon, note: 'nach Release bekannter Test-Sessions' })
);

if (b0Chrome < 3) {
  record('enough_chrome_for_three_sessions', false, `chrome-838=${b0Chrome} (mind. 3 nötig)`);
  console.table(results.map((r) => ({ step: r.id, ok: r.ok, detail: String(r.detail).slice(0, 100) })));
  process.exit(1);
}

record(
  'enough_chrome_for_three_sessions',
  true,
  b0Chrome >= 5 ? 'volles Szenario (5 Stück frei)' : `reduziertes Szenario (${b0Chrome} frei, fremde Holds aktiv)`
);

/** @type {number} */
let chromeFree = b0Chrome;

// Session A: 2 Stück (oder weniger wenn Baseline klein)
const qA = Math.min(2, chromeFree);
const rA = await api('POST', '/v1/cart/sync', {
  sessionId: sessions[0],
  lines: [{ skuId: 'chrome-838', qty: qA }],
});
chromeFree -= qA;
record(
  'session_a_sync',
  rA.ok && rA.availability?.['chrome-838'] === chromeFree,
  `qty=${qA} status=${rA.status} global=${rA.availability?.['chrome-838']} erwartet=${chromeFree}`
);

avail = await getAvail();
record(
  'after_a_global',
  avail['chrome-838'] === chromeFree,
  JSON.stringify(pick(avail, ['chrome-838', 'neon-850']))
);

// Session B: zuerst 2 versuchen — muss scheitern wenn weniger als 2 frei
const rBfail = await api('POST', '/v1/cart/sync', {
  sessionId: sessions[1],
  lines: [{ skuId: 'chrome-838', qty: 2 }],
});
const expectBBlock = chromeFree < 2;
record(
  'session_b_overbook_if_needed',
  expectBBlock
    ? rBfail.status === 409 && rBfail.reason === 'insufficient'
    : rBfail.ok,
  expectBBlock
    ? JSON.stringify({ status: rBfail.status, reason: rBfail.reason, available: rBfail.available })
    : `unexpected ok bei ${chromeFree} frei`
);

const qB = Math.min(2, chromeFree);
const rB = await api('POST', '/v1/cart/sync', {
  sessionId: sessions[1],
  lines: [{ skuId: 'chrome-838', qty: qB }],
});
chromeFree -= qB;
record(
  'session_b_sync',
  rB.ok && rB.availability?.['chrome-838'] === chromeFree,
  `qty=${qB} status=${rB.status} global=${rB.availability?.['chrome-838']}`
);

avail = await getAvail();
record(
  'after_a_and_b',
  avail['chrome-838'] === chromeFree,
  JSON.stringify(pick(avail, ['chrome-838', 'neon-850']))
);

// Session C: 2 → blockiert wenn < 2 frei; dann letztes Stück
const rCfail = await api('POST', '/v1/cart/sync', {
  sessionId: sessions[2],
  lines: [{ skuId: 'chrome-838', qty: 2 }],
});
record(
  'session_c_overbook_blocked',
  chromeFree < 2
    ? rCfail.status === 409 && rCfail.reason === 'insufficient'
    : rCfail.ok === false,
  JSON.stringify({ status: rCfail.status, reason: rCfail.reason, available: rCfail.available })
);

if (chromeFree >= 1) {
  const rCok = await api('POST', '/v1/cart/sync', {
    sessionId: sessions[2],
    lines: [{ skuId: 'chrome-838', qty: 1 }],
  });
  chromeFree -= 1;
  record(
    'session_c_take_last_one',
    rCok.ok && rCok.availability?.['chrome-838'] === chromeFree,
    `status=${rCok.status} global=${rCok.availability?.['chrome-838']}`
  );
} else {
  const rCok = await api('POST', '/v1/cart/sync', {
    sessionId: sessions[2],
    lines: [{ skuId: 'chrome-838', qty: 1 }],
  });
  record(
    'session_c_take_last_one',
    rCok.status === 409,
    'kein Bestand mehr — 409 erwartet'
  );
}

avail = await getAvail();
record(
  'all_three_active_chrome_state',
  avail['chrome-838'] === chromeFree,
  JSON.stringify(pick(avail, ['chrome-838', 'neon-850']))
);

// B hält zusätzlich neon — nur wenn neon frei
if (b0Neon >= 1 && chromeFree === 0) {
  const heldBChrome = qB;
  const rBneon = await api('POST', '/v1/cart/sync', {
    sessionId: sessions[1],
    lines: [
      { skuId: 'chrome-838', qty: heldBChrome },
      { skuId: 'neon-850', qty: 1 },
    ],
  });
  record(
    'session_b_multi_sku',
    rBneon.ok,
    JSON.stringify(pick(rBneon.availability, ['chrome-838', 'neon-850']))
  );

  avail = await getAvail();
  record(
    'neon850_reduced_while_chrome_full',
    avail['neon-850'] === b0Neon - 1 && avail['chrome-838'] === 0,
    JSON.stringify(pick(avail, ['chrome-838', 'neon-850']))
  );
} else {
  record('session_b_multi_sku', true, 'übersprungen (chrome noch nicht voll oder kein neon)');
  record('neon850_reduced_while_chrome_full', true, 'übersprungen');
}

// Release A → chrome steigt um qA (B+C behalten)
await api('POST', '/v1/cart/release', { sessionId: sessions[0] });
chromeFree += qA;
avail = await getAvail();
record(
  'after_release_a_chrome_freed',
  avail['chrome-838'] === chromeFree,
  `chrome-838=${avail['chrome-838']} erwartet=${chromeFree} (B+C noch aktiv)`
);

await releaseKnown();
avail = await getAvail();
record(
  'cleanup_restored_to_baseline',
  avail['chrome-838'] === b0Chrome && avail['neon-850'] === b0Neon,
  JSON.stringify(pick(avail, ['chrome-838', 'neon-850']))
);

const failed = results.filter((r) => !r.ok);
console.log('\n--- Summary ---');
console.table(
  results.map((r) => ({ step: r.id, ok: r.ok, detail: String(r.detail).slice(0, 90) }))
);
if (failed.length) {
  console.error(failed.length, 'failed');
  process.exit(1);
}
console.log('\nAll', results.length, 'three-session availability checks passed.');
