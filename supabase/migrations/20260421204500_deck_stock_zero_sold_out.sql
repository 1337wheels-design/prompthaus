-- Sold out: Postgres deck_base_stock auf 0, Holds löschen (Shopify = SSOT via shop-sync danach)

CREATE OR REPLACE FUNCTION deck_clear_all_base_stock()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM deck_reservation_holds;
  UPDATE deck_base_stock SET quantity = 0, updated_at = now();
  RETURN jsonb_build_object(
    'ok', true,
    'availability', deck_availability(),
    'baseStock', deck_base_stock_json()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION deck_clear_all_base_stock() TO service_role;

SELECT deck_clear_all_base_stock();
