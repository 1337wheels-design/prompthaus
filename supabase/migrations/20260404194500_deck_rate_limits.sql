-- Stufe-1 Bot-Schutz: feste Fenster-Rate-Limits (Edge Function reservation-api)

CREATE TABLE IF NOT EXISTS deck_rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  hit_count INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_deck_rate_limit_window
  ON deck_rate_limit_buckets (window_start);

CREATE OR REPLACE FUNCTION deck_rate_limit_check(
  p_bucket_key TEXT,
  p_window_seconds INTEGER,
  p_max_hits INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_elapsed NUMERIC;
  v_row deck_rate_limit_buckets%ROWTYPE;
  v_remaining INTEGER;
BEGIN
  IF p_bucket_key IS NULL OR length(p_bucket_key) = 0 OR p_max_hits <= 0 OR p_window_seconds <= 0 THEN
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_hits);
  END IF;

  SELECT * INTO v_row FROM deck_rate_limit_buckets WHERE bucket_key = p_bucket_key FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO deck_rate_limit_buckets (bucket_key, window_start, hit_count)
    VALUES (p_bucket_key, v_now, 1);
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_hits - 1);
  END IF;

  v_elapsed := EXTRACT(EPOCH FROM (v_now - v_row.window_start));
  IF v_elapsed >= p_window_seconds THEN
    UPDATE deck_rate_limit_buckets
    SET window_start = v_now, hit_count = 1
    WHERE bucket_key = p_bucket_key;
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_hits - 1);
  END IF;

  IF v_row.hit_count >= p_max_hits THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', GREATEST(1, CEIL(p_window_seconds - v_elapsed)::INTEGER)
    );
  END IF;

  UPDATE deck_rate_limit_buckets
  SET hit_count = hit_count + 1
  WHERE bucket_key = p_bucket_key;

  v_remaining := p_max_hits - v_row.hit_count - 1;
  RETURN jsonb_build_object('allowed', true, 'remaining', GREATEST(0, v_remaining));
END;
$$;

CREATE OR REPLACE FUNCTION deck_purge_rate_limit_buckets(p_older_than_seconds INTEGER DEFAULT 86400)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH del AS (
    DELETE FROM deck_rate_limit_buckets
    WHERE window_start < now() - make_interval(secs => p_older_than_seconds)
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER FROM del;
$$;

ALTER TABLE deck_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON deck_rate_limit_buckets FROM anon, authenticated;
GRANT ALL ON deck_rate_limit_buckets TO service_role;
GRANT EXECUTE ON FUNCTION deck_rate_limit_check(TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION deck_purge_rate_limit_buckets(INTEGER) TO service_role;
