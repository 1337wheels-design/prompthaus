# Eingangsverhalten — Supabase (Deck Shop)

Stand: nach Drop-Simulation + gestaffeltem Release (2026-10-04).  
Projekt: [yoeehrdsrfwolzdtgmel](https://supabase.com/dashboard/project/yoeehrdsrfwolzdtgmel)

---

## 1. Rate-Limit (Stufe 1) — wieder aktiv

| Aktion | Status |
|--------|--------|
| Secret `DECK_RATE_LIMIT_DISABLED` | **entfernt** (unset, nicht `false` im Secret-Store) |
| `reservation-api` Health | `"rateLimit":"stufe1"`, `rateLimitDb.ok: true` |
| Verifikation | Session-Flood: **429 ab Request 81** (`GET /v1/availability`, Limit 80/60 s) |

**Prod-Regel:** Kein `DECK_RATE_LIMIT_DISABLED` in Supabase Secrets. Test-Abschaltung nur kurz für Ein-IP-Drop-Sims, danach **unset** + ggf. Redeploy.

---

## 2. Wo du im Dashboard nachschaust

| Ziel | Navigation |
|------|------------|
| **Edge Ingress (HTTP)** | **Edge Functions** → `reservation-api` → Tab **Logs** / **Invocations** |
| **Shop-Sync** | **Edge Functions** → `shop-sync` → Logs |
| **Rate-Limit-Zähler** | **Database** → **Table Editor** → `deck_rate_limit_buckets` |
| **Warenkorb-Holds** | **Table Editor** → `deck_reservation_holds` |
| **Bestand / Sync-Historie** | `deck_base_stock`, `deck_shopify_stock_snapshot`, `deck_sync_runs` |
| **Ad-hoc-Auswertung** | **SQL Editor** → Inhalt von [`supabase/sql/ingress-dashboard.sql`](../supabase/sql/ingress-dashboard.sql) |

CLI-Alternative (Tabellengröße / Zeilen-Schätzung):

```bash
npx supabase inspect db table-stats --project-ref yoeehrdsrfwolzdtgmel
```

---

## 3. Was beim Event „Drop + Release“ reinkam

### Phase A — `empty` (25 User, **eine IP**)

- **~25×** paralleles `POST /v1/cart/sync` (Promise.all), verteilt ~49 Einheiten auf `drop-user-01` … `25`.
- Während des Laufs war Rate-Limit **bewusst aus** (Secret) → **0× 429**, **25× 200**, Latenz sync ~327–800 ms.
- **Ohne** Abschaltung wäre **`sync-burst`** (8/10 s pro IP) und **IP-Sync** (40/60 s) sofort relevant gewesen → viele **429** statt 409/200.

### Phase B — gestaffeltes Release (60 s)

- **26×** `POST /v1/cart/release` (~2,3 s Abstand) → unter **release_ip** (60/60 s) → **keine 429** erwartet.
- Holds fielen schrittweise weg; globale Availability stieg sichtbar an.

### Phase C — danach (inspect, ca. 21:07 UTC)

| Tabelle | Schätzung (CLI inspect) | Deutung |
|---------|-------------------------|---------|
| `deck_rate_limit_buckets` | ~**93** Zeilen | viele IP-/Session-Fenster aus Tests + Shop-Polling |
| `deck_reservation_holds` | **0** aktive Zeilen | keine offenen Drop-Holds mehr (Release/TTL) |
| `deck_sync_runs` | ~**12** Einträge | wiederholte shop-sync-Läufe (Cron/Manuell) |

---

## 4. Technisches Ingress-Modell

```
Browser (GitHub Pages)
  Origin: https://1337wheels-design.github.io
       │
       ▼
Supabase Edge ─ reservation-api
  ├─ OPTIONS → 204 CORS
  ├─ GET /health
  ├─ GET /v1/availability  → deck_availability (+ rate buckets)
  ├─ POST /v1/cart/sync     → deck_sync_cart
  ├─ POST /v1/cart/heartbeat
  └─ POST /v1/cart/release  → deck_release_session

IP für Limits: clientIp() — bevorzugt CF-Connecting-IP, sonst **letzter** Hop in X-Forwarded-For
(siehe rate-limit.ts; wichtig hinter Supabase Edge).
```

**Typischer Live-Shop (Stufe A polling 75 s):** pro Tab vor allem `GET /v1/availability` → Session-Bucket `sess:{sessionId}:/v1/availability` (80/min), IP-Bucket 120/min.

**Drop von einer Adresse:** dominierend `ip:*:/v1/cart/sync` + `ip:*:sync-burst` + Session-Buckets `drop-user-*`.

---

## 5. Empfehlungen fürs Event

1. **Rate-Limit Secret nicht setzen** — Stufe 1 schützt vor Script-Spam; echte User pro Tab unter Limits.
2. **Drop-Tests** nur mit Abschaltung + sofort **unset**; Ergebnis ≠ Produktion unter Limit.
3. **SQL Editor** nach Lastspitzen: Queries 1–3 aus `ingress-dashboard.sql` (Hot-Buckets, Holds).
4. **Logs** `reservation-api`: 429-Rate vs. 409 `insufficient` vs. 5xx — im Idealfall viele 409 bei Hot-SKU, wenige 5xx.
5. Optional Cron: `deck_purge_rate_limit_buckets(86400)` (Query 6) gegen Bucket-Wachstum.

---

## 6. Repo-Hilfen

| Befehl | Zweck |
|--------|--------|
| `npm run test:rate-limit` | Live-Check 429 (Burst innerhalb 60 s) |
| `npm run ops:status` | Health + Availability + Sync ohne DB |
| `npm run test:drop-sim-25` | Koordinierter Lasttest (Prod-Limits beachten) |
