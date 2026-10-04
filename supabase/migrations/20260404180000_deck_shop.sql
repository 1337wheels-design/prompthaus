-- Payday Deck Shop — Supabase (EU): Holds, Bestand, Sync-Metadaten

CREATE TABLE IF NOT EXISTS deck_base_stock (
  sku_id TEXT PRIMARY KEY,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deck_reservation_holds (
  session_id TEXT NOT NULL,
  sku_id TEXT NOT NULL REFERENCES deck_base_stock (sku_id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_deck_holds_sku_expires
  ON deck_reservation_holds (sku_id, expires_at);

CREATE TABLE IF NOT EXISTS deck_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_deck_sync_runs_kind_started
  ON deck_sync_runs (kind, started_at DESC);

CREATE TABLE IF NOT EXISTS deck_shopify_stock_snapshot (
  sku_id TEXT PRIMARY KEY REFERENCES deck_base_stock (sku_id) ON DELETE CASCADE,
  shopify_quantity INTEGER NOT NULL CHECK (shopify_quantity >= 0),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO deck_base_stock (sku_id, quantity) VALUES
  ('chrome-838', 5), ('chrome-850', 5),
  ('neon-838', 4), ('neon-850', 4),
  ('payday-linear-838', 4), ('payday-linear-850', 4),
  ('arctic-838', 4), ('arctic-850', 4),
  ('night-838', 4), ('night-850', 4),
  ('payday-camo-838', 4), ('payday-camo-850', 4)
ON CONFLICT (sku_id) DO NOTHING;

CREATE OR REPLACE FUNCTION deck_purge_expired_holds()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM deck_reservation_holds WHERE expires_at <= now();
$$;

CREATE OR REPLACE FUNCTION deck_availability()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM deck_purge_expired_holds();
  SELECT COALESCE(
    jsonb_object_agg(
      bs.sku_id,
      GREATEST(0, bs.quantity - COALESCE(h.held, 0))
    ),
    '{}'::jsonb
  )
  INTO result
  FROM deck_base_stock bs
  LEFT JOIN (
    SELECT sku_id, SUM(quantity)::integer AS held
    FROM deck_reservation_holds
    WHERE expires_at > now()
    GROUP BY sku_id
  ) h ON h.sku_id = bs.sku_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION deck_sync_cart(
  p_session_id text,
  p_lines jsonb,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line record;
  v_base integer;
  v_others integer;
  v_expires timestamptz;
  v_avail jsonb;
BEGIN
  IF p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 30 THEN
    p_ttl_seconds := 300;
  END IF;

  PERFORM deck_purge_expired_holds();
  DELETE FROM deck_reservation_holds WHERE session_id = p_session_id;

  FOR line IN
    SELECT
      (elem->>'skuId')::text AS sku_id,
      SUM(GREATEST(1, COALESCE((elem->>'qty')::integer, 1)))::integer AS qty
    FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) AS elem
    WHERE (elem->>'skuId') IS NOT NULL AND length(trim(elem->>'skuId')) > 0
    GROUP BY (elem->>'skuId')
  LOOP
    IF NOT EXISTS (SELECT 1 FROM deck_base_stock WHERE sku_id = line.sku_id) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unknown_sku', 'skuId', line.sku_id);
    END IF;

    SELECT quantity INTO v_base FROM deck_base_stock WHERE sku_id = line.sku_id;

    SELECT COALESCE(SUM(quantity), 0)::integer INTO v_others
    FROM deck_reservation_holds
    WHERE sku_id = line.sku_id
      AND expires_at > now()
      AND session_id <> p_session_id;

    IF v_others + line.qty > v_base THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'insufficient',
        'skuId', line.sku_id,
        'available', GREATEST(0, v_base - v_others),
        'requested', line.qty
      );
    END IF;
  END LOOP;

  v_expires := now() + make_interval(secs => p_ttl_seconds);

  FOR line IN
    SELECT
      (elem->>'skuId')::text AS sku_id,
      SUM(GREATEST(1, COALESCE((elem->>'qty')::integer, 1)))::integer AS qty
    FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) AS elem
    WHERE (elem->>'skuId') IS NOT NULL AND length(trim(elem->>'skuId')) > 0
    GROUP BY (elem->>'skuId')
  LOOP
    INSERT INTO deck_reservation_holds (session_id, sku_id, quantity, expires_at)
    VALUES (p_session_id, line.sku_id, line.qty, v_expires)
    ON CONFLICT (session_id, sku_id)
    DO UPDATE SET quantity = EXCLUDED.quantity, expires_at = EXCLUDED.expires_at;
  END LOOP;

  v_avail := deck_availability();

  RETURN jsonb_build_object(
    'ok', true,
    'ttlMs', p_ttl_seconds * 1000,
    'expiresAt', (floor(extract(epoch FROM v_expires) * 1000))::bigint,
    'availability', v_avail
  );
END;
$$;

CREATE OR REPLACE FUNCTION deck_release_session(p_session_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM deck_purge_expired_holds();
  DELETE FROM deck_reservation_holds WHERE session_id = p_session_id;
  RETURN jsonb_build_object('ok', true, 'availability', deck_availability());
END;
$$;

CREATE OR REPLACE FUNCTION deck_heartbeat_cart(
  p_session_id text,
  p_lines jsonb,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sync_result jsonb;
  v_expires timestamptz;
BEGIN
  sync_result := deck_sync_cart(p_session_id, p_lines, p_ttl_seconds);
  IF NOT COALESCE((sync_result->>'ok')::boolean, false) THEN
    RETURN sync_result;
  END IF;

  v_expires := now() + make_interval(secs => p_ttl_seconds);
  UPDATE deck_reservation_holds
  SET expires_at = v_expires
  WHERE session_id = p_session_id AND expires_at > now();

  RETURN jsonb_build_object(
    'ok', true,
    'ttlMs', p_ttl_seconds * 1000,
    'expiresAt', (floor(extract(epoch FROM v_expires) * 1000))::bigint,
    'availability', deck_availability()
  );
END;
$$;

CREATE OR REPLACE FUNCTION deck_apply_stock_snapshot(p_snapshot jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry record;
  applied integer := 0;
BEGIN
  FOR entry IN
    SELECT key AS sku_id, (value)::text::integer AS qty
    FROM jsonb_each(COALESCE(p_snapshot, '{}'::jsonb))
  LOOP
    IF NOT EXISTS (SELECT 1 FROM deck_base_stock WHERE sku_id = entry.sku_id) THEN
      CONTINUE;
    END IF;
    UPDATE deck_base_stock
    SET quantity = GREATEST(0, entry.qty), updated_at = now()
    WHERE sku_id = entry.sku_id;
    INSERT INTO deck_shopify_stock_snapshot (sku_id, shopify_quantity, fetched_at)
    VALUES (entry.sku_id, GREATEST(0, entry.qty), now())
    ON CONFLICT (sku_id)
    DO UPDATE SET shopify_quantity = EXCLUDED.shopify_quantity, fetched_at = now();
    applied := applied + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'applied', applied, 'availability', deck_availability());
END;
$$;

ALTER TABLE deck_base_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_reservation_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_shopify_stock_snapshot ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON deck_base_stock, deck_reservation_holds, deck_sync_runs, deck_shopify_stock_snapshot
  FROM anon, authenticated;

GRANT SELECT ON deck_base_stock TO service_role;
GRANT ALL ON deck_reservation_holds, deck_sync_runs, deck_shopify_stock_snapshot TO service_role;

GRANT EXECUTE ON FUNCTION deck_purge_expired_holds() TO service_role;
GRANT EXECUTE ON FUNCTION deck_availability() TO service_role;
GRANT EXECUTE ON FUNCTION deck_sync_cart(text, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION deck_release_session(text) TO service_role;
GRANT EXECUTE ON FUNCTION deck_heartbeat_cart(text, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION deck_apply_stock_snapshot(jsonb) TO service_role;
