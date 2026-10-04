# Drop-Simulation — 25 koordinierte „User“

Ziel: **realistisch prüfen**, ob Reservierung, Rate-Limits, Holds und Anzeige bei **gleichzeitigem** Andrang halten — **ohne** 25 echte Menschen.

Projekt: `yoeehrdsrfwolzdtgmel` · Live-Shop: GitHub Pages Deck Shop · API: `reservation-api`.

---

## 1. Was simuliert wird (und was nicht)

| Simuliert | Nicht simuliert (optional später) |
|-----------|-----------------------------------|
| 25 **eigene** `sessionId`s (wie 25 Browser) | 25 **echte IPs** (ein Runner = eine IP → Rate-Limit verzerrt) |
| Gleicher **T0**: alle `POST /v1/cart/sync` | 25× voller Playwright-Checkout |
| Konkurrenz auf **eine Hot-SKU** (Default `chrome-838`) | Shopify-Zahlung in Masse |
| Auswertung: 200 / 409 / 429, Restbestand | Lasttest >25 RPS |

**Interpretation:** Ergebnis ist **Systemverhalten + Fairness der Holds**. Für **IP-realistische** Drops: mehrere Runner (VPN/CI-Matrix) oder kurz `DECK_RATE_LIMIT_DISABLED=true` nur in **Staging** (nicht Prod ohne Absprache).

---

## 2. Szenarien

### Szenario A — „Hot SKU“ (Default)

- **SKU:** `chrome-838` (aktuell oft niedrigster Bestand)
- **25 User**, je **1×** sync (1 Deck im Warenkorb)
- **Erwartung:** `min(25, verfügbar_global)` × **200**, Rest **409** `insufficient`
- Nach Lauf: global **0** frei (wenn Bestand ≤25)

### Szenario B — verteilt

- User 1–8: `chrome-838`, 9–16: `neon-850`, 17–25: `chrome-850`
- Prüft **keine** Überbuchung pro SKU, geringere Konkurrenz pro Linie

### Szenario C — „Double tap“

- 25 User, je **2×** sync (2 Stück) auf A-SKU
- Erwartung: frühe 409, stärkere **Burst-Limits** (8/10s IP, 5/10s Session)

### Szenario `empty` — Shop leerkaufen (1 IP)

- Verteilt **alle** freien Einheiten (Baseline) round-robin auf 25 `drop-user-*` Sessions, **ein** paralleler `sync`-Wave
- Für Ein-IP-Lauf: kurz `DECK_RATE_LIMIT_DISABLED=true` (Supabase Secret), danach wieder `false`
- Erwartung: **25×200**, `after` alle SKUs **0** (Holds aktiv — Shop wirkt ausverkauft bis Release)

```bash
npm run test:drop-sim-25:cleanup
node scripts/deck-drop-simulation-25.mjs --scenario=empty
# Bestand zurück: --release-after oder test:drop-sim-25:cleanup
```

---

## 3. Ablauf (koordiniert)

```
T-10 min   shop-sync manuell/Cron → Baseline in Supabase
T-5 min    Release aller drop-user-* Sessions (Cleanup)
T-1 min    Baseline availability loggen (JSON)
T0         Barrier: 25 parallele sync-Requests (Promise.all)
T+5 s      availability + Auswertung
T+2 min    Optional: Release aller Sessions (Cleanup)
T+5 min    Optional: shop-sync → Abgleich Shopify
```

**Erfolgskriterien (A):**

- Keine **200** über verfügbaren Bestand hinaus (Summe Holds ≤ Basisbestand)
- Konsistente **globale** availability nach T0
- Kein **500** (Serverfehler)
- 429 dokumentiert (wenn ein IP-Runner) — kein Dauer-429 für normalen Einzeluser nach Test

---

## 4. Metriken & Artefakte

| Metrik | Quelle |
|--------|--------|
| Erfolg / 409 / 429 pro User | Script-Report JSON |
| Latenz p50/p95 sync | Timestamps im Script |
| `chrome-838` vor/nach | `/v1/availability` |
| Rate-Limit-Hits | `reason: rate_limited` |
| DB optional | `deck_sync_runs`, Holds (Supabase SQL) |

Report-Pfad: `/opt/cursor/artifacts/drop-sim-25-report.json` (oder `DROP_REPORT` env).

---

## 5. Voraussetzungen

- [ ] Cron **shop-sync** aktiv (Bestand aktuell)
- [ ] Keine offenen **drop-user-*** Holds von früheren Läufen
- [ ] **Nicht** während echtem Event-Publikum (Holds 5 Min blockieren Bestand)
- [ ] `npm run test:go-live` grün
- [ ] Bei Prod-Rate-Limits: erwarte **429** ab User ~8–10 **vom selben Host** — siehe Szenario D

### Szenario D — 25 IPs (realistischer Drop)

- 5 Freunde/CI-Jobs mit je 5 Sessions, oder
- Supabase **nur Testfenster:** Secret `DECK_RATE_LIMIT_DISABLED=true` → danach wieder **aus**

---

## 6. Ausführung

```bash
# Dry-run Baseline + Cleanup
node scripts/deck-drop-simulation-25.mjs --cleanup-only

# Szenario A (Default)
node scripts/deck-drop-simulation-25.mjs

# Szenario B / C
node scripts/deck-drop-simulation-25.mjs --scenario=b
node scripts/deck-drop-simulation-25.mjs --scenario=c

# Optional: danach Holds freigeben
node scripts/deck-drop-simulation-25.mjs --release-after
```

Optional Browser-Stichprobe (1–3 User headed):

```bash
DISPLAY=:1 HEADLESS=0 node scripts/deck-drop-simulation-25.mjs --browser-sample=3
```

*(Nur wenn `--browser-sample` im Script implementiert — sonst API-only.)*

---

## 7. Nach dem Drop

1. **`--release-after`** oder Cleanup-Skript — Bestand für echte Kunden frei  
2. **shop-sync** einmal triggern  
3. Report archivieren (Event-Dokumentation)  
4. Wenn viele **429**: Stufe-2-Plan (Turnstile) oder Drop über **mehrere IPs**

---

## 8. Risiken

- **Bestand 5 Min blockiert** — nach Test Release nicht vergessen  
- **Einzel-IP-Simulation** unterschätzt Erfolgsquote, **überschätzt** 429  
- **Shopify** wird in A/B/C **nicht** belastet — separater Checkout-Stichprobe-Tag empfohlen
