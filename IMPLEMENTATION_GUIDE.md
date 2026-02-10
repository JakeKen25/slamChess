# Slam Chess Implementation Guide (Beginner Friendly)

This guide explains **what is built**, **how it works**, and **how to run it** step-by-step.
If you are new to TypeScript, AWS Lambda, or chess engines, start here.

---

## 1) What this repository contains

This project has three major parts:

1. **Rules Engine** (`src/engine/`)
   - A pure deterministic game engine with the function:
   - `applyMove(gameState, move) => { newState, events }`
   - No HTTP/AWS dependencies.

2. **Backend API** (`src/backend/`)
   - Lambda handlers that call the rules engine.
   - Game state is persisted to DynamoDB.

3. **Infrastructure as Code** (`infra/`)
   - AWS CDK code that creates API Gateway, Lambda functions, and DynamoDB.

---

## 2) Requirements before you begin

### Local requirements
- Node.js 20+
- npm 9+
- TypeScript toolchain (installed through npm dependencies)

### AWS requirements (for deployment)
- AWS account
- AWS CLI configured (`aws configure`)
- CDK bootstrap done once per account/region:
  ```bash
  npx cdk bootstrap
  ```

---

## 3) Repository structure explained

```text
src/
  engine/
    types.ts        # Core game types and event definitions
    board.ts        # Board helpers + initial state
    rules.ts        # Move legality + slam mechanics + check/checkmate
    index.ts        # Public exports

  backend/
    db/repository.ts             # DynamoDB data layer
    handlers/
      factory.ts                 # Shared handler implementations
      createGame.ts              # POST /games
      getGame.ts                 # GET /games/{gameId}
      submitMove.ts              # POST /games/{gameId}/moves
      listHistory.ts             # GET /games/{gameId}/history
      legalMoves.ts              # GET /games/{gameId}/legal-moves

infra/
  bin/deploy.ts                  # CDK app entrypoint
  lib/slam-chess-stack.ts        # API + Lambda + DynamoDB stack

test/
  engine/rulesEngine.test.ts     # Unit tests for engine edge cases
  api/handlers.test.ts           # Integration-style handler tests

openapi.yaml                     # API endpoint definition skeleton
README.md                        # High-level quickstart
```

---

## 4) How the engine represents game state

A `GameState` includes:
- `board`: map from squares (`"A1"`...`"H8"`) to pieces.
- `turn`: whose turn it is (`white` or `black`).
- `castlingRights`: king/queen side rights per color.
- `history`: array of previous moves + events.
- optional `gameOver` result.

Pieces are defined by:
- `type`: king, queen, rook, bishop, knight, pawn.
- `color`: white or black.

Events emitted from moves:
- `Moved`
- `Slammed`
- `Destroyed`
- `Promotion`
- `Check`
- `Checkmate`

---

## 5) Slam mechanics in plain language

When an attack happens:
1. Attacker moves into target square (like normal capture movement).
2. Target is pushed in a direction/amount based on attacker type.
3. If pushed piece crosses/lands on an occupied square, pushed piece is destroyed.
4. If pushed piece goes off-board, it is destroyed.
5. If a slammed pawn survives and lands on back rank, it auto-promotes to queen.

Special rules:
- Knight push distance is always 3 using the final-step direction logic.
- Kings are not slam-pushed as targets.
- King attacks push adjacent enemy by one square.
- Legal-move filtering rejects moves that leave own king in check.

---

## 6) Run locally (step-by-step)

From repo root:

```bash
npm install
npm run build
npm test
```

Helpful split commands:

```bash
npm run test:unit
npm run test:integration
```

If install fails due environment policy/network restrictions, run these commands in a normal environment (local machine/CI with npm access).

---

## 7) API usage walkthrough

### 7.1 Create game
```bash
curl -X POST "$API_BASE/games"
```
Response returns `gameId` and initial `state`.

### 7.2 Get state
```bash
curl "$API_BASE/games/<gameId>"
```

### 7.3 List legal moves
```bash
curl "$API_BASE/games/<gameId>/legal-moves"
```

### 7.4 Submit move
```bash
curl -X POST "$API_BASE/games/<gameId>/moves" \
  -H "content-type: application/json" \
  -d '{"from":"E2","to":"E4"}'
```

### 7.5 Fetch move history
```bash
curl "$API_BASE/games/<gameId>/history"
```

---

## 8) Deploy to AWS with CDK

1. Install dependencies and compile:
   ```bash
   npm install
   npm run build
   ```
2. Synthesize CloudFormation:
   ```bash
   npm run cdk:synth
   ```
3. Deploy:
   ```bash
   npm run cdk:deploy
   ```
4. Copy the `ApiEndpoint` output and set:
   ```bash
   export API_BASE="<that-endpoint>"
   ```

---

## 9) How tests are organized

### Engine tests (`test/engine/rulesEngine.test.ts`)
Validates:
- Slam distance/direction
- Off-board destruction
- Collision destruction
- Knight slam direction
- Pawn slam promotion
- Castling constraints
- Illegal self-check
- Checkmate event emission

### API tests (`test/api/handlers.test.ts`)
Validates:
- Create game
- Fetch game
- List legal moves
- Submit move
- History updates

---

## 10) Common troubleshooting

### `npm install` fails with 403
Your environment blocks npm registry access. Use a machine/CI environment that can access `registry.npmjs.org`.

### `cdk deploy` fails with bootstrap error
Run:
```bash
npx cdk bootstrap
```
for the target account/region first.

### Lambda says module not found
Ensure you compiled first:
```bash
npm run build
```
The CDK stack packages from `dist/src`.

---

## 11) Suggested next improvements

- Add a web frontend (board rendering + piece interaction + move animation).
- Expand `openapi.yaml` schemas for stronger client generation.
- Add stronger runtime validation in handlers for bad input and clearer error codes.
- Add CI (lint + test + synth checks).

---

## 12) Quick checklist for a novice

- [ ] Install Node.js 20+
- [ ] Run `npm install`
- [ ] Run `npm run build`
- [ ] Run `npm test`
- [ ] Configure AWS credentials
- [ ] Run `npx cdk bootstrap`
- [ ] Run `npm run cdk:deploy`
- [ ] Test API with curl

If you complete this checklist, the project is runnable end-to-end.
