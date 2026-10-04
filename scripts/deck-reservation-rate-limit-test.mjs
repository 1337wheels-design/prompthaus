#!/usr/bin/env node
/** Stufe-1 Rate-Limit Smoke (live reservation-api). */
const API =
  process.env.RESERVATION_API ||
  'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/reservation-api';

const headers = {
  'Content-Type': 'application/json',
  Origin: 'https://1337wheels-design.github.io',
};

async function getAvail(n) {
  const res = await fetch(`${API}/v1/availability?sessionId=rate-test-${n}`, { headers });
  return res.status;
}

async function syncBurst(sessionId, n) {
  const res = await fetch(`${API}/v1/cart/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId, lines: [] }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, reason: json.reason };
}

const health = await fetch(`${API}/health`, { headers }).then((r) => r.json());
console.log('health rateLimit:', health.rateLimit);

// Sequentiell aber ohne Pause — muss innerhalb 60 s Fenster bleiben (langsames curl spreadet über Fenstergrenze).
const floodSession = 'rate-flood-session-' + Date.now();
let got429 = false;
const t0 = performance.now();
for (let i = 0; i < 90; i++) {
  const res = await fetch(
    `${API}/v1/availability?sessionId=${encodeURIComponent(floodSession)}`,
    { headers }
  );
  if (res.status === 429) {
    got429 = true;
    console.log('PASS availability rate limit at request', i + 1, `(${(performance.now() - t0).toFixed(0)}ms)`);
    break;
  }
}
if (!got429) {
  console.error('FAIL expected 429 on availability flood within 60s window', {
    elapsedMs: Math.round(performance.now() - t0),
  });
  process.exit(1);
}
if (performance.now() - t0 > 55_000) {
  console.warn('WARN flood took >55s — test may be flaky on slow networks');
}

await new Promise((r) => setTimeout(r, 2000));

const sid = 'rate-limit-sync-' + Date.now();
for (let i = 0; i < 12; i++) {
  const r = await syncBurst(sid, i);
  if (r.status === 429 && r.reason === 'rate_limited') {
    console.log('PASS sync burst rate limit at attempt', i + 1);
    process.exit(0);
  }
}
console.error('FAIL expected sync burst 429');
process.exit(1);
