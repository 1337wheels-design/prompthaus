/**
 * Shopify Storefront → deck_base_stock. Aufruf per Cron + Bearer DECK_SYNC_CRON_SECRET.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const API_VERSION = '2024-10';

function routePath(pathname: string): string {
  if (pathname.endsWith('/health')) return '/health';
  return '/sync';
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
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
    });
  }

  const denied = authorize(req);
  if (denied) return denied;

  if (req.method !== 'POST' && req.method !== 'GET') {
    return json(405, { ok: false, reason: 'method_not_allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const domain = Deno.env.get('SHOPIFY_SHOP_DOMAIN');
  const token = Deno.env.get('SHOPIFY_STOREFRONT_TOKEN');
  const mapRaw = Deno.env.get('DECK_SKU_HANDLE_MAP_JSON');

  if (!supabaseUrl || !serviceKey) {
    return json(500, { ok: false, reason: 'misconfigured_supabase' });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: runRow, error: runErr } = await supabase
    .from('deck_sync_runs')
    .insert({ kind: 'shopify_storefront', status: 'running', meta: { domain } })
    .select('id')
    .single();
  if (runErr) {
    return json(500, { ok: false, reason: runErr.message });
  }
  const runId = runRow.id as string;

  try {
    if (!domain || !token || !mapRaw) {
      throw new Error('SHOPIFY_SHOP_DOMAIN, SHOPIFY_STOREFRONT_TOKEN, DECK_SKU_HANDLE_MAP_JSON required');
    }
    const handleMap = JSON.parse(mapRaw) as Record<string, string>;
    const snapshot: Record<string, number> = {};
    const skipped: string[] = [];

    for (const [skuId, handle] of Object.entries(handleMap)) {
      const query = `query Q($h: String!) {
        product(handle: $h) {
          variants(first: 1) { nodes { quantityAvailable } }
        }
      }`;
      const res = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': token,
        },
        body: JSON.stringify({ query, variables: { h: handle } }),
      });
      const jsonBody = await res.json();
      const qty = jsonBody?.data?.product?.variants?.nodes?.[0]?.quantityAvailable;
      if (typeof qty === 'number') snapshot[skuId] = qty;
      else skipped.push(skuId);
    }

    const { data: applied, error: applyErr } = await supabase.rpc('deck_apply_stock_snapshot', {
      p_snapshot: snapshot,
    });
    if (applyErr) throw applyErr;

    await supabase
      .from('deck_sync_runs')
      .update({
        status: 'ok',
        finished_at: new Date().toISOString(),
        meta: { domain, applied, skuCount: Object.keys(snapshot).length, skipped },
      })
      .eq('id', runId);

    return json(200, {
      ok: true,
      applied,
      syncedSkus: Object.keys(snapshot).length,
      skipped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('deck_sync_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        meta: { error: message },
      })
      .eq('id', runId);
    return json(500, { ok: false, reason: message });
  }
});
