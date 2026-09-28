# snip.ly — Serverless URL Shortener

A production-style URL shortener running **100% serverless**. Paste a long URL,
get a short link with click tracking — zero servers, $0 when idle.

🚀 **Live demo:** https://snip-ly.sniplyapp.workers.dev

## How it works (live deployment)

```
            ┌─────────────┐
            │   Browser   │  (UI served by the Worker itself)
            └──────┬──────┘
                   │  POST /shorten   GET /{code}
                   ▼
        ┌──────────────────────┐
        │ Cloudflare Worker    │
        │  (single function,   │
        │   routes both APIs)  │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Workers KV (URLS)   │
        │  code -> {url, clicks}│
        └──────────────────────┘
```

## Features

- `POST /shorten` → `{ "url": "https://…" }` returns a 6-char short code (201)
- `GET /{code}` → 301 redirect to the original URL, 404 for unknown codes
- Click counter on every redirect
- URL validation, collision-safe code generation
- CORS enabled
- Dark-mode web UI served straight from the Worker — no separate hosting needed

## Project structure

```
├── cloudflare/
│   ├── worker.js        # <-- the live one: UI + API + KV (Cloudflare Workers)
│   └── wrangler.toml    # wrangler config for CLI deploys
├── src/
│   ├── shorten.py       # AWS version: POST /shorten Lambda
│   ├── redirect.py      # AWS version: GET /{code} Lambda
│   └── requirements.txt
├── gcp/
│   ├── main.py          # GCP version: Cloud Function (gen2) + Firestore
│   └── requirements.txt
├── template.yaml        # AWS SAM: API Gateway + 2 Lambdas + DynamoDB
├── frontend/            # standalone static UI (used by the AWS/GCP versions)
├── tests/
│   └── test_shorten.py  # unit tests (no cloud needed)
```

Three cloud ports, one project: **Cloudflare** (live), **AWS** (Lambda + API
Gateway + DynamoDB via SAM), **GCP** (Cloud Functions gen2 + Firestore).

## Deploy it yourself (Cloudflare — free, no card needed)

**Dashboard (easiest):**
1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) (free plan)
2. Workers & Pages → Create Worker → name it `snip-ly` → Deploy
3. Edit code → paste in `cloudflare/worker.js` → Save and deploy
4. Storage & Databases → KV → create namespace `URLS`
5. Worker → Settings → Bindings → add KV namespace binding, variable name `URLS`
6. Redeploy. Done — your `*.workers.dev` URL is live.

**CLI:**
```bash
npm i -g wrangler
wrangler kv:namespace create URLS        # paste the id into wrangler.toml
wrangler deploy
```

Test it:
```bash
curl -X POST https://<your-worker>.workers.dev/shorten \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://github.com"}'
# → {"code":"aB3xYz","url":"https://github.com"}
```

Free tier covers it: 100k requests/day on Workers, 100k KV reads/day.

## The AWS / GCP versions

- **AWS:** `sam build && sam deploy --guided` (needs AWS credentials; fits the
  free tier — 1M Lambda requests + 25 GB DynamoDB free monthly). Paste the
  `ApiUrl` output into `frontend/config.js`.
- **GCP:** deploy `gcp/main.py` as a Cloud Function gen2 with a Firestore
  Native database (needs an active billing account on the GCP project, though
  usage stays inside the free tier).

## Ideas to extend

- Custom short codes (`POST /shorten` with `"code": "my-link"`)
- Link expiry (KV `expirationTtl`)
- Per-link analytics dashboard (clicks over time)
- Rate limiting per IP

Built with ☁️ by [Dhatrinath Lade](https://github.com/DxTTU)
