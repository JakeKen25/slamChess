import { APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuid } from 'uuid';
import { applyMove, initialState, listLegalMoves } from '../../engine/index.js';
import { GameRepository } from '../db/repository.js';

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

type Move = { from: string; to: string };

function isMove(value: unknown): value is Move {
  if (!value || typeof value !== 'object') return false;
  const { from, to } = value as Partial<Move>;
  return typeof from === 'string' && typeof to === 'string';
}

function isIllegalMoveError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return ['No piece on source square', 'Not your turn', 'Illegal move', 'Game is over'].includes(error.message);
}

export function handlers(repo: Pick<GameRepository, 'create' | 'get' | 'save'>) {
  return {
    createGame: async () => {
      const gameId = uuid();
      const state = initialState();
      await repo.create(gameId, state);
      return json(201, { gameId, state });
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

      try {
        const { newState, events } = applyMove(current, parsedBody);
        await repo.save(gameId, newState);
        return json(200, { gameId, state: newState, events });
      } catch (error) {
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
