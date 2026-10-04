# Bot-Schutz Stufe 1 — Reservierungs-API

## Was aktiv ist

| Route | Limit (IP) | Zusätzlich Session |
|-------|------------|-------------------|
| `GET /v1/availability` | 120 / 60 s | 80 / 60 s (`sessionId` Query) |
| `POST /v1/cart/sync` | 40 / 60 s, 8 / 10 s | 25 / 60 s, 5 / 10 s |
| `POST /v1/cart/heartbeat` | 90 / 60 s | 60 / 60 s |
| `POST /v1/cart/release` | 60 / 60 s | — |

- Speicher: Postgres `deck_rate_limit_buckets`, RPC `deck_rate_limit_check`
- Antwort bei Überschreitung: **HTTP 429** `{ ok: false, reason: "rate_limited", retryAfterSeconds }`
- **Session-ID:** max. 128 Zeichen, `[a-zA-Z0-9._-]+`
- **Client:** `reserveApi` / `reservationApi` Query-Override nur auf `localhost` / `127.0.0.1`

## Ops

- Limits testweise abschalten (nur Dev): Secret `DECK_RATE_LIMIT_DISABLED=true`
- Alte Buckets aufräumen (optional Cron/SQL): `SELECT deck_purge_rate_limit_buckets(86400);`

## Deploy

```bash
npx supabase db push
npx supabase functions deploy reservation-api --project-ref yoeehrdsrfwolzdtgmel
```

Stufe 2 (optional): Cloudflare Turnstile vor `/v1/cart/sync`.
