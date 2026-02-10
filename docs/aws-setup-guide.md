# Slam Chess on AWS: Beginner Setup Guide

This guide walks you through deploying **Slam Chess** to your own AWS account using the repository’s CDK infrastructure.

It is written for first-time AWS users and now includes a full **AWS CloudShell** path, so you can deploy without using your own local machine for AWS tooling.

---

## 1) What you are deploying

This project deploys:

- **Amazon DynamoDB** table to store game states.
- **AWS Lambda** functions for game API handlers.
- **Amazon API Gateway (HTTP API)** routes for game operations.
- **AWS CDK stack** (`SlamChessStack`) that provisions all of the above.

After deployment, you get an API endpoint URL you can use from the included web client.

---

## 2) Two setup options (choose one)

You can follow either setup path:

1. **Option A: AWS CloudShell (recommended for beginners)**
   - Browser-based shell in AWS Console.
   - AWS credentials are already tied to your signed-in IAM identity.
   - No local AWS CLI setup required.
2. **Option B: Local machine**
   - Run all commands on your computer.
   - Requires local AWS CLI configuration.

> Important: You do **not** need to change any source code in this repo to use CloudShell.

---

## 3) Prerequisites

Before you start, make sure you have:

1. An **AWS account** with access to create IAM, Lambda, API Gateway, DynamoDB, and CloudFormation resources.
2. Access to one of:
   - **AWS CloudShell** in your target AWS region, or
   - A local machine with **Node.js 20+**, **npm**, and **Git**.
3. Permissions to run **CDK bootstrap/deploy** in your AWS account.

If using local machine only, also install and configure **AWS CLI v2**.

> Tip: Use a sandbox AWS account while learning to avoid accidental production costs.

---

## 4) Option A: CloudShell-first workflow

### 4.1 Open CloudShell

1. Sign in to AWS Console.
2. Switch to the region where you want to deploy (for example `us-east-1`).
3. Open **CloudShell** from the console toolbar.

### 4.2 Verify basic tools in CloudShell

```bash
aws --version
node --version
npm --version
git --version
```

If Node.js is missing or outdated in your CloudShell environment, install a recent Node version with your preferred method (for example `nvm`) before continuing.

### 4.3 Clone and install

```bash
git clone <your-repo-url>
cd slamChess
npm install
```

### 4.4 Confirm identity (CloudShell uses your console identity)

```bash
aws sts get-caller-identity
```

### 4.5 Build once before CDK commands

```bash
npm run build
```

This avoids runtime TypeScript loader issues in some environments (including CloudShell).

### 4.6 Bootstrap CDK (one-time per account/region)

```bash
npx cdk bootstrap
```

If you see `ERR_UNKNOWN_FILE_EXTENSION` for `infra/bin/deploy.ts`, run CDK against the compiled app instead:

```bash
npx cdk bootstrap --app "node dist/infra/bin/deploy.js"
```

### 4.7 Deploy

```bash
npm run cdk:deploy
```

If `npm run cdk:deploy` fails with the same TypeScript extension error, use:

```bash
npx cdk deploy --app "node dist/infra/bin/deploy.js"
```

When deployment completes, copy the `ApiEndpoint` output.

### 4.8 Verify API from CloudShell

```bash
export API_BASE_URL="https://<your-api-id>.execute-api.<region>.amazonaws.com"

curl -s -X POST "$API_BASE_URL/games" -H "content-type: application/json"
```

Then test additional endpoints (replace `<gameId>`):

```bash
curl -s "$API_BASE_URL/games/<gameId>"
curl -s -X POST "$API_BASE_URL/games/<gameId>/moves" \
  -H "content-type: application/json" \
  -d '{"from":"e2","to":"e4"}'
curl -s "$API_BASE_URL/games/<gameId>/history"
curl -s "$API_BASE_URL/games/<gameId>/legal-moves"
```

### 4.9 Use the frontend

The frontend can be run:

- on your local machine (`npm run web:dev`), pointing to the deployed AWS API endpoint, or
- in any environment where you can run Vite and access the browser URL.

Local example:

```bash
VITE_API_BASE_URL="https://<your-api-id>.execute-api.<region>.amazonaws.com" npm run web:dev
```

---

## 5) Option B: Local-machine workflow

If you prefer local setup, use this sequence.

### 5.1 Clone and install

```bash
git clone <your-repo-url>
cd slamChess
npm install
```

Optional quick verification:

```bash
npm run build
npm test
```

### 5.2 Configure AWS credentials (AWS CLI)

If this is your first setup:

```bash
aws configure
```

You will be prompted for:

- AWS Access Key ID
- AWS Secret Access Key
- Default region (example: `us-east-1`)
- Output format (use `json`)

Validate identity:

```bash
aws sts get-caller-identity
```

### 5.3 Build once before CDK commands

```bash
npm run build
```

### 5.4 Bootstrap CDK

```bash
npx cdk bootstrap
```

If you see `ERR_UNKNOWN_FILE_EXTENSION` for `infra/bin/deploy.ts`, use:

```bash
npx cdk bootstrap --app "node dist/infra/bin/deploy.js"
```

### 5.5 Deploy

```bash
npm run cdk:deploy
```

If deploy fails with the same TypeScript extension error, use:

```bash
npx cdk deploy --app "node dist/infra/bin/deploy.js"
```

On success, copy stack output `ApiEndpoint`.

---

## 6) Verify the API quickly

Set your deployed endpoint:

```bash
export API_BASE_URL="https://<your-api-id>.execute-api.<region>.amazonaws.com"
```

Create a game:

```bash
curl -s -X POST "$API_BASE_URL/games" -H "content-type: application/json"
```

You should receive JSON containing `gameId` and initial `state`.

Get game state:

```bash
curl -s "$API_BASE_URL/games/<gameId>"
```

Submit a move:

```bash
curl -s -X POST "$API_BASE_URL/games/<gameId>/moves" \
  -H "content-type: application/json" \
  -d '{"from":"e2","to":"e4"}'
```

List history:

```bash
curl -s "$API_BASE_URL/games/<gameId>/history"
```

List legal moves:

```bash
curl -s "$API_BASE_URL/games/<gameId>/legal-moves"
```

---

## 7) Run the included web frontend against AWS

In the repo root:

```bash
VITE_API_BASE_URL="$API_BASE_URL" npm run web:dev
```

Then open the Vite URL shown in terminal (usually `http://localhost:5173`).

Frontend basics:

- Click **New game**.
- Click a piece to select it.
- Click a highlighted square to move.
- Use **Refresh state** if needed.
- Review move/event timeline in the sidebar.

---

## 8) Common troubleshooting

### A) `cdk bootstrap` permission errors
Your IAM identity likely lacks one or more required permissions:

- CloudFormation create/update/describe
- IAM role/pass-role permissions for CDK assets
- S3/ECR permissions for CDK asset publishing

Use an admin role for initial setup if possible.

### B) Lambda code/handler errors after deploy
Most common cause: stack deployed before TypeScript build output was generated.

Fix:

```bash
npm run build
npm run cdk:deploy
```

### C) API returns 404 for game
You may be using the wrong `gameId`, or trying to fetch a game that was never created in this environment.

### D) Browser CORS/network issues
If you added custom domains or modified API Gateway, verify CORS settings and confirm frontend points to the correct API base URL.

### E) Region mismatch
Make sure your AWS Console/CloudShell region and your deployment target region are the same.

### F) CloudShell storage/session caveat
CloudShell has persistent home storage but session limits. If your session resets, return to the same region and rerun commands as needed.

### G) `ERR_UNKNOWN_FILE_EXTENSION` for `infra/bin/deploy.ts`
This is a known environment/runtime issue when CDK tries to execute the TypeScript app entrypoint directly.

Use the compiled JavaScript entrypoint instead:

```bash
npm run build
npx cdk bootstrap --app "node dist/infra/bin/deploy.js"
npx cdk deploy --app "node dist/infra/bin/deploy.js"
```

This workaround requires **no source-code changes** to the repository.

---

## 9) Cost and safety notes

Even small AWS resources can incur charges.

To minimize cost while learning:

- Use one region.
- Delete test stacks when not needed.
- Avoid repeated unused deployments.

When done, remove resources:

```bash
npx cdk destroy
```

Confirm stack deletion in CloudFormation before assuming all resources are gone.

---

## 10) Useful project commands reference

From repository root:

```bash
npm install
npm run build
npm test
npm run cdk:synth
npm run cdk:deploy
npm run web:dev
npm run web:build
```

---

## 11) Suggested first successful workflow (CloudShell)

1. Open AWS CloudShell in target region
2. `git clone <your-repo-url>`
3. `cd slamChess && npm install`
4. `aws sts get-caller-identity`
5. `npm run build`
6. `npx cdk bootstrap --app "node dist/infra/bin/deploy.js"`
7. `npx cdk deploy --app "node dist/infra/bin/deploy.js"`
8. Copy `ApiEndpoint`
9. Test `POST /games` with `curl`

If you can do that sequence end-to-end, your AWS deployment is working.
