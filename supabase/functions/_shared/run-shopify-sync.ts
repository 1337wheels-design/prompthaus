import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const API_VERSION = '2024-10';

export async function runShopifyStorefrontSync(
  supabase: SupabaseClient,
  domain: string,
  token: string,
  mapRaw: string
): Promise<{ ok: true; applied: unknown; syncedSkus: number; skipped: string[] }> {
  const handleMap = JSON.parse(mapRaw) as Record<string, string>;
  const snapshot: Record<string, number> = {};
  const skipped: string[] = [];

  for (const [skuId, handle] of Object.entries(handleMap)) {
    const query = `query Q($h: String!) {
      product(handle: $h) {
        availableForSale
        variants(first: 1) {
          nodes { availableForSale quantityAvailable }
        }
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
    const product = jsonBody?.data?.product;
    const variant = product?.variants?.nodes?.[0];
    if (!product || !variant) {
      skipped.push(skuId);
      continue;
    }
    if (!product.availableForSale || !variant.availableForSale) {
      snapshot[skuId] = 0;
      continue;
    }
    const rawQty = variant.quantityAvailable;
    if (typeof rawQty === 'number' && rawQty >= 0) {
      snapshot[skuId] = rawQty;
      continue;
    }
    skipped.push(skuId);
  }

  const { data: applied, error: applyErr } = await supabase.rpc('deck_apply_stock_snapshot', {
    p_snapshot: snapshot,
  });
  if (applyErr) throw applyErr;

  return {
    ok: true,
    applied,
    syncedSkus: Object.keys(snapshot).length,
    skipped,
  };
}
