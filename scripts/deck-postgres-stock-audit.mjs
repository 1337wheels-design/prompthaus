#!/usr/bin/env node
/** Liest deck_base_stock + availability über die öffentliche reservation-api (kein DB-Passwort). */
const API =
  process.env.RESERVATION_API_URL ||
  'https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/reservation-api';
const ORIGIN =
  process.env.DECK_SHOP_ORIGIN || 'https://1337wheels-design-payday.vercel.app';

const res = await fetch(
  `${API.replace(/\/$/, '')}/v1/availability?sessionId=stock-audit-${Date.now()}`,
  { headers: { Origin: ORIGIN } }
);
const data = await res.json();
if (!data.ok) {
  console.error('API error', res.status, data);
  process.exit(1);
}

const base = data.baseStock || {};
const avail = data.availability || {};
const skus = [...new Set([...Object.keys(base), ...Object.keys(avail)])].sort();

console.log('Postgres (via reservation-api)\n');
console.log('sku_id\tbaseStock\tavailability');
let sumB = 0;
let sumA = 0;
for (const sku of skus) {
  const b = Number(base[sku]) || 0;
  const a = Number(avail[sku]) || 0;
  sumB += b;
  sumA += a;
  console.log(`${sku}\t${b}\t${a}`);
}
console.log('---');
console.log(`SUM baseStock=${sumB}  availability=${sumA}`);
process.exit(sumA === 0 && sumB === 0 ? 0 : 1);
