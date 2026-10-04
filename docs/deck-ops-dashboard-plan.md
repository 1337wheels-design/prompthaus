# Ops-Dashboard — Prüfung (Supabase · Shopify · GitHub)

**Frage:** Lohnt sich ein **eigenes** Operations-Dashboard neben den drei Admin-Oberflächen?

**Kurzurteil:** **Ja, sinnvoll** — aber als **schlanke Ops-API + eine geschützte HTML-Seite** (oder CLI), nicht als schweres React-Admin. Größter Hebel: **ein Bild** für Event-Tag (Bestand, Holds, letzter Sync, Pages live, Shopify offen).

---

## 1. Ausgangslage

| System | Heute | Lücke |
|--------|--------|--------|
| **Supabase** | Dashboard (Logs, SQL, Functions, Secrets) | `deck_sync_runs`, Holds, Rate-Limits **nicht** gebündelt |
| **Shopify** | Admin, Bestellungen, Inventar | Kein Vergleich **Shopify vs Postgres** live |
| **GitHub** | Pages, Commits, Actions (falls konfiguriert) | Kein Link „Deploy OK + welche `config.js` Version“ |
| **Repo** | Scripts: `test:go-live`, Drop-Sim, Smoke | Nur **CLI**, kein Event-Monitor |

Alles Nötige ist **datentechnisch vorhanden** oder mit **einer** Edge Function erreichbar — es fehlt die **Aggregation**.

---

## 2. Zielbild (Event-Ops)

**Eine Seite** (Desktop, Handy-tauglich):

```
┌─────────────────────────────────────────────────────────┐
│ Payday Deck Shop — Ops          🟢 Live / 🟡 Degraded   │
├──────────────┬──────────────┬───────────────────────────┤
│ Supabase     │ Shopify      │ GitHub Pages              │
│ • API health │ • Store open │ • deck-shop HTTP 200      │
│ • Holds (n)  │ • qty chrome │ • last deploy (API)       │
│ • Last sync  │ • vs Supabase│ • branch gh-pages         │
│ • 429/5m     │ • orders 24h │                           │
├──────────────┴──────────────┴───────────────────────────┤
│ SKU-Tabelle: base_stock | holds | avail | shopify_snap  │
│ [ Sync jetzt ] [ Release Test-Sessions ]  (auth)        │
└─────────────────────────────────────────────────────────┘
```

**Nutzer:** Organisator:innen am Event-Tag, nicht Käufer.

---

## 3. Datenquellen (Machbarkeit)

### Supabase (Postgres + Functions)

| Metrik | Quelle | Ohne neues Backend |
|--------|--------|---------------------|
| Health Reservierung | `GET …/reservation-api/health` | ✅ öffentlich |
| Health Shop-Sync | `GET …/shop-sync/health` | ✅ öffentlich |
| Verfügbarkeit 12 SKUs | `GET …/v1/availability` | ✅ öffentlich |
| Letzter Sync | `deck_sync_runs` ORDER BY started_at | ❌ RLS, nur **service_role** |
| Aktive Holds / Sessions | `deck_reservation_holds` | ❌ service_role |
| Rate-Limit-Buckets (Spam?) | `deck_rate_limit_buckets` | ❌ service_role |
| Shopify-Snapshot | `deck_shopify_stock_snapshot` | ❌ service_role |
| Manueller Sync | `POST shop-sync` | ✅ mit **CRON secret** (nur Server/CLI) |

→ Für echtes Ops-Board braucht ihr **`ops-api`** (Edge Function, Bearer `DECK_OPS_SECRET`).

### Shopify

| Metrik | Quelle | Auth |
|--------|--------|------|
| Passwortschutz aus | `GET https://{shop}/` | ✅ none |
| `quantityAvailable` pro SKU | Storefront GraphQL | ✅ Token in Supabase (nicht Browser!) |
| Bestellungen heute / Umsatz | Admin API | ❌ `shpat_…` nur serverseitig |
| Checkout erreichbar | Permalink-Probe (wie Stress-Test) | ✅ |

**Empfehlung MVP:** Inventar-Vergleich **über shop-sync** (Postgres-Snapshot), Orders optional **Phase 2** (Admin-Token in Supabase Secret).

### GitHub (`1337wheels-design/prompthaus`)

| Metrik | Quelle | Auth |
|--------|--------|------|
| deck-shop erreichbar | `GET …/deck-shop/` | ✅ |
| Letzter Commit / Deploy | GitHub REST `pages` / `actions` | ❌ `GITHUB_TOKEN` (fine-grained) |
| Diff config.js reservation URL | API `contents/deck-shop/config.js` | ✅ public repo lesbar |

**MVP ohne Token:** HTTP-Check + Link zum Commit auf `gh-pages`.  
**Plus:** `GITHUB_TOKEN` in ops-api → letzter Pages-Build-Status.

---

## 4. Architektur-Optionen

### A — CLI-only (geringster Aufwand)

- `npm run ops:status` → JSON + optional Terminal-UI
- Nutzt vorhandene Health + optional Secrets aus `.env`
- **Kein** neues Hosting, **kein** Browser-Leak-Risiko

**Aufwand:** gering · **Nutzen:** Dev/Event-Vorbereitung

