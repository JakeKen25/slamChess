# Slam Chess on AWS: Beginner Setup Guide

This guide walks you through deploying **Slam Chess** to your own AWS account using the repository’s CDK infrastructure.

It is written for first-time AWS users and assumes you are running commands from the repository root.

---

## 1) What you are deploying

This project deploys:

- **Amazon DynamoDB** table to store game states.
- **AWS Lambda** functions for game API handlers.
- **Amazon API Gateway (HTTP API)** routes for game operations.
- **AWS CDK stack** (`SlamChessStack`) that provisions all of the above.

After deployment, you get an API endpoint URL you can use from the included web client.

---

## 2) Prerequisites

Before you start, make sure you have:

1. An **AWS account** with access to create IAM, Lambda, API Gateway, DynamoDB, and CloudFormation resources.
2. A local machine with:
   - **Node.js 20+**
   - **npm**
   - **Git**
3. The **AWS CLI v2** installed and configured.
4. Permissions to run **CDK bootstrap/deploy** in your AWS account.

> Tip: Use a sandbox AWS account while learning to avoid accidental production costs.

---

## 3) Clone and install the project

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

---

## 4) Configure AWS credentials (AWS CLI)

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

If this command succeeds, your credentials are working.

---

## 5) Bootstrap CDK (one-time per account/region)

From the repo root:

```bash
npx cdk bootstrap
```

Or with npm script support for synth/deploy workflow:

```bash
npm run cdk:synth
```

If bootstrap fails with permission issues, your AWS user/role may be missing CloudFormation or IAM permissions.

---

## 6) Build TypeScript output

The CDK stack expects compiled assets in `dist/`.

```bash
npm run build
```

This compiles source used by Lambda and infrastructure entrypoints.

---

## 7) Deploy the AWS stack

Deploy with:

```bash
npm run cdk:deploy
```

During deploy, CDK may ask for confirmation. Approve when prompted.

On success, note the stack output:

- `ApiEndpoint` (your API base URL)

Save this URL; you will use it in the web client configuration.

---

## 8) Verify the API quickly

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

## 9) Run the included web frontend against AWS

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

## 10) Common troubleshooting

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
Make sure your AWS CLI default region matches where you deployed the stack.

---

## 11) Cost and safety notes

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

## 12) Useful project commands reference

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

## 13) Suggested first successful workflow

1. `npm install`
2. `aws configure`
3. `aws sts get-caller-identity`
4. `npx cdk bootstrap`
5. `npm run build`
6. `npm run cdk:deploy`
7. Copy `ApiEndpoint`
8. `VITE_API_BASE_URL="..." npm run web:dev`
9. Create a game in browser and submit one move

If you can do that sequence end-to-end, your AWS deployment is working.
