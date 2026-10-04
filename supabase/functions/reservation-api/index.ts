import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const DEFAULT_TTL_MS = 300_000;
const ALLOWED_ORIGINS = [
  'https://1337wheels-design.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

function corsHeaders(origin: string | null): HeadersInit {
  const allow =
    origin && ALLOWED_ORIGINS.some((p) => origin === p || origin.startsWith(p));
  return {
    'Access-Control-Allow-Origin': allow ? origin! : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

function routePath(pathname: string): string {
  const i = pathname.indexOf('/v1/');
  if (i >= 0) return pathname.slice(i);
  if (pathname.endsWith('/health')) return '/health';
  return pathname;
}

function ttlSeconds(): number {
  const raw = Deno.env.get('DECK_RESERVE_TTL_SECONDS');
  const n = raw ? Number(raw) : DEFAULT_TTL_MS / 1000;
  return Number.isFinite(n) && n >= 30 ? Math.floor(n) : DEFAULT_TTL_MS / 1000;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const url = new URL(req.url);
  const path = routePath(url.pathname);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, { ok: false, reason: 'misconfigured' }, origin);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ttlSec = ttlSeconds();

  try {
    if (req.method === 'GET' && path === '/health') {
      return jsonResponse(200, { ok: true, backend: 'supabase', ttlMs: ttlSec * 1000 }, origin);
    }

    if (req.method === 'GET' && path === '/v1/availability') {
      const { data, error } = await supabase.rpc('deck_availability');
      if (error) throw error;
      return jsonResponse(
        200,
        { ok: true, ttlMs: ttlSec * 1000, availability: data ?? {} },
        origin
      );
    }

    if (req.method === 'POST' && (path === '/v1/cart/sync' || path === '/v1/cart/heartbeat')) {
      const body = await req.json().catch(() => ({}));
      const sessionId = String(body.sessionId ?? '');
      const lines = Array.isArray(body.lines) ? body.lines : [];
      const rpc =
        path === '/v1/cart/heartbeat' ? 'deck_heartbeat_cart' : 'deck_sync_cart';
      const { data, error } = await supabase.rpc(rpc, {
        p_session_id: sessionId,
        p_lines: lines,
        p_ttl_seconds: ttlSec,
      });
      if (error) throw error;
      const result = data as Record<string, unknown>;
      const ok = Boolean(result?.ok);
      return jsonResponse(ok ? 200 : 409, result, origin);
    }

    if (req.method === 'POST' && path === '/v1/cart/release') {
      const body = await req.json().catch(() => ({}));
      const sessionId = String(body.sessionId ?? '');
      const { data, error } = await supabase.rpc('deck_release_session', {
        p_session_id: sessionId,
      });
      if (error) throw error;
      return jsonResponse(200, data, origin);
    }

    return jsonResponse(404, { ok: false, reason: 'not_found' }, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse(500, { ok: false, reason: 'server_error', detail: message }, origin);
  }
});
