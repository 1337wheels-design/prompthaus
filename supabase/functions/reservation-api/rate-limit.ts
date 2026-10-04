import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type RateLimitRule = {
  bucket: string;
  windowSeconds: number;
  maxHits: number;
};

export function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf?.trim()) return cf.trim().slice(0, 64);
  const xf = req.headers.get('x-forwarded-for');
  if (xf?.trim()) {
    const parts = xf
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) {
      // Hinter Supabase Edge wechselt oft nur der erste Hop — Original-Client eher am Ende
      return parts[parts.length - 1].slice(0, 64);
    }
  }
  const real = req.headers.get('x-real-ip');
  if (real?.trim()) return real.trim().slice(0, 64);
  return 'unknown';
}

export function sanitizeSessionId(raw: string): string | null {
  const id = String(raw ?? '').trim();
  if (!id || id.length > 128) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) return null;
  return id;
}

function limitsDisabled(): boolean {
  const v = Deno.env.get('DECK_RATE_LIMIT_DISABLED');
  return v === '1' || v === 'true';
}

export async function enforceRateLimits(
  supabase: SupabaseClient,
  rules: RateLimitRule[]
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  if (limitsDisabled() || rules.length === 0) return { ok: true };

  for (const rule of rules) {
    const { data, error } = await supabase.rpc('deck_rate_limit_check', {
      p_bucket_key: rule.bucket,
      p_window_seconds: rule.windowSeconds,
      p_max_hits: rule.maxHits,
    });
    if (error) {
      console.error('[rate-limit]', error.message);
      return { ok: false, retryAfterSeconds: 60 };
    }
    const allowed = Boolean((data as Record<string, unknown>)?.allowed);
    if (!allowed) {
      const retry = Number((data as Record<string, unknown>)?.retry_after_seconds) || 60;
      return { ok: false, retryAfterSeconds: retry };
    }
  }
  return { ok: true };
}

/** Stufe 1 — siehe supabase/BOT-PROTECTION.md */
export function rulesForPath(
  path: string,
  ip: string,
  sessionId: string | null
): RateLimitRule[] {
  const ipKey = `ip:${ip}:${path}`;
  const rules: RateLimitRule[] = [];

  if (path === '/v1/availability') {
    rules.push({ bucket: ipKey, windowSeconds: 60, maxHits: 120 });
    if (sessionId) {
      rules.push({
        bucket: `sess:${sessionId}:/v1/availability`,
        windowSeconds: 60,
        maxHits: 80,
      });
    }
    return rules;
  }

  if (path === '/v1/cart/sync') {
    rules.push({ bucket: ipKey, windowSeconds: 60, maxHits: 40 });
    rules.push({ bucket: `ip:${ip}:sync-burst`, windowSeconds: 10, maxHits: 8 });
    if (sessionId) {
      rules.push({ bucket: `sess:${sessionId}:/v1/cart/sync`, windowSeconds: 60, maxHits: 25 });
      rules.push({ bucket: `sess:${sessionId}:sync-burst`, windowSeconds: 10, maxHits: 5 });
    }
    return rules;
  }

  if (path === '/v1/cart/heartbeat') {
    rules.push({ bucket: ipKey, windowSeconds: 60, maxHits: 90 });
    if (sessionId) {
      rules.push({ bucket: `sess:${sessionId}:/v1/cart/heartbeat`, windowSeconds: 60, maxHits: 60 });
    }
    return rules;
  }

  if (path === '/v1/cart/release') {
    rules.push({ bucket: ipKey, windowSeconds: 60, maxHits: 60 });
    return rules;
  }

  return rules;
}
