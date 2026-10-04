# Vercel MCP (Cursor Cloud Agent)

Offizielle Doku: [Vercel MCP](https://vercel.com/docs/agent-resources/vercel-mcp) · [Cursor MCP](https://cursor.com/docs/mcp)

## Warum der Agent „ohne MCP“ deployt

Cloud Agents nutzen MCP **nicht** automatisch aus `.cursor/mcp.json` im Repo. Du musst den Server im **Cursor-Dashboard** verbinden und **einmal OAuth** abschließen. Erst in **neuen Runs** stehen Vercel-Tools (Deployments, Redeploy, Logs) zur Verfügung.

## Einrichtung (Cloud Agent)

1. [cursor.com/agents](https://cursor.com/agents) → **MCP** (Dropdown) **oder** Dashboard → **Plugins & MCPs** (Team)
2. Server hinzufügen:
   - Global: `https://mcp.vercel.com`
   - **Projekt payday (empfohlen):** `https://mcp.vercel.com/1337wheels-design/payday`
3. Status **Needs login** → **Connect** → Vercel-Account autorisieren
4. Neuen Cloud-Agent-Run starten (dieser Run hat ggf. noch kein `vercel`-Namespace)

Repo-Spiegel für lokales Cursor: [`.cursor/mcp.json`](../.cursor/mcp.json)

## Was der Agent dann für payday tun kann

- Letztes Deployment / Production-Branch prüfen
- **Redeploy** auslösen (aktueller `main` mit `deck-shop/`, `vercel.json`)
- Build-Logs lesen (warum `/deck-shop/` 404)

Ziel-URL: https://1337wheels-design-payday.vercel.app/deck-shop/

## Fallback ohne MCP

| Weg | Voraussetzung |
|-----|----------------|
| `VERCEL_TOKEN` in **Cloud Agent Secrets** | [vercel.com/account/tokens](https://vercel.com/account/tokens) + `npm run vercel:deploy` |
| Dashboard | Git → `prompthaus`, Branch **`main`**, Redeploy |

## OAuth-Probleme (Cloud)

Cloud-Callback: `https://www.cursor.com/agents/mcp/oauth/callback`  
Wenn OAuth im Browser fehlschlägt („invalid redirect“), Desktop-Login reicht nicht — Vercel/Cursor müssen den Cloud-Callback allowlisten. Bis dahin: Token + CLI oder manuelles Redeploy.
