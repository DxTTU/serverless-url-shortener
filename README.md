# snip.ly — Serverless URL Shortener

A production-style URL shortener running **100% serverless on AWS**: two Lambda
functions behind an API Gateway HTTP API, with mappings + click counts in
DynamoDB. Zero servers, pay-per-request — it costs $0 when nobody uses it.

## Architecture

```
            ┌─────────────┐
            │   Browser   │
            └──────┬──────┘
                   │  POST /shorten   GET /{code}
                   ▼
        ┌──────────────────────┐
        │  API Gateway (HTTP)  │
        └──────┬─────────┬─────┘
               │         │
               ▼         ▼
     ┌─────────────┐ ┌──────────────┐
     │ shorten     │ │ redirect     │
     │ (Lambda)    │ │ (Lambda)     │
     └──────┬──────┘ └──────┬───────┘
            │               │ get + click counter
            ▼               ▼
     ┌────────────────────────────┐
     │  DynamoDB (url-mappings)   │
     │  PK: code | url | clicks   │
     └────────────────────────────┘
```

## Features

- `POST /shorten` → `{ "url": "https://…" }` returns a 6-char short code (201)
- `GET /{code}` → 301 redirect to the original URL, 404 for unknown codes
- Click counter on every redirect (`ADD clicks :inc`)
- URL validation, collision-safe code generation (`attribute_not_exists` guard)
- CORS enabled, so the static frontend can call the API directly
- Minimal dark-mode frontend in `frontend/` — just open `index.html` or host it
  on S3/GitHub Pages

## Project structure

```
├── template.yaml            # AWS SAM: API Gateway + 2 Lambdas + DynamoDB
├── src/
│   ├── shorten.py           # POST /shorten handler
│   ├── redirect.py          # GET /{code} handler
│   └── requirements.txt
├── frontend/
│   ├── index.html           # UI
│   ├── app.js
│   └── config.js            # ← paste your API URL here after deploy
├── tests/
│   └── test_shorten.py      # unit tests (no AWS needed)
└── .github/workflows/
    └── deploy.yml           # CI/CD: SAM deploy on push to main
```

## Deploy it yourself

Prereqs: [AWS CLI](https://aws.amazon.com/cli/) + [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
configured with your credentials (`aws configure`).

```bash
sam build
sam deploy --guided        # first time: accept defaults, note the ApiUrl output
```

Then paste the `ApiUrl` into `frontend/config.js`:

```js
window.API_BASE_URL = "https://abc123.execute-api.ap-south-1.amazonaws.com";
```

Test it:

```bash
curl -X POST https://<api-url>/shorten \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://github.com"}'
# → {"code":"aB3xYz","url":"https://github.com"}

curl -i https://<api-url>/aB3xYz
# → HTTP/1.1 301 … Location: https://github.com
```

Everything fits in the AWS free tier (1M Lambda requests + 25 GB DynamoDB free
every month).

## CI/CD

`.github/workflows/deploy.yml` auto-deploys on every push to `main` that touches
`src/` or `template.yaml`. Setup (one time):

1. In AWS IAM, create a role with `AdministratorAccess` (or scoped-down
   deploy permissions) trusted by GitHub's OIDC provider
   (`token.actions.githubusercontent.com`).
2. Add the role ARN as a repo secret named `AWS_DEPLOY_ROLE_ARN`.

## Ideas to extend

- Custom short codes (`POST /shorten` with `"code": "my-link"`)
- Expiry TTL on links (DynamoDB TTL attribute)
- Per-link analytics dashboard (clicks over time)
- Rate limiting with API Gateway usage plans

Built with ☁️ by [Dhatrinath Lade](https://github.com/DxTTU)
