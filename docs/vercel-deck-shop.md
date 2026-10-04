# Deck Shop auf Vercel (parallel zu GitHub Pages)

## Ziel

| Host | URL | Rolle |
|------|-----|--------|
| **GitHub Pages** | `https://1337wheels-design.github.io/prompthaus/deck-shop/` | Produktion / Event (kanonisch) |
| **Vercel** | `https://payday.vercel.app/deck-shop/` | Schnelle Previews, parallele Entwicklung |

Vercel deployt das **gesamte Repo** (static), damit `../decks/` für Editor und Assets funktioniert.

## Wichtig: Vercel ≠ GitHub Pages

| | GitHub Pages | Vercel |
|---|--------------|--------|
| **Branch** | `gh-pages` (manuell in Pages-Settings) | Standard beim Import: **`main`** (GitHub-Default) |
| **Inhalt in diesem Repo** | Deck Shop, `vercel.json`, Supabase-Anbindung | Auf **`main`**: kein `deck-shop/`, kein `vercel.json` |
| **Verknüpfung** | GitHub → Settings → Pages | Separates Vercel-Projekt + Git **oder** CLI/Action |

Beim Anlegen eines Vercel-Projekts wird **nicht** die GitHub-Pages-Konfiguration übernommen. Ohne Anpassung deployt Vercel **`main`** — dann fehlt `/deck-shop/` (404) oder es läuft noch ein **anderes** Deployment auf derselben Domain.

**Aktueller Befund `payday.vercel.app`:** Root liefert eine **React-SPA** (nicht der statische Deck Shop aus `gh-pages`). Das Projekt muss auf Repo **`1337wheels-design/prompthaus`** + Branch **`gh-pages`** umgestellt und neu deployed werden.

## Projekt „payday“ existiert schon (Git nachträglich)

1. [Vercel Dashboard](https://vercel.com) → Projekt **payday** → **Settings** → **Git**
2. **Connect Git Repository** → `1337wheels-design/prompthaus` (falls noch nicht verbunden)
3. **Settings** → **Environments** → **Production** → **Branch** auf **`gh-pages`** stellen (nicht `main`)
4. **Settings** → **General** → **Root Directory** = `.` · Build Command leer
5. **Deployments** → **Redeploy** (Production, Branch `gh-pages`)

Direktlink (Team/Scope anpassen):  
`https://vercel.com/<team>/payday/settings/git`

### Alternative: GitHub Action (empfohlen bei hartnäckigem `main`)

Workflow [`.github/workflows/vercel-gh-pages.yml`](../.github/workflows/vercel-gh-pages.yml) deployt bei jedem Push auf **`gh-pages`**, sobald diese Secrets gesetzt sind:

- `VERCEL_TOKEN` — [Vercel → Account → Tokens](https://vercel.com/account/tokens)
- `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` — nach `npm run vercel:setup` + `vercel link` in `.vercel/project.json`

Ohne Secrets macht der Workflow **nichts** (exit 0, kein Fehler).

## Vercel-Projekt (Neu-Anlage)

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
