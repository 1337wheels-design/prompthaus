# Deck Shop — Supabase (Option B)

**Projekt-URL:** `https://yoeehrdsrfwolzdtgmel.supabase.co`  
**Reservierungs-API (nach Deploy):** `https://yoeehrdsrfwolzdtgmel.supabase.co/functions/v1/reservation-api`

Postgres (EU) für **5-Min-Reservierungen**, später **Shopify-Bestand-Sync** und Sync-Logs.

## 1. Projekt anlegen

1. [Supabase Dashboard](https://supabase.com/dashboard) → **New project**
2. **Region: Frankfurt (eu-central-1)** (oder nächste EU-Region)
3. Datenbank-Passwort sicher speichern

## 2. Supabase CLI (ohne globale Installation)

Im **Repo-Root** (nach `git pull`):

```bash
npm install
npx supabase --version   # sollte z. B. 2.x anzeigen
```

Falls `supabase: command not found`: **nicht** `supabase …` alone — immer **`npx supabase …`** aus dem Projektordner, oder `npm install -g supabase`.

## 3. Schema deployen

```bash
npx supabase login
npx supabase link --project-ref yoeehrdsrfwolzdtgmel
npx supabase db push
```

**Ohne CLI:** SQL aus `supabase/migrations/20260404180000_deck_shop.sql` im Dashboard → **SQL Editor** → Run.

## 4. Edge Functions deployen

```bash
npx supabase secrets set DECK_RESERVE_TTL_SECONDS=300

# Shop-Sync (optional):
npx supabase secrets set SHOPIFY_SHOP_DOMAIN=xwk1u9-6z.myshopify.com
npx supabase secrets set SHOPIFY_STOREFRONT_TOKEN=dein_storefront_public_token
npx supabase secrets set DECK_SKU_HANDLE_MAP_JSON="$(cat deck-shop/deck-sku-handle-map.json)"
npx supabase secrets set DECK_SYNC_CRON_SECRET=lange-zufallszeichenkette

npx supabase functions deploy reservation-api --project-ref yoeehrdsrfwolzdtgmel
npx supabase functions deploy shop-sync --project-ref yoeehrdsrfwolzdtgmel
```

Kurz via npm-Scripts (Repo-Root): `npm run supabase:deploy:reservation`

**Reservierungs-URL für den Deck Shop:**

```text
https://DEIN_PROJECT_REF.supabase.co/functions/v1/reservation-api
```

In `deck-shop/config.js`:

```javascript
reservationApiUrl: 'https://DEIN_PROJECT_REF.supabase.co/functions/v1/reservation-api',
```

## 4. Cron (Shop-Sync / Heartbeat-Server)

Dashboard → **Edge Functions** → `shop-sync` → **Schedules** (z. B. alle 5 Min), Header:

```text
Authorization: Bearer DEIN_DECK_SYNC_CRON_SECRET
```

## 5. Lokaler Node-Proxy (optional)

Statt Edge Function lokal/auf VPS mit derselben DB:

```bash
export SUPABASE_URL=https://DEIN_PROJECT_REF.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ... # nur serverseitig, nie im Repo
node scripts/deck-reservation-server.mjs
```

`/health` meldet `"backend": "supabase"`.

## Tabellen

| Tabelle | Zweck |
|---------|--------|
| `deck_base_stock` | Reservierbares Inventar (SSOT für Holds) |
| `deck_reservation_holds` | Session-Holds mit `expires_at` |
| `deck_sync_runs` | Log für Sync-Jobs |
| `deck_shopify_stock_snapshot` | Letzter Shopify-Stand pro SKU |

RPC: `deck_sync_cart`, `deck_release_session`, `deck_availability`, `deck_heartbeat_cart`, `deck_apply_stock_snapshot`.

## Sicherheit

- **Service Role Key** nur in Supabase Secrets / Server-Env — nie in GitHub Pages `config.js`.
- RLS auf Tabellen: kein direkter Browser-Zugriff auf Postgres; nur Edge Function mit Service Role.
- `shop-sync` mit `DECK_SYNC_CRON_SECRET` absichern.
