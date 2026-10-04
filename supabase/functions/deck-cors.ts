/** CORS für Deck Shop (GitHub Pages, Vercel, lokal). */
const PREFIX_ORIGINS = [
  'https://1337wheels-design.github.io',
  'https://payday.vercel.app',
  'http://localhost',
  'http://127.0.0.1',
];

/** Vercel Production + Preview Deployments (*.vercel.app). */
const VERCEL_ORIGIN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

function extraAllowedOrigins(): string[] {
  const raw = Deno.env.get('DECK_SHOP_ALLOWED_ORIGINS');
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowedDeckOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PREFIX_ORIGINS.some((p) => origin === p || origin.startsWith(p))) return true;
  if (extraAllowedOrigins().some((o) => origin === o || origin.startsWith(o))) return true;
  return VERCEL_ORIGIN.test(origin);
}

export function corsHeaders(origin: string | null): HeadersInit {
  const allow = isAllowedDeckOrigin(origin);
  return {
    'Access-Control-Allow-Origin': allow && origin ? origin : PREFIX_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Max-Age': '86400',
  };
}
