# Deck Shop auf Vercel (parallel zu GitHub Pages)

## Ziel

| Host | URL | Rolle |
|------|-----|--------|
| **GitHub Pages** | `https://1337wheels-design.github.io/prompthaus/deck-shop/` | Produktion / Event (kanonisch) |
| **Vercel** | `https://payday.vercel.app/deck-shop/` | Schnelle Previews, parallele Entwicklung |

Vercel deployt das **gesamte Repo** (static), damit `../decks/` für Editor und Assets funktioniert.

## Vercel-Projekt

**GitHub App (einmalig):**  
https://github.com/apps/vercel/installations/new/permissions?target_id=262473948&target_type=User  
→ Zugriff auf `1337wheels-design/prompthaus` erlauben.

CLI-Hilfe im Repo: `npm run vercel:setup` (zeigt Links; mit `VERCEL_TOKEN` optional `npm run vercel:deploy`).

1. [Vercel Dashboard](https://vercel.com/new) → Import `1337wheels-design/prompthaus`
2. **Production Branch:** `gh-pages` (oder Branch eurer Wahl)
3. **Framework Preset:** Other  
4. **Root Directory:** `.` (Repo-Root)  
5. **Build Command:** leer · **Output:** static (siehe `vercel.json`)
6. **Project Name:** `payday` → URL `https://payday.vercel.app`

Root `/` leitet per `vercel.json` nach `/deck-shop/`.

## Supabase

Edge Functions erlauben CORS für:

- `https://1337wheels-design.github.io`
- `https://payday.vercel.app`
- `https://*.vercel.app` (Preview-Deployments)

Nach CORS-Änderungen: `npm run supabase:deploy:reservation` und `supabase:deploy:shop-sync`.

## Checkout Return-URL

`shopify-checkout.js` erkennt automatisch  
`…/deck-shop/` auf der **aktuellen Origin** (Pages, Vercel, Custom Domain).  
`config.js` enthält nur noch den **GitHub-Fallback**, wenn keine Browser-Location existiert.

## Tests

```bash
DECK_SHOP_URL=https://payday.vercel.app/deck-shop/ npm run test:go-live
```

Manuell: Shop öffnen → Warenkorb → Checkout → `return_to` muss dieselbe Origin + `/…/deck-shop/` sein.

## Custom Domain (später)

Domain in Vercel verbinden → Origin in Supabase Secret **`DECK_SHOP_ALLOWED_ORIGINS`** (kommagetrennt, z. B. `https://shop.example.com`) setzen und Edge Functions neu deployen — oder dauerhaft in `supabase/functions/deck-cors.ts` eintragen.
