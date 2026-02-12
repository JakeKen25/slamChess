# Slam Chess on AWS: Full Deployment & Operations Guide

This guide walks through deploying **both backend API and multiplayer-ready web client** on AWS with minimal operational overhead.

It includes:
- Backend deploy (API Gateway + Lambda + DynamoDB via CDK)
- Frontend deploy (S3 + CloudFront)
- Multiplayer seat flow (`/join`, `x-player-id`)
- Validation and troubleshooting

---

## 1) Architecture (what gets deployed)

### Backend stack (CDK in this repo)
- **DynamoDB** table `Games` (`gameId` PK)
- **Lambda** handlers for:
  - `POST /games`
  - `POST /games/{gameId}/join`
  - `GET /games/{gameId}`
  - `POST /games/{gameId}/moves`
  - `GET /games/{gameId}/history`
  - `GET /games/{gameId}/legal-moves`
- **API Gateway HTTP API** (with CORS for `content-type` and `x-player-id`)

### Frontend hosting (recommended low-overhead)
- Build static web app from `apps/web`
- Host in **S3**
- Serve via **CloudFront**

---

## 2) Prerequisites

- AWS account + permissions for CloudFormation, IAM, Lambda, API Gateway, DynamoDB, S3, CloudFront.
- Node.js 20+ and npm.
- AWS CLI configured (`aws configure`) or CloudShell.

Optional but recommended:
- Dedicated AWS profile for this project.
- Separate AWS account/environment for dev vs prod.

---

## 3) Clone, install, test, and build

```bash
git clone https://github.com/JakeKen25/slamChess
cd slamChess
npm install
npm run test:integration
npm run build
npm run web:build
```

Notes:
- `npm run test:integration` validates API handler behavior for multiplayer join/turn checks.
- `npm run build` compiles backend and CDK app artifacts.

---

## 4) Bootstrap CDK

```bash
npx cdk bootstrap --app "node dist/infra/bin/deploy.js"
```

If using an AWS profile:

```bash
AWS_PROFILE=<profile> npx cdk bootstrap --app "node dist/infra/bin/deploy.js"
```

---

## 5) Deploy backend stack

### Default safe mode (recommended)
By default, DynamoDB table uses:
- `RETAIN` removal policy (protects data on stack delete)
- Point-in-time recovery enabled

Deploy:

```bash
npm run cdk:deploy
```

### Ephemeral/dev teardown mode (optional)
If you want stack destroy to also delete DynamoDB table:

```bash
npx cdk deploy --app "node dist/infra/bin/deploy.js" -c destroyOnRemoval=true
```

---

## 6) Capture API endpoint

After deploy, copy output:
- `SlamChessStack.ApiEndpoint`

Set env var:

```bash
export API_BASE_URL="https://<api-id>.execute-api.<region>.amazonaws.com"
```

(Do not append trailing slash.)

---

## 7) Validate multiplayer API flow

### 7.1 Create game

```bash
curl -s -X POST "$API_BASE_URL/games" -H "content-type: application/json"
```

Capture `gameId`.

### 7.2 Join white and black seats

```bash
curl -s -X POST "$API_BASE_URL/games/<gameId>/join" \
  -H "content-type: application/json" \
  -d '{"color":"white","playerId":"player-white"}'

curl -s -X POST "$API_BASE_URL/games/<gameId>/join" \
  -H "content-type: application/json" \
  -d '{"color":"black","playerId":"player-black"}'
```

### 7.3 Submit move as current-turn player only

```bash
curl -s -X POST "$API_BASE_URL/games/<gameId>/moves" \
  -H "content-type: application/json" \
  -H "x-player-id: player-white" \
  -d '{"from":"e2","to":"e4"}'
```

If wrong player moves, backend returns `403`.

### 7.4 Read state/history/legal moves

```bash
curl -s "$API_BASE_URL/games/<gameId>"
curl -s "$API_BASE_URL/games/<gameId>/history"
curl -s "$API_BASE_URL/games/<gameId>/legal-moves"
```

---

## 8) Frontend deployment (S3 + CloudFront)

Build frontend with your deployed API endpoint:

```bash
VITE_API_BASE_URL="$API_BASE_URL" npm run web:build
```

Create S3 bucket (example):

```bash
aws s3 mb s3://slamchess-web-<unique-suffix>
```

Upload static files:

```bash
aws s3 sync apps/web/dist s3://slamchess-web-<unique-suffix> --delete
```

Create CloudFront distribution (console is easiest):
1. Origin = S3 bucket.
2. Default root object = `index.html`.
3. Enable HTTPS.
4. Add custom error responses for SPA routing:
   - 403 -> `/index.html` (200)
   - 404 -> `/index.html` (200)

After CloudFront deploys, open the distribution domain and play from two browser sessions.

---

## 9) Multiplayer behavior in production

- Each browser session stores its own `playerId` in local storage.
- Player must claim a seat via **Join White** / **Join Black**.
- Only player bound to current turn can move.
- UI auto-refreshes every 1.5s to provide near-real-time synchronization.
- Backend uses optimistic concurrency (`version`) to reject stale concurrent writes.

---

## 10) Minimal-overhead AWS operating guidance

- Use one stack per environment: `slamchess-dev`, `slamchess-prod`.
- Keep Lambda runtime at Node.js 20.x.
- Use PAY_PER_REQUEST DynamoDB (already configured).
- Keep CloudFront caching on static assets; invalidate only when needed.
- Prefer API Gateway + Lambda logs in CloudWatch for debugging; no extra services needed.

---

## 11) Troubleshooting

### CORS errors in browser
- Ensure requests include only allowed headers (`content-type`, `x-player-id`).
- Confirm frontend is calling correct `VITE_API_BASE_URL`.

### `x-player-id header required`
- Client must include `x-player-id` for `/moves`.

### `No white/black player has joined yet`
- Claim seat first via `/join`.

### `Only the <color> player may move`
- Wrong seat is attempting current turn move.

### `Game updated by another request`
- Expected under simultaneous moves; refresh and retry.

### CDK deploy fails with TypeScript entrypoint errors
- Always build first and deploy compiled app:

```bash
npm run build
npx cdk deploy --app "node dist/infra/bin/deploy.js"
```

---

## 12) Cleanup

Destroy stack:

```bash
npx cdk destroy --app "node dist/infra/bin/deploy.js"
```

If deployed with default (safe) retention, DynamoDB table remains and must be removed manually when no longer needed.
