# Deck Shop — Live-Gang & Exploit-Review

Stand: Stufe A (Reservierung + Cron-Sync + leichtes Availability-Polling).

## Stufe A (umgesetzt)

| Baustein | Verhalten |
|----------|-----------|
| **Holds** | 5 Min, `sync` / `heartbeat` / `release` |
| **Shop-Sync** | Shopify → `deck_base_stock` via Edge Function `shop-sync` |
| **Cron (du)** | Supabase Schedule **alle 3–5 Min** → POST `shop-sync` + `Authorization: Bearer <DECK_SYNC_CRON_SECRET>` |
| **UI-Polling** | Nach Shop-Freischaltung: **`GET /v1/availability` alle ~75 s** (nur sichtbarer Tab), kein Shopify-Sync aus dem Browser |

Polling ersetzt **keinen** Cron — es zeigt nur schneller an, wenn Postgres nach dem Cron bereits aktualisiert wurde.

---

## Checkliste vor Live (Pflicht)

- [ ] **GitHub Pages** `gh-pages` deployed, Hard-Reload Deck Shop
- [ ] **Supabase Cron** für `shop-sync` (3–5 Min) mit **Cron-Secret** (nicht Storefront-Token)
- [ ] `npm run test:shop-sync:run` mit korrektem `DECK_SYNC_CRON_SECRET` → **200 ok**
- [ ] **Shopify Passwortschutz aus** — Checkout ohne `/password`
- [ ] **Zahlung:** Test-Gateway nur für Demos; für echtes Event Zahlungsanbieter klären
- [ ] **Cron-Secret & Service Role** nie im Repo / nicht in `config.js`
- [ ] Optional: **Storefront-Token** in `config.local.js` für Live-Preise im UI (nicht nötig für Holds)

---

## Exploit-Review (Stufe 1)

| Risiko | Schwere | Status | Anmerkung |
|--------|---------|--------|-----------|
| **Hold-Spam / Bestand blockieren** | mittel | teilweise | Rate-Limits Stufe 1; viele IPs / Sessions möglich → Stufe 2 Turnstile |
| **Reservierungs-API ohne Browser** | niedrig–mittel | mitigiert | API öffentlich by design; Limits pro IP/Session; kein DB-Direct-Leak |
| **`reserveApi` Query-Proxy** | mittel | mitigiert | Nur localhost |
| **shop-sync Missbrauch** | hoch | mitigiert | Bearer Secret Pflicht |
| **Service-Role-Key im Client** | kritisch | ok | Nur Supabase Secrets |
| **Checkout `return_to`** | niedrig | ok | Auf Deck-Shop-URL begrenzt (Permalink-Sanitizer) |
| **Overbooking** | hoch | ok | `deck_sync_cart` 409; Shopify Checkout final |
| **Veralteter Bestand nach Order** | mittel | Cron nötig | Ohne Cron: Supabase > Shopify bis Sync; Holds begrenzen Race |
| **CORS** | info | ok | Browser-Schutz; `curl` umgeht CORS — erwartet |
| **Tokens in Chat/Git** | mittel | **du** | Storefront/Cron rotieren wenn geleakt |
| **Skript-Kiddie DDoS** | mittel | teilweise | Supabase/Shopify Limits; kein WAF auf Pages |

**Urteil:** Für ein **regionales Event mit begrenztem Bestand** ist der Stand **live-tauglich**, wenn **Cron läuft** und **Shopify-Checkout live** ist. Für **hohe Bot-Last** oder **öffentliche Skalierung**: Stufe 2 (Turnstile + ggf. Webhook-Sync nach Order).

---

## Was noch fehlt (priorisiert)

1. **Cron im Dashboard** (häufig vergessen) — ohne = Bestand nach Verkäufen hängt nach  
2. **Manueller E2E:** Add → Checkout (Test-Gateway) → Return → Availability sinkt nach ≤5 Min  
3. **Optional:** Storefront-Token in Pages für Preise/Bestand aus Shopify-GraphQL im Grid  
4. **Optional Stufe B:** Shopify Order-Webhook → einmal `shop-sync`  
5. **Optional Stufe 2:** Turnstile vor `/v1/cart/sync`  
6. **Rechtliches/Event:** AGB, Widerruf, Tombola/DSGVO (`docs/distribution.md`) — produktseitig prüfen  

---

## Schnelltests

```bash
export DECK_SYNC_CRON_SECRET='<48-hex aus setup>'
npm run test:shop-sync:run
npm run test:rate-limit
npm run test:reservations
```

Health: `…/reservation-api/health` → `"rateLimit":"stufe1"` · `…/shop-sync/health` → `"configured":true`
