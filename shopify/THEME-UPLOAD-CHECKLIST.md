# Payday Shop Theme — Upload (Ja/Nein)

## A — Einmalig (du am Rechner)

| # | Schritt | Ja/Nein |
|---|---------|---------|
| A1 | `npm install` im Repo | ☐ |
| A2 | `npm run shopify:theme:login` (Browser-Login Shopify) | ☐ |
| A3 | `npm run shopify:theme:push` (Theme hochladen, **unveröffentlicht**) | ☐ |
| A4 | Admin → **Online Store → Themes** → „Payday Shop“ → **Preview** öffnen | ☐ |
| A5 | Sieht dunkel aus wie Vercel + 3× Wischen funktioniert? | ☐ |

## B — Theme Editor (Shopify Admin)

| # | Einstellung | Empfohlen |
|---|-------------|-----------|
| B1 | **Storefront Public Token** gesetzt? | **Ja** (Pflicht für Live-Bestand) |
| B2 | **Supabase Reservierungen** an? | **Nein** (Shopify-only) |
| B3 | **Asset-CDN** = `https://1337wheels-design-payday.vercel.app`? | **Ja** (bis Grafiken im Theme liegen) |

## C — Go-Live

| # | Entscheidung | Empfohlen |
|---|------------|-----------|
| C1 | Theme **veröffentlichen** (Live Store)? | Ja, wenn Preview OK |
| C2 | Supabase **Cron-Jobs** abschalten? | **Ja**, wenn nur noch Shopify-Shop |
| C3 | Vercel/Pages Deck-Shop weiter betreiben? | Nein (Redirect auf Shopify) oder Ja (CDN only) |

## D — Inventar ohne Supabase

- Bestand = **Shopify Admin** (ein Ort).
- Theme liest via **Storefront API** (Token in B1).
- Kein `shop-sync`, kein Postgres für Anzeige.

## Befehle

```bash
npm run shopify:theme:sync    # nach Änderungen an deck-shop/
npm run shopify:theme:push
```
