# Slam Chess

Tournament-ready chess-inspired game backend with deterministic slam mechanics.

## Features
- Pure deterministic rules engine: `applyMove(gameState, move) -> { newState, events }`
- Slam mechanics for rook/bishop/queen/pawn/knight/king attacks
- Self-check prevention, check/checkmate, castling support
- AWS backend: API Gateway + Lambda + DynamoDB
- IaC with AWS CDK
- Unit tests for rule edge cases + integration tests for API handlers

## Project layout
- `src/engine/`: platform-agnostic rules engine
- `src/backend/`: Lambda handlers + DynamoDB data access
- `infra/`: CDK stack
- `test/engine/`: rules unit tests
- `test/api/`: integration tests


## Detailed implementation guide
For a beginner-friendly, step-by-step implementation and deployment walkthrough, see **`IMPLEMENTATION_GUIDE.md`**.

## Setup
```bash
npm install
npm run build
npm test
```

## Local development
Rules engine can be imported from `src/engine/index.ts` and used in Node or transpiled for browser/Python bridge bindings.

## Deploy to AWS
Prerequisites:
- AWS credentials configured
- CDK bootstrap complete (`cdk bootstrap`)

Commands:
```bash
npm install
npm run build
npm run cdk:synth
npm run cdk:deploy
```

The deploy outputs the API endpoint.

## API endpoints
- `POST /games` Create game
- `GET /games/{gameId}` Get game state
- `POST /games/{gameId}/moves` Submit move body `{ "from": "E2", "to": "E4" }`
- `GET /games/{gameId}/history` List history/events
- `GET /games/{gameId}/legal-moves` List legal moves for current turn

## DynamoDB schema
Table `Games`:
- Partition key: `gameId` (string)
- Attribute `state` holds full serialized game state

## Notes
- No en passant
- Pawn promotions in slam landing are auto-queen
- Kings are never slammed/destroyed directly by slam
