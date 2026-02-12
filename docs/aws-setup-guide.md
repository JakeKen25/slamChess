# Slam Chess on AWS: CloudShell-Only Setup Guide

This guide is for novice users and uses **AWS CloudShell for all shell-based configuration actions**.

> Scope rule for this guide: any command-line setup/config/deploy command is run in CloudShell.

---

## 1) What this deploy creates

The CDK stack deploys:

- Amazon DynamoDB table (`Games`) for state storage
- AWS Lambda handlers for game actions
- Amazon API Gateway HTTP API routes

At the end, you get an `ApiEndpoint` URL.

---

## 2) Prerequisites

- AWS account with permissions for CloudFormation, IAM, Lambda, API Gateway, and DynamoDB.
- Access to **AWS Console + CloudShell** in your target region.
- GitHub access to clone the repo.

No local AWS CLI configuration is required for setup/deploy in this workflow.

---

## 3) Open CloudShell in correct region

1. Sign in to AWS Console.
2. Choose target region (example: `us-east-2`).
3. Open **CloudShell**.

Verify tools:

```bash
aws --version
node --version
npm --version
git --version
```

---

## 4) Clone and install (CloudShell)

```bash
git clone https://github.com/JakeKen25/slamChess
cd slamChess
npm install
```

Confirm caller identity:

```bash
aws sts get-caller-identity
```

---

## 5) Build and bootstrap

Build first (required):

```bash
npm run build
```

Bootstrap using compiled CDK app entrypoint:

```bash
npx cdk bootstrap --app "node dist/infra/bin/deploy.js"
```

---

## 6) Deploy from CloudShell

Run deployment in verbose mode so failures are visible:

```bash
npm run cdk:deploy -- --require-approval never --verbose
```

If deployment fails, synthesize the template and retry:

```bash
npm run cdk:synth
npm run cdk:deploy -- --require-approval never
```

On success, copy:

- `SlamChessStack.ApiEndpoint`

Example format:

```text
https://abc123xyz.execute-api.us-east-2.amazonaws.com/
```

---

## 7) Verify API from CloudShell

Set endpoint from deployment output:

```bash
export API_BASE_URL="https://<api-id>.execute-api.<region>.amazonaws.com/"
```

Create game:

```bash
curl -i -X POST "$API_BASE_URL/games" -H "content-type: application/json"
```

From JSON response, copy `gameId` (UUID-like), then test:

```bash
curl -i "$API_BASE_URL/games/<gameId>"
curl -i -X POST "$API_BASE_URL/games/<gameId>/moves" -H "content-type: application/json" -d '{"from":"e2","to":"e4"}'
curl -i "$API_BASE_URL/games/<gameId>/history"
curl -i "$API_BASE_URL/games/<gameId>/legal-moves"
```

---

## 8) Play the game UI

The game UI is React/Vite (`apps/web`).

If running the dev server from CloudShell:

```bash
VITE_API_BASE_URL="$API_BASE_URL" npm run web:dev -- --host 0.0.0.0
```

Then open CloudShell port preview for `5173` and use the board:

- Click **New game**
- Click a piece to select
- Click a highlighted destination square to move
- Use **Refresh state** when needed

---

## 9) View CloudWatch logs (Lambda + API access)

This stack now writes:

- Lambda structured JSON logs (game lifecycle + move outcomes)
- HTTP API access logs for every request

From CloudShell, tail logs:

```bash
aws logs tail /aws/lambda/SlamChessStack-CreateGameFn --follow
aws logs tail /aws/lambda/SlamChessStack-SubmitMoveFn --follow
```

Find API access log group name and tail it:

```bash
aws logs describe-log-groups --log-group-name-prefix "/aws/vendedlogs/apis"
aws logs tail <api-access-log-group-name> --follow
```

Tip: run a `curl` request from section 7 while tailing to verify log flow.

---

## 10) Known CloudShell issues and fixes

### A) `ERR_UNKNOWN_FILE_EXTENSION` for `infra/bin/deploy.ts`
Use compiled app entrypoint:

```bash
npm run build
npx cdk bootstrap --app "node dist/infra/bin/deploy.js"
npm run cdk:deploy
```

### B) API returns 500 with `Cannot use import statement outside a module`
Update to latest repo and redeploy:

```bash
git pull
npm install
npm run cdk:deploy
```

Then re-test `POST /games` with `curl -i`.

### C) Wrong API base URL
Use `ApiEndpoint` from stack output, not account ID-based URL.

### D) 404 with `/games/1`
`gameId` is generated UUID-like string from `POST /games`; it is not numeric.

---

## 11) Cleanup to avoid charges

Destroy resources from CloudShell when done:

```bash
npx cdk destroy --app "node dist/infra/bin/deploy.js"
```

---

## 12) CloudShell-only quick runbook

```bash
git clone https://github.com/JakeKen25/slamChess
cd slamChess
npm install
npm run build
npx cdk bootstrap --app "node dist/infra/bin/deploy.js"
npm run cdk:deploy
export API_BASE_URL="<ApiEndpoint>"
curl -i -X POST "$API_BASE_URL/games" -H "content-type: application/json"
VITE_API_BASE_URL="$API_BASE_URL" npm run web:dev -- --host 0.0.0.0
```