### B — Geschützte Static Page + `ops-api` (**empfohlen MVP**)

```
Browser (Passwort/Token) → ops-api (Supabase EF, DECK_OPS_SECRET)
                              ├─ RPC/SQL: sync_runs, holds, snapshots
                              ├─ proxy: shop-sync health
                              └─ optional: GitHub API, Shopify Storefront
```

- UI: `deck-ops/index.html` auf GitHub Pages **oder** nur lokal
- Token: Query **nicht** ideal; besser **HTTP Basic** vor Pages (Cloudflare Access) oder **einmal Login** → Session in `sessionStorage` + ops-api prüft `Authorization: Bearer OPS`

**Aufwand:** mittel · **Nutzen:** Event-Tag tauglich

### C — Externes Tool (Grafana / Metabase / Supabase Reports)

- Metabase auf Supabase DB (read-only user, Views)
- Shopify via Fivetran o.ä. — **Overkill** für ein Wochenend-Event

**Aufwand:** hoch · **Nutzen:** nur bei Dauerbetrieb

---

## 5. MVP-Scope (empfohlen)

### Phase MVP (1 Edge Function + 1 HTML)

**`ops-api` Endpoints (Vorschlag):**

| Method | Path | Liefert |
|--------|------|---------|
| GET | `/health` | ok |
| GET | `/v1/summary` | holds count, last sync run, availability, health flags |
| GET | `/v1/sku-matrix` | join base_stock, snapshot, availability |
| POST | `/v1/actions/sync` | triggert shop-sync (intern CRON secret) |
| POST | `/v1/actions/release-prefix` | `drop-user-*`, `tri-session-*` cleanup |

**UI:**

- Ampel + SKU-Tabelle + „Letzter Sync vor X min“
- Links: Supabase Logs, Shopify Admin, GitHub Actions/Pages
- Auto-Refresh 30 s

**Secrets (Supabase):**

- `DECK_OPS_SECRET` (neu, ≠ Cron, ≠ Service Role im Client)
- Bestehend: `DECK_SYNC_CRON_SECRET`, `SHOPIFY_*`

### Phase 2

- GitHub Pages deploy status (API)
- Shopify Orders 24h (Admin token)
- Rate-Limit-/429-Zähler (aus Logs oder Bucket-Count)
- Drop-Sim-Button (ruft Script/Function mit Guard)

### Phase 3

- Alerts (Slack/Discord Webhook bei sync failed, holds > N, chrome-838 = 0)

---

## 6. Sicherheit

| Risiko | Maßnahme |
|--------|----------|
| Service Role im Browser | **Verboten** — nur `ops-api` serverseitig |
| Ops-URL öffentlich indexiert | `noindex`, nicht verlinken; `DECK_OPS_SECRET` |
| Sync-Trigger Missbrauch | Ops-Secret + Rate-Limit auf ops-api |
| Shopify Admin Token | Nur Supabase Secret, nie Pages |

**GitHub Pages ist öffentlich:** Dashboard-**HTML** darf **keine** Secrets enthalten — nur Aufruf von `ops-api` mit Token, den ihr **manuell** eintragt (Event-Tag).

---

## 7. Aufwand vs Nutzen (Einschätzung)

| Komponente | Komplexität | Begründung |
|------------|-------------|------------|
| SQL Views / RPC für Ops | niedrig | 1 Migration, read-only aggregations |
| `ops-api` Edge Function | niedrig–mittel | Analog `shop-sync` |
| Static Dashboard HTML | niedrig | Kein Build-Tool nötig |
| GitHub Deploy-Status | mittel | Token + API |
| Shopify Orders | mittel | Admin scopes, DSGVO-Hinweis |
| Dauerhafter Betrieb | niedrig | Wenig moving parts |

**Fazit Entwicklung:** **lohnt sich** ab **MVP B**; **A** sofort als Brücke (`ops:status` CLI).

---

## 8. Abgrenzung zu bestehenden Scripts

| Bestehend | Dashboard-Ergänzung |
|-----------|---------------------|
| `test:go-live` | Wird zu **einem Panel** (automatisierter Poll) |
| `test:shop-sync:run` | Button „Sync jetzt“ |
| `test:drop-sim-25` | Bleibt CLI; Ergebnis optional in Ops-Historie |
| Supabase Dashboard | Deep-Link „Logs“ |

---

## 9. Empfehlung

1. **Jetzt:** CLI **`ops:status`** (aggregiert Health + Availability + Shopify-Root + Pages) — siehe `scripts/deck-ops-status.mjs`.
2. **Nächster Schritt:** **`ops-api`** + **`deck-ops/index.html`** hinter Ops-Secret (nicht öffentlich bewerben).
3. **Später:** GitHub + Orders, Alerts.

**Nicht bauen:** Vollständiges Admin-Panel in React, Metabase für ein Event.

---

## 10. Offene Entscheidungen

- [ ] Ops-UI auf **GitHub Pages** (geschützt) vs **nur lokal** vs **Supabase-hosted** Static
- [ ] Wer kennt `DECK_OPS_SECRET` am Event-Tag?
- [ ] Orders in Shopify im Dashboard ja/nein (Admin-Token pflegen)
- [ ] Automatische Alerts ja/nein
