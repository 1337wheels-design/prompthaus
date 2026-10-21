-- Recover zeroed base stock (bad shop-sync) + include baseStock in cart RPC responses

CREATE OR REPLACE FUNCTION deck_base_stock_json()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(sku_id, quantity), '{}'::jsonb)
  FROM deck_base_stock;
$$;

CREATE OR REPLACE FUNCTION deck_reseed_zero_base_stock()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  UPDATE deck_base_stock AS b
  SET quantity = s.qty, updated_at = now()
  FROM (
    VALUES
      ('chrome-838', 5), ('chrome-850', 5),
      ('neon-838', 4), ('neon-850', 4),
      ('payday-linear-838', 4), ('payday-linear-850', 4),
      ('arctic-838', 4), ('arctic-850', 4),
      ('night-838', 4), ('night-850', 4),
      ('payday-camo-838', 4), ('payday-camo-850', 4)
  ) AS s(sku_id, qty)
  WHERE b.sku_id = s.sku_id AND b.quantity = 0;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'updated', v_updated,
    'availability', deck_availability(),
    'baseStock', deck_base_stock_json()
  );
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
        'requested', line.qty,
        'availability', deck_availability(),
        'baseStock', deck_base_stock_json()
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
    'availability', v_avail,
    'baseStock', deck_base_stock_json()
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
  RETURN jsonb_build_object(
    'ok', true,
    'availability', deck_availability(),
    'baseStock', deck_base_stock_json()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION deck_base_stock_json() TO service_role;
GRANT EXECUTE ON FUNCTION deck_reseed_zero_base_stock() TO service_role;

-- One-time recovery after erroneous all-zero sync
SELECT deck_reseed_zero_base_stock();
