#!/usr/bin/env node
/**
 * Unit + HTTP tests for 5-minute deck reservations.
 */
import { DeckReservationStore } from './deck-reservation-store.mjs';
import { server, store } from './deck-reservation-server.mjs';

let testPort = Number(process.env.PAYDAY_RESERVE_TEST_PORT || 0);

const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}: ${detail}`);
}

async function jsonFetch(path, opts = {}) {
  const res = await fetch(`http://127.0.0.1:${testPort}${path}`, opts);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// --- Unit: competing sessions ---
{
  const s = new DeckReservationStore({ 'neon-850': 1 }, 5000);
  const a = s.syncSession('session-a', [{ skuId: 'neon-850', qty: 1 }]);
  record('U1_session_a_holds', a.ok, JSON.stringify(a));
  const b = s.syncSession('session-b', [{ skuId: 'neon-850', qty: 1 }]);
  record('U2_session_b_blocked', !b.ok && b.reason === 'insufficient', JSON.stringify(b));
  record('U3_avail_zero', s.getAvailability('x')['neon-850'] === 0, String(s.getAvailability('x')['neon-850']));
  s.clearSession('session-a');
  record('U4_after_release', s.getAvailability('x')['neon-850'] === 1, String(s.getAvailability('x')['neon-850']));
}

// --- Unit: TTL expiry ---
{
  const s = new DeckReservationStore({ 'chrome-838': 2 }, 80);
  s.syncSession('ttl-user', [{ skuId: 'chrome-838', qty: 2 }], 1000);
  record('U5_ttl_held', s.getAvailability('x', 1050)['chrome-838'] === 0, 'held before expiry');
  record('U6_ttl_freed', s.getAvailability('x', 1200)['chrome-838'] === 2, 'freed after 80ms TTL');
}

await new Promise((resolve, reject) => {
  server.listen(testPort || 0, '127.0.0.1', (err) => {
    if (err) reject(err);
    else {
      testPort = server.address().port;
      resolve();
    }
  });
});

try {
  store.setBaseStock({ 'neon-850': 2, 'chrome-838': 1 });
  store.clearSession('session-a');
  store.clearSession('session-b');
  store.clearSession('ttl-user');
  store.clearSession('http-a');
  store.clearSession('http-b');

  const health = await jsonFetch('/health');
  record('H1_health', health.body.ok === true, String(health.status));

  let r = await jsonFetch('/v1/cart/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'http-a',
      lines: [{ skuId: 'neon-850', qty: 2 }],
    }),
  });
  record('H2_sync_ok', r.status === 200 && r.body.ok, JSON.stringify(r.body));

  r = await jsonFetch('/v1/cart/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'http-b',
      lines: [{ skuId: 'neon-850', qty: 1 }],
    }),
  });
  record('H3_compete_fail', r.status === 409 && r.body.reason === 'insufficient', JSON.stringify(r.body));

  r = await jsonFetch('/v1/cart/release', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'http-a' }),
  });
  record('H4_release', r.body.ok && r.body.availability['neon-850'] === 2, JSON.stringify(r.body.availability));

  r = await jsonFetch('/v1/cart/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'http-b',
      lines: [{ skuId: 'neon-850', qty: 1 }],
    }),
  });
  record('H5_b_after_release', r.status === 200 && r.body.ok, JSON.stringify(r.body));

  r = await jsonFetch('/v1/availability?sessionId=http-b');
  record('H6_availability', r.body.availability['neon-850'] === 1, JSON.stringify(r.body.availability));
} finally {
  server.close();
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error('\n' + failed.length + ' test(s) failed');
  process.exit(1);
}
console.log('\nAll ' + results.length + ' reservation tests passed.');
