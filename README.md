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
- `apps/web/`: React + Vite frontend client

## Setup
```bash
npm install
npm run build
npm test
```

## Local development
Rules engine can be imported from `src/engine/index.ts` and used in Node or transpiled for browser/Python bridge bindings.

### Frontend setup (`apps/web`)
The web client uses React + Vite and talks to the Slam Chess API.

```bash
npm install
npm run web:dev
```

Environment variable:
- `VITE_API_BASE_URL` — base URL for backend API (default `http://localhost:3000`).

Examples:

```bash
# macOS/Linux
VITE_API_BASE_URL=http://localhost:3000 npm run web:dev

# Windows PowerShell
$env:VITE_API_BASE_URL="http://localhost:3000"; npm run web:dev
```

Build frontend:

```bash
npm run web:build
```

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
- `POST /games/{gameId}/join` Join as white or black with body `{ "color": "white"|"black", "playerId"?: "client-id" }`
- `POST /games/{gameId}/moves` Submit move body `{ "from": "E2", "to": "E4" }` and header `x-player-id`
- `GET /games/{gameId}/history` List history/events
- `GET /games/{gameId}/legal-moves` List legal moves for current turn

## Multiplayer behavior
- A game has two seats (`white`, `black`). Clients must claim a seat before moving.
- Only the player ID assigned to the current turn can submit moves.
- Move writes are version-checked to prevent simultaneous requests from corrupting state.
- Web UI auto-refreshes every 1.5 seconds for near-real-time updates.

## DynamoDB schema
Table `Games`:
- Partition key: `gameId` (string)
- Attribute `state` holds full serialized game state

## Notes
- No en passant
- Pawn promotions in slam landing are auto-queen
- Kings are never slammed/destroyed directly by slam
