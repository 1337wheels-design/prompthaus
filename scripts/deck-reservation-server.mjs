#!/usr/bin/env node
/**
 * Payday Deck Shop — Reservierungs-HTTP-API
 * Backend: Supabase (Option B) wenn SUPABASE_* gesetzt, sonst In-Memory (lokal).
 */
import http from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DeckReservationStore, DEFAULT_TTL_MS } from './deck-reservation-store.mjs';
import { createSupabaseReservationBackend } from './deck-reservation-supabase.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stockPath = join(__dirname, '../deck-shop/reservation-base-stock.json');
const baseStock = JSON.parse(readFileSync(stockPath, 'utf8'));

const PORT = Number(process.env.PAYDAY_RESERVE_PORT || process.argv[2] || 8791);
const ALLOWED_ORIGIN_PREFIXES = [
  'https://1337wheels-design.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

function useSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const memoryStore = new DeckReservationStore(baseStock, DEFAULT_TTL_MS);
let supabaseBackend = null;
if (useSupabase()) {
  supabaseBackend = createSupabaseReservationBackend();
}

function backendKind() {
  return supabaseBackend ? 'supabase' : 'memory';
}

async function getAvailability(sessionId) {
  if (supabaseBackend) return supabaseBackend.getAvailability(sessionId);
  return memoryStore.getAvailability(sessionId);
}

async function syncSession(sessionId, lines) {
  if (supabaseBackend) return supabaseBackend.syncSession(sessionId, lines);
  return memoryStore.syncSession(sessionId, lines);
}

async function clearSession(sessionId) {
  if (supabaseBackend) {
    const data = await supabaseBackend.clearSession(sessionId);
    return data?.availability ?? {};
  }
  memoryStore.clearSession(sessionId);
  return memoryStore.getAvailability(sessionId);
}

async function heartbeat(sessionId, lines) {
  if (supabaseBackend) return supabaseBackend.heartbeat(sessionId, lines);
  const sync = memoryStore.syncSession(sessionId, lines);
  if (!sync.ok) return sync;
  memoryStore.touchSession(sessionId);
  return {
    ok: true,
    ttlMs: DEFAULT_TTL_MS,
    expiresAt: Date.now() + DEFAULT_TTL_MS,
    availability: memoryStore.getAvailability(sessionId),
  };
}

function corsHeaders(origin) {
  const allow =
    origin && ALLOWED_ORIGIN_PREFIXES.some((p) => origin === p || origin.startsWith(p));
  return {
    'Access-Control-Allow-Origin': allow ? origin : ALLOWED_ORIGIN_PREFIXES[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function sendJson(res, status, body, origin) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(origin),
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const ttlMs = supabaseBackend?.ttlMs ?? DEFAULT_TTL_MS;

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, backend: backendKind(), ttlMs }, origin);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/v1/availability') {
      const sessionId = url.searchParams.get('sessionId') || '';
      sendJson(
        res,
        200,
        { ok: true, ttlMs, availability: await getAvailability(sessionId) },
        origin
      );
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/cart/sync') {
      const body = await readJson(req);
      const sessionId = String(body.sessionId || '');
      const lines = Array.isArray(body.lines) ? body.lines : [];
      const result = await syncSession(sessionId, lines);
      sendJson(res, result.ok ? 200 : 409, result, origin);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/cart/release') {
      const body = await readJson(req);
      const sessionId = String(body.sessionId || '');
      const availability = await clearSession(sessionId);
      sendJson(res, 200, { ok: true, availability }, origin);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/cart/heartbeat') {
      const body = await readJson(req);
      const sessionId = String(body.sessionId || '');
      const lines = Array.isArray(body.lines) ? body.lines : [];
      const result = await heartbeat(sessionId, lines);
      sendJson(res, result.ok ? 200 : 409, result, origin);
      return;
    }

    sendJson(res, 404, { ok: false, reason: 'not_found' }, origin);
  } catch (err) {
    sendJson(res, 500, { ok: false, reason: 'server_error', detail: String(err.message) }, origin);
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const startupTtlMs = supabaseBackend?.ttlMs ?? DEFAULT_TTL_MS;
  server.listen(PORT, () => {
    console.log(
      `[deck-reservation] http://127.0.0.1:${PORT} backend=${backendKind()} ttl=${startupTtlMs / 1000}s`
    );
  });
}

export { server, memoryStore as store, PORT };
