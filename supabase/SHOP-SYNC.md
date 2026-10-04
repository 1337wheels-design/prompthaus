# Shop-Sync (Shopify → Supabase Inventar)

Synchronisiert **`quantityAvailable`** aus der Shopify Storefront API in **`deck_base_stock`** (RPC `deck_apply_stock_snapshot`). Danach liefert `reservation-api` den aktualisierten Bestand für Holds.

**Endpoint:** `https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/shop-sync`

| Route | Auth | Beschreibung |
|-------|------|--------------|
| `GET …/health` | nein | Konfig-Check (keine Secrets im Response) |
| `POST …/shop-sync` | Bearer `DECK_SYNC_CRON_SECRET` (wenn gesetzt) | Sync ausführen |

## Schnellstart (CLI)

```bash
npm install
npx supabase login
npx supabase link --project-ref yoeehrdsrfwolzdtgmel

# Domain + SKU-Map + Cron-Secret (Token separat, siehe unten)
export SHOPIFY_STOREFRONT_TOKEN='dein_public_storefront_token'
node scripts/supabase-shop-sync-setup.mjs --generate-cron-secret --deploy

# Prüfen
node scripts/deck-shop-sync-smoke.mjs
export DECK_SYNC_CRON_SECRET='<dein_hex_secret_aus_setup>'   # nur ASCII — nicht den Dokumentations-Platzhalter kopieren
node scripts/deck-shop-sync-smoke.mjs --sync
```

## Storefront-Token (Shopify)

1. [Shopify Admin](https://admin.shopify.com/store/xwk1u9-6z) → **Settings → Apps and sales channels → Develop apps** (Headless / Custom App)
2. Storefront API aktivieren, **public access token** kopieren
3. Scopes: mindestens Produkte lesen / unauthenticated read product inventory (je nach App-Version)

```bash
npx supabase secrets set SHOPIFY_STOREFRONT_TOKEN="…" --project-ref yoeehrdsrfwolzdtgmel
```

Optional denselben Token in `deck-shop/config.local.js` → `storefrontAccessToken` für Live-Preise im Browser (gitignored).

## Cron (empfohlen: alle 5 Min)

Dashboard → [Edge Functions → shop-sync → Schedules](https://supabase.com/dashboard/project/yoeehrdsrfwolzdtgmel/functions)

- Schedule: `*/5 * * * *`
- HTTP **POST** auf Function-URL
- Header: `Authorization: Bearer <DECK_SYNC_CRON_SECRET>`

Nach **Fake-Orders** (Test-Gateway) sinkt Shopify-Inventar sofort; Supabase folgt spätestens beim nächsten Cron (oder manuell `--sync`).

## Logs & DB

- Function-Logs im Supabase Dashboard
- Tabelle **`deck_sync_runs`**: `status`, `meta` (applied, skipped SKUs)
- **`deck_shopify_stock_snapshot`**: letzter Shopify-Stand pro SKU

## Fehler

| Symptom | Ursache |
|---------|---------|
| `401 unauthorized` | `DECK_SYNC_CRON_SECRET` gesetzt, Header fehlt/falsch |
| `SHOPIFY_STOREFRONT_TOKEN required` | Secret nicht gesetzt |
| `skipped` SKUs in Response | Produkt/Handle falsch oder `quantityAvailable` null (Tracking aus?) |
| Inventar unverändert nach Order | Cron noch nicht gelaufen — manuell POST sync |

Siehe auch `supabase/SETUP.md` (Gesamt-Option B).
