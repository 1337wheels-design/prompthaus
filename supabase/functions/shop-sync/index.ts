/**
 * Shopify Storefront → deck_base_stock.
 * - Cron: POST mit Bearer DECK_SYNC_CRON_SECRET (alle 3 Min)
 * - Cron: POST …/v1/run-due (alle 1 Min) — checkout-verzögerter Sync
 * - Browser: POST …/v1/schedule (CORS, kein Secret) — Sync ~60 s nach Checkout-Klick
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { corsHeaders, isAllowedDeckOrigin } from '../deck-cors.ts';
import { runShopifyStorefrontSync } from '../_shared/run-shopify-sync.ts';

function routePath(pathname: string): string {
  if (pathname.endsWith('/health')) return '/health';
  if (pathname.endsWith('/v1/schedule')) return '/v1/schedule';
  if (pathname.endsWith('/v1/run-due')) return '/v1/run-due';
  return '/sync';
}

function json(status: number, body: unknown, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin),
    },
  });
}

function authorize(req: Request): Response | null {
  const cronSecret = Deno.env.get('DECK_SYNC_CRON_SECRET');
  const auth = req.headers.get('Authorization') ?? '';
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return json(401, { ok: false, reason: 'unauthorized' });
  }
  return null;
}

async function executeSync(
  supabase: ReturnType<typeof createClient>,
  domain: string,
  token: string,
  mapRaw: string,
  kind: string,
  metaExtra: Record<string, unknown> = {}
) {
  const { data: runRow, error: runErr } = await supabase
    .from('deck_sync_runs')
    .insert({ kind, status: 'running', meta: { domain, ...metaExtra } })
    .select('id')
    .single();
  if (runErr) throw runErr;
  const runId = runRow.id as string;

  try {
    const result = await runShopifyStorefrontSync(supabase, domain, token, mapRaw);
    await supabase
      .from('deck_sync_runs')
      .update({
        status: 'ok',
        finished_at: new Date().toISOString(),
        meta: { domain, applied: result.applied, skuCount: result.syncedSkus, skipped: result.skipped, ...metaExtra },
      })
      .eq('id', runId);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('deck_sync_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        meta: { error: message, ...metaExtra },
      })
      .eq('id', runId);
    throw err;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const url = new URL(req.url);
  const path = routePath(url.pathname);

  if (req.method === 'GET' && path === '/health') {
    const domain = Deno.env.get('SHOPIFY_SHOP_DOMAIN');
    const token = Deno.env.get('SHOPIFY_STOREFRONT_TOKEN');
    const mapRaw = Deno.env.get('DECK_SKU_HANDLE_MAP_JSON');
    let mapKeys = 0;
    try {
      if (mapRaw) mapKeys = Object.keys(JSON.parse(mapRaw)).length;
    } catch {
      mapKeys = -1;
    }
    return json(200, {
      ok: true,
      function: 'shop-sync',
      configured: Boolean(domain && token && mapRaw && mapKeys > 0),
      checks: {
        shopDomain: Boolean(domain),
        storefrontToken: Boolean(token),
        skuMap: mapKeys > 0,
        skuMapInvalid: mapKeys === -1,
        cronSecret: Boolean(Deno.env.get('DECK_SYNC_CRON_SECRET')),
      },
      skuCount: mapKeys > 0 ? mapKeys : 0,
      routes: {
        sync: 'POST (Bearer)',
        runDue: 'POST …/v1/run-due (Bearer, cron */1)',
        schedule: 'POST …/v1/schedule (CORS, checkout +60s)',
      },
    }, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json(500, { ok: false, reason: 'misconfigured_supabase' });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (path === '/v1/schedule') {
    if (req.method !== 'POST') {
      return json(405, { ok: false, reason: 'method_not_allowed' }, origin);
    }
    if (!isAllowedDeckOrigin(origin)) {
      return json(403, { ok: false, reason: 'origin_not_allowed' }, origin);
    }

    let delaySeconds = 60;
    try {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.delaySeconds === 'number' && Number.isFinite(body.delaySeconds)) {
        delaySeconds = Math.min(600, Math.max(5, Math.floor(body.delaySeconds)));
      }
    } catch {
      /* default 60 */
    }

    const { data, error } = await supabase.rpc('deck_sync_schedule_deferred', {
      p_delay_seconds: delaySeconds,
    });
    if (error) {
      return json(500, { ok: false, reason: error.message }, origin);
    }
    return json(200, { ok: true, scheduled: data }, origin);
  }

  const denied = authorize(req);
  if (denied) return denied;

  if (req.method !== 'POST' && req.method !== 'GET') {
    return json(405, { ok: false, reason: 'method_not_allowed' });
  }

  const domain = Deno.env.get('SHOPIFY_SHOP_DOMAIN');
  const token = Deno.env.get('SHOPIFY_STOREFRONT_TOKEN');
  const mapRaw = Deno.env.get('DECK_SKU_HANDLE_MAP_JSON');

  if (path === '/v1/run-due') {
    try {
      const { data: dueRow, error: dueErr } = await supabase.rpc('deck_sync_take_due');
      if (dueErr) throw dueErr;
      const due = dueRow?.due === true;
      if (!due) {
        return json(200, { ok: true, ran: false, reason: 'nothing_due', detail: dueRow });
      }
      if (!domain || !token || !mapRaw) {
        throw new Error('SHOPIFY_SHOP_DOMAIN, SHOPIFY_STOREFRONT_TOKEN, DECK_SKU_HANDLE_MAP_JSON required');
      }
      const result = await executeSync(supabase, domain, token, mapRaw, 'shopify_storefront_deferred', {
        trigger: 'deferred',
      });
      return json(200, { ok: true, ran: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json(500, { ok: false, reason: message });
    }
  }

  try {
    if (!domain || !token || !mapRaw) {
      throw new Error('SHOPIFY_SHOP_DOMAIN, SHOPIFY_STOREFRONT_TOKEN, DECK_SKU_HANDLE_MAP_JSON required');
    }
    const result = await executeSync(supabase, domain, token, mapRaw, 'shopify_storefront', {
      trigger: 'cron',
    });
    return json(200, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(500, { ok: false, reason: message });
  }
});
