-- Checkout-getriggerter shop-sync: einmal geplant, von Cron /run-due abgearbeitet

CREATE TABLE IF NOT EXISTS deck_sync_deferred (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  run_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  source text NOT NULL DEFAULT 'none',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO deck_sync_deferred (id, run_at, source)
VALUES (1, '1970-01-01T00:00:00Z', 'none')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION deck_sync_schedule_deferred(p_delay_seconds integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_at timestamptz;
BEGIN
  IF p_delay_seconds IS NULL OR p_delay_seconds < 5 THEN
    p_delay_seconds := 60;
  END IF;
  IF p_delay_seconds > 600 THEN
    p_delay_seconds := 600;
  END IF;

  v_run_at := now() + make_interval(secs => p_delay_seconds);

  UPDATE deck_sync_deferred
  SET run_at = v_run_at, source = 'checkout', updated_at = now()
  WHERE id = 1;

  RETURN jsonb_build_object(
    'ok', true,
    'run_at', v_run_at,
    'delaySeconds', p_delay_seconds
  );
END;
$$;

CREATE OR REPLACE FUNCTION deck_sync_take_due()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run_at timestamptz;
BEGIN
  SELECT run_at INTO v_run_at FROM deck_sync_deferred WHERE id = 1;

  IF v_run_at IS NULL OR v_run_at > now() THEN
    RETURN jsonb_build_object('ok', true, 'due', false);
  END IF;

  UPDATE deck_sync_deferred
  SET run_at = '2099-01-01T00:00:00Z', source = 'none', updated_at = now()
  WHERE id = 1;

  RETURN jsonb_build_object('ok', true, 'due', true, 'wasDueAt', v_run_at);
END;
$$;

ALTER TABLE deck_sync_deferred ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON deck_sync_deferred FROM anon, authenticated;
GRANT ALL ON deck_sync_deferred TO service_role;
GRANT EXECUTE ON FUNCTION deck_sync_schedule_deferred(integer) TO service_role;
GRANT EXECUTE ON FUNCTION deck_sync_take_due() TO service_role;
