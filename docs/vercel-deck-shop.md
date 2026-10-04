# Deck Shop auf Vercel (parallel zu GitHub Pages)

## Ziel

| Host | URL | Rolle |
|------|-----|--------|
| **GitHub Pages** | `https://1337wheels-design.github.io/prompthaus/deck-shop/` | Produktion / Event (kanonisch) |
| **Vercel (Team)** | `https://1337wheels-design-payday.vercel.app/deck-shop/` | Preview / paralleler Host |

Vercel deployt das **gesamte Repo** (static), damit `../decks/` für Editor und Assets funktioniert.

## Live-URL

- **Production (Team-Subdomain):** https://1337wheels-design-payday.vercel.app/
- **Deck Shop (Zielpfad):** https://1337wheels-design-payday.vercel.app/deck-shop/
- Optional alias: `https://payday.vercel.app` (nur wenn im Vercel-Projekt zugewiesen)

Root `/` soll per `vercel.json` nach `/deck-shop/` leiten — **nur wenn** das Deployment den aktuellen **`main`**-Stand enthält (`deck-shop/`, `vercel.json`).

## Deployment-Strategie

Deck-Shop-Stand liegt auf **`main`** (Merge aus `gh-pages`). **GitHub Pages** kann weiter **`gh-pages`** nutzen — beide Branches werden nach größeren Änderungen sync gehalten.

### Symptom: alte Startseite, `/deck-shop/` → 404

Das Vercel-Deployment ist **veraltet** oder **falsches Repo/Root**:

| Prüfung | Erwartung (aktueller `main`) |
|---------|------------------------------|
| `/` Titel | „Payday Deck Shop“ (Redirect-Script) — **nicht** „Complete Card Set“ |
| `/deck-shop/` | HTTP **200** |
| `vercel.json` | im Deployment aktiv (Redirect `/` → `/deck-shop/`) |

**Fix im Dashboard (Projekt `payday`, Team `1337wheels-design`):**

1. **Settings → Git** → Repository **`1337wheels-design/prompthaus`**, Production Branch **`main`**
2. **Settings → General** → Root Directory **`.`**, Build Command **leer**, Output static
3. **Deployments** → letztes Deployment → **Redeploy** (Production, **Use existing Build Cache: No**)

## Vercel-Projekt anlegen / verbinden

**GitHub App:**  
https://github.com/apps/vercel/installations/new/permissions?target_id=262473948&target_type=User

CLI: `npm run vercel:setup` · mit `VERCEL_TOKEN`: `npm run vercel:deploy`

**Vercel MCP (Cursor):** [`docs/vercel-mcp-cloud-agent.md`](vercel-mcp-cloud-agent.md) — Dashboard-OAuth, dann Redeploy/Logs per Agent.

Import: https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2F1337wheels-design%2Fprompthaus&project-name=payday&production-branch=main

## Supabase CORS

- `https://1337wheels-design.github.io`
- `https://1337wheels-design-payday.vercel.app`
- `https://payday.vercel.app`
- `https://*.vercel.app`

Nach Änderungen an `deck-cors.ts`: `npm run supabase:deploy:reservation` und `supabase:deploy:shop-sync`.

## Tests

```bash
npm run test:go-live:vercel
# oder
DECK_SHOP_URL=https://1337wheels-design-payday.vercel.app/deck-shop/ npm run test:go-live
```

Checkout: `return_to` = aktuelle Origin + `/deck-shop/` (automatisch in `shopify-checkout.js`).

## Custom Domain

Domain in Vercel → Origin in Secret **`DECK_SHOP_ALLOWED_ORIGINS`** oder `supabase/functions/deck-cors.ts`.
