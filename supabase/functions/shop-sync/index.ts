/**
 * Shopify Storefront → deck_base_stock. Aufruf per Cron + Bearer DECK_SYNC_CRON_SECRET.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const API_VERSION = '2024-10';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  const cronSecret = Deno.env.get('DECK_SYNC_CRON_SECRET');
  const auth = req.headers.get('Authorization') ?? '';
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ ok: false, reason: 'unauthorized' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const domain = Deno.env.get('SHOPIFY_SHOP_DOMAIN');
  const token = Deno.env.get('SHOPIFY_STOREFRONT_TOKEN');
  const mapRaw = Deno.env.get('DECK_SKU_HANDLE_MAP_JSON');

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, reason: 'misconfigured' }), { status: 500 });
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
    return new Response(JSON.stringify({ ok: false, reason: runErr.message }), { status: 500 });
  }
  const runId = runRow.id as string;

  try {
    if (!domain || !token || !mapRaw) {
      throw new Error('SHOPIFY_SHOP_DOMAIN, SHOPIFY_STOREFRONT_TOKEN, DECK_SKU_HANDLE_MAP_JSON required');
    }
    const handleMap = JSON.parse(mapRaw) as Record<string, string>;
    const snapshot: Record<string, number> = {};

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
      const json = await res.json();
      const qty = json?.data?.product?.variants?.nodes?.[0]?.quantityAvailable;
      if (typeof qty === 'number') snapshot[skuId] = qty;
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
        meta: { domain, applied, skuCount: Object.keys(snapshot).length },
      })
      .eq('id', runId);

    return new Response(JSON.stringify({ ok: true, applied }), {
      headers: { 'Content-Type': 'application/json' },
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
    return new Response(JSON.stringify({ ok: false, reason: message }), { status: 500 });
  }
});
