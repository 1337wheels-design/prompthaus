# Shop-Sync (Shopify → Supabase Inventar)

Synchronisiert **`quantityAvailable`** aus der Shopify Storefront API in **`deck_base_stock`** (RPC `deck_apply_stock_snapshot`). Danach liefert `reservation-api` den aktualisierten Bestand für Holds.

**Endpoint:** `https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/shop-sync`

| Route | Auth | Beschreibung |
|-------|------|--------------|
| `GET …/health` | nein | Konfig-Check (keine Secrets im Response) |
| `POST …/shop-sync` | Bearer `DECK_SYNC_CRON_SECRET` (wenn gesetzt) | Voll-Sync (Cron alle 3 Min) |
| `POST …/shop-sync/v1/schedule` | CORS (Deck-Shop-Origins) | Checkout: Sync in ~60 s einplanen |
| `POST …/shop-sync/v1/run-due` | Bearer `DECK_SYNC_CRON_SECRET` | Fällige Checkout-Syncs ausführen (Cron */1) |

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

## Cron (regelmäßig + checkout-getriggert)

Dashboard → [Edge Functions → shop-sync → Schedules](https://supabase.com/dashboard/project/yoeehrdsrfwolzdtgmel/functions)

**Zwei Schedules anlegen** (aus diesem Repo kann Supabase die Dashboard-Crons nicht automatisch setzen — nach Deploy manuell oder per Supabase CLI/Management-API):

| Name | Cron | Methode | URL | Header |
|------|------|---------|-----|--------|
| `shop-sync-full` | **`*/3 * * * *`** | POST | `…/functions/v1/shop-sync` | `Authorization: Bearer <DECK_SYNC_CRON_SECRET>` |
| `shop-sync-run-due` | **`*/1 * * * *`** | POST | `…/functions/v1/shop-sync/v1/run-due` | gleicher Bearer |

Der Deck-Shop ruft beim **Checkout-Klick** `POST …/v1/schedule` auf (ohne Secret, `keepalive`). Das plant einen Sync **~60 s später**; der Minuten-Cron `run-due` führt ihn aus.

Migration **`20260421220000_deck_sync_deferred.sql`** muss auf dem Projekt applied sein (`npx supabase db push`).

Nach **Fake-Orders** (Test-Gateway) sinkt Shopify-Inventar sofort; Supabase folgt nach Checkout-Schedule oder spätestens beim 3-Min-Cron (oder manuell `--sync`).

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
