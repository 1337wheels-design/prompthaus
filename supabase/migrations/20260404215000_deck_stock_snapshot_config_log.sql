-- Base stock in availability API + Session-Konfigurationshistorie (15 + Top-Hits)

CREATE OR REPLACE FUNCTION deck_stock_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base jsonb;
  v_avail jsonb;
BEGIN
  PERFORM deck_purge_expired_holds();
  SELECT COALESCE(jsonb_object_agg(sku_id, quantity), '{}'::jsonb)
  INTO v_base
  FROM deck_base_stock;

  v_avail := deck_availability();

  RETURN jsonb_build_object(
    'availability', v_avail,
    'baseStock', v_base
  );
END;
$$;

CREATE TABLE IF NOT EXISTS deck_session_config_log (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('shop', 'editor')),
  config_key TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deck_session_config_log_session
  ON deck_session_config_log (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deck_session_config_log_key
  ON deck_session_config_log (config_key);

CREATE TABLE IF NOT EXISTS deck_config_key_hits (
  config_key TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  hit_count BIGINT NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sample_payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION deck_config_normalize_key(p_payload jsonb)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT md5(COALESCE(p_payload, '{}'::jsonb)::text);
$$;

CREATE OR REPLACE FUNCTION deck_config_record(
  p_session_id TEXT,
  p_source TEXT,
  p_label TEXT,
  p_payload JSONB
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_label TEXT;
BEGIN
  IF p_session_id IS NULL OR length(trim(p_session_id)) = 0 OR length(p_session_id) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;
  IF p_source IS NULL OR p_source NOT IN ('shop', 'editor') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_source');
  END IF;

  v_key := deck_config_normalize_key(COALESCE(p_payload, '{}'::jsonb));
  v_label := COALESCE(NULLIF(trim(p_label), ''), v_key);

  INSERT INTO deck_session_config_log (session_id, source, config_key, label, payload)
  VALUES (p_session_id, p_source, v_key, v_label, COALESCE(p_payload, '{}'::jsonb));

  INSERT INTO deck_config_key_hits (config_key, label, hit_count, last_seen_at, sample_payload)
  VALUES (v_key, v_label, 1, now(), COALESCE(p_payload, '{}'::jsonb))
  ON CONFLICT (config_key) DO UPDATE SET
    hit_count = deck_config_key_hits.hit_count + 1,
    last_seen_at = now(),
    label = EXCLUDED.label,
    sample_payload = EXCLUDED.sample_payload;

  DELETE FROM deck_session_config_log d
  WHERE d.session_id = p_session_id
    AND d.id NOT IN (
      SELECT id FROM deck_session_config_log
      WHERE session_id = p_session_id
      ORDER BY created_at DESC
      LIMIT 15
    );

  RETURN jsonb_build_object('ok', true, 'configKey', v_key);
END;
$$;

CREATE OR REPLACE FUNCTION deck_config_history(p_session_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent jsonb;
  v_top jsonb;
BEGIN
  IF p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'at', created_at,
        'source', source,
        'label', label,
        'configKey', config_key,
        'payload', payload
      )
      ORDER BY created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_recent
  FROM (
    SELECT * FROM deck_session_config_log
    WHERE session_id = p_session_id
    ORDER BY created_at DESC
    LIMIT 15
  ) sub;

  SELECT jsonb_build_object(
      'configKey', config_key,
      'label', label,
      'hitCount', hit_count,
      'lastSeenAt', last_seen_at,
      'payload', sample_payload
    )
  INTO v_top
  FROM deck_config_key_hits
  ORDER BY hit_count DESC, last_seen_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'sessionId', p_session_id,
    'recent', v_recent,
    'topGlobal', v_top
  );
END;
$$;

ALTER TABLE deck_session_config_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_config_key_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON deck_session_config_log, deck_config_key_hits FROM anon, authenticated;
GRANT ALL ON deck_session_config_log, deck_config_key_hits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE deck_session_config_log_id_seq TO service_role;

GRANT EXECUTE ON FUNCTION deck_stock_snapshot() TO service_role;
GRANT EXECUTE ON FUNCTION deck_config_record(TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION deck_config_history(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION deck_config_normalize_key(JSONB) TO service_role;
