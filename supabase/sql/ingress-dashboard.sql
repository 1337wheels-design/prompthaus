-- Deck Shop — Eingangs-/Ops-Auswertung (Supabase Dashboard → SQL Editor)
-- Projekt: yoeehrdsrfwolzdtgmel · reservation-api Edge Function

-- 1) Rate-Limit-Buckets (Bot-Schutz Stufe 1) — „wer drückt gerade?“
SELECT
  bucket_key,
  hit_count,
  window_start,
  now() - window_start AS window_age
FROM deck_rate_limit_buckets
ORDER BY hit_count DESC, window_start DESC
LIMIT 50;

-- 2) Buckets nach Route (IP / Session)
SELECT
  CASE
    WHEN bucket_key LIKE 'ip:%:/v1/cart/sync' THEN 'sync_ip'
    WHEN bucket_key LIKE 'ip:%:sync-burst' THEN 'sync_burst'
    WHEN bucket_key LIKE 'ip:%:/v1/availability' THEN 'availability_ip'
    WHEN bucket_key LIKE 'ip:%:/v1/cart/release' THEN 'release_ip'
    WHEN bucket_key LIKE 'sess:%' THEN 'session'
    ELSE 'other'
  END AS bucket_kind,
  COUNT(*) AS buckets,
  SUM(hit_count) AS total_hits,
  MAX(hit_count) AS max_hits_in_window
FROM deck_rate_limit_buckets
GROUP BY 1
ORDER BY total_hits DESC;

-- 3) Aktive Holds (Reservierungen = „Warenkörbe“)
SELECT
  session_id,
  sku_id,
  quantity,
  expires_at,
  expires_at - now() AS ttl_remaining
FROM deck_reservation_holds
WHERE expires_at > now()
ORDER BY expires_at, session_id, sku_id;

SELECT COUNT(*) AS active_hold_rows,
       COALESCE(SUM(quantity), 0) AS units_held
FROM deck_reservation_holds
WHERE expires_at > now();

-- 4) Bestand vs. Shopify-Snapshot
SELECT
  b.sku_id,
  b.quantity AS base_stock,
  COALESCE(s.shopify_quantity, -1) AS shopify_snapshot,
  b.quantity - COALESCE((
    SELECT SUM(h.quantity)
    FROM deck_reservation_holds h
    WHERE h.sku_id = b.sku_id AND h.expires_at > now()
  ), 0) AS approx_available
FROM deck_base_stock b
LEFT JOIN deck_shopify_stock_snapshot s ON s.sku_id = b.sku_id
ORDER BY b.sku_id;

-- 5) Letzte Shop-Sync-Läufe
SELECT id, kind, status, started_at, finished_at, meta
FROM deck_sync_runs
ORDER BY started_at DESC
LIMIT 15;

-- 6) Alte Rate-Limit-Buckets aufräumen (optional, manuell)
-- SELECT deck_purge_rate_limit_buckets(86400);
