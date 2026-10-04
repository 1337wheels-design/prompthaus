#!/usr/bin/env node
/**
 * Smoke test gegen Supabase RPC (optional, braucht SUPABASE_URL + SERVICE_ROLE_KEY).
 */
import { createSupabaseReservationBackend } from './deck-reservation-supabase.mjs';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('SKIP deck-supabase-smoke-test (no SUPABASE_* env)');
  process.exit(0);
}

const backend = createSupabaseReservationBackend();
const sessionA = 'smoke-a-' + Date.now();
const sessionB = 'smoke-b-' + Date.now();

const r1 = await backend.syncSession(sessionA, [{ skuId: 'neon-850', qty: 1 }]);
if (!r1.ok) {
  console.error('FAIL sync A', r1);
  process.exit(1);
}

const r2 = await backend.syncSession(sessionB, [{ skuId: 'neon-850', qty: 1 }]);
if (r2.ok) {
  console.error('FAIL expected B blocked', r2);
  process.exit(1);
}

await backend.clearSession(sessionA);
const r3 = await backend.syncSession(sessionB, [{ skuId: 'neon-850', qty: 1 }]);
if (!r3.ok) {
  console.error('FAIL sync B after release', r3);
  process.exit(1);
}

await backend.clearSession(sessionB);
console.log('PASS deck-supabase-smoke-test');
