import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuid } from 'uuid';
import { applyMove, initialState, listLegalMoves } from '../../engine/index.js';
import { Color } from '../../engine/types.js';
import { GameRepository } from '../db/repository.js';

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

type Move = { from: string; to: string };
type JoinRequest = { color: Color; playerId?: string };

function isJoinRequest(value: unknown): value is JoinRequest {
  if (!value || typeof value !== 'object') return false;
  const { color, playerId } = value as Partial<JoinRequest>;
  return (color === 'white' || color === 'black') && (playerId === undefined || typeof playerId === 'string');
}

function isMove(value: unknown): value is Move {
  if (!value || typeof value !== 'object') return false;
  const { from, to } = value as Partial<Move>;
  return typeof from === 'string' && typeof to === 'string';
}

function isIllegalMoveError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return ['No piece on source square', 'Not your turn', 'Illegal move', 'Game is over'].includes(error.message);
}

function isConditionalCheckFailed(error: unknown): boolean {
  return error instanceof Error && error.name === 'ConditionalCheckFailedException';
}

function headerValue(event: APIGatewayProxyEventV2, key: string): string | undefined {
  const direct = event.headers[key];
  if (typeof direct === 'string') return direct;
  return event.headers[key.toLowerCase()];
}

export function handlers(repo: Pick<GameRepository, 'create' | 'get' | 'save'>) {
  return {
    createGame: async () => {
      const gameId = uuid();
      const state = initialState();
      await repo.create(gameId, state);
      return json(201, { gameId, state });
    },
    joinGame: async (event: APIGatewayProxyEventV2) => {
      const gameId = event.pathParameters?.gameId;
      if (!gameId || !event.body) return json(400, { error: 'gameId and body required' });
      const state = await repo.get(gameId);
      if (!state) return json(404, { error: 'Not found' });

      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(event.body);
      } catch {
        return json(400, { error: 'Invalid JSON body' });
      }

      if (!isJoinRequest(parsedBody)) {
        return json(400, { error: 'Invalid join shape' });
      }

      const playerId = parsedBody.playerId?.trim() || uuid();
      const existing = state.players[parsedBody.color];
      if (existing && existing !== playerId) {
        return json(409, { error: `Seat ${parsedBody.color} already taken` });
      }

      if (existing === playerId) {
        return json(200, { gameId, state, playerId, color: parsedBody.color });
      }

      const nextState = {
        ...state,
        players: { ...state.players, [parsedBody.color]: playerId },
        version: state.version + 1
      };

      try {
        await repo.save(gameId, nextState, state.version);
      } catch (error) {
        if (!isConditionalCheckFailed(error)) {
          return json(500, { error: 'Internal server error' });
        }
        return json(409, { error: 'Game was updated by another request. Please retry join.' });
      }
      return json(200, { gameId, state: nextState, playerId, color: parsedBody.color });
    },
    getGame: async (event: APIGatewayProxyEventV2) => {
      const gameId = event.pathParameters?.gameId;
      if (!gameId) return json(400, { error: 'gameId required' });
      const state = await repo.get(gameId);
      if (!state) return json(404, { error: 'Not found' });
      return json(200, { gameId, state });
    },
    submitMove: async (event: APIGatewayProxyEventV2) => {
      const gameId = event.pathParameters?.gameId;
      if (!gameId || !event.body) return json(400, { error: 'gameId and body required' });
      const current = await repo.get(gameId);
      if (!current) return json(404, { error: 'Not found' });

      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(event.body);
      } catch {
        return json(400, { error: 'Invalid JSON body' });
      }

      if (!isMove(parsedBody)) return json(400, { error: 'Invalid move shape' });

      const playerId = headerValue(event, 'x-player-id');
      if (typeof playerId !== 'string' || !playerId.trim()) {
        return json(401, { error: 'x-player-id header required' });
      }
      const expectedPlayer = current.players[current.turn];
      if (!expectedPlayer) {
        return json(409, { error: `No ${current.turn} player has joined yet` });
      }
      if (expectedPlayer !== playerId.trim()) {
        return json(403, { error: `Only the ${current.turn} player may move` });
      }

      try {
        const { newState, events } = applyMove(current, parsedBody);
        await repo.save(gameId, newState, current.version);
        return json(200, { gameId, state: newState, events });
      } catch (error) {
        if (isConditionalCheckFailed(error)) {
          return json(409, { error: 'Game updated by another request. Refresh and retry.' });
        }
        if (isIllegalMoveError(error)) {
          return json(409, { error: (error as Error).message });
        }
        return json(500, { error: 'Internal server error' });
      }
    },
    listHistory: async (event: APIGatewayProxyEventV2) => {
      const gameId = event.pathParameters?.gameId;
      if (!gameId) return json(400, { error: 'gameId required' });
      const state = await repo.get(gameId);
      if (!state) return json(404, { error: 'Not found' });
      return json(200, { gameId, history: state.history });
    },
    legalMoves: async (event: APIGatewayProxyEventV2) => {
      const gameId = event.pathParameters?.gameId;
      if (!gameId) return json(400, { error: 'gameId required' });
      const state = await repo.get(gameId);
      if (!state) return json(404, { error: 'Not found' });
      return json(200, { gameId, legalMoves: listLegalMoves(state) });
    }
  };
}
