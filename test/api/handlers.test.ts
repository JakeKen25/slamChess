import { handlers } from '../../src/backend/handlers/factory.js';
import { GameState } from '../../src/engine/types.js';

class InMemoryRepo {
  map = new Map<string, GameState>();
  async create(id: string, state: GameState) { this.map.set(id, state); }
  async get(id: string) { return this.map.get(id); }
  async save(id: string, state: GameState, expectedVersion?: number) {
    const current = this.map.get(id);
    if (typeof expectedVersion === 'number' && current && current.version !== expectedVersion) {
      const error = new Error('Version mismatch');
      error.name = 'ConditionalCheckFailedException';
      throw error;
    }
    this.map.set(id, state);
  }
}

describe('API handlers', () => {
  test('create/get/list legal moves flow', async () => {
    const repo = new InMemoryRepo();
    const api = handlers(repo as any);
    const created = await api.createGame();
    expect(created.statusCode).toBe(201);
    const body = JSON.parse(created.body);
    const gameId = body.gameId;

    const fetched = await api.getGame({ pathParameters: { gameId } } as any);
    expect(fetched.statusCode).toBe(200);

    const legal = await api.legalMoves({ pathParameters: { gameId } } as any);
    expect(legal.statusCode).toBe(200);
    expect(JSON.parse(legal.body).legalMoves.length).toBeGreaterThan(0);
  });

  test('submit move updates history endpoint', async () => {
    const repo = new InMemoryRepo();
    const api = handlers(repo as any);
    const created = await api.createGame();
    const gameId = JSON.parse(created.body).gameId;

    const joinedWhite = await api.joinGame({
      pathParameters: { gameId },
      body: JSON.stringify({ color: 'white', playerId: 'white-1' })
    } as any);
    expect(joinedWhite.statusCode).toBe(200);

    const moved = await api.submitMove({
      pathParameters: { gameId },
      headers: { 'x-player-id': 'white-1' },
      body: JSON.stringify({ from: 'E2', to: 'E4' })
    } as any);
    expect(moved.statusCode).toBe(200);

    const history = await api.listHistory({ pathParameters: { gameId } } as any);
    expect(history.statusCode).toBe(200);
    expect(JSON.parse(history.body).history.length).toBe(1);
  });

  test('submitMove returns 400 for malformed JSON body', async () => {
    const repo = new InMemoryRepo();
    const api = handlers(repo as any);
    const created = await api.createGame();
    const gameId = JSON.parse(created.body).gameId;

    await api.joinGame({
      pathParameters: { gameId },
      body: JSON.stringify({ color: 'white', playerId: 'w1' })
    } as any);

    const response = await api.submitMove({
      pathParameters: { gameId },
      headers: { 'x-player-id': 'w1' },
      body: '{"from":"E2","to":"E4"'
    } as any);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toBe('Invalid JSON body');
  });

  test('submitMove returns conflict status for illegal move errors', async () => {
    const repo = new InMemoryRepo();
    const api = handlers(repo as any);
    const created = await api.createGame();
    const gameId = JSON.parse(created.body).gameId;

    await api.joinGame({
      pathParameters: { gameId },
      body: JSON.stringify({ color: 'white', playerId: 'w1' })
    } as any);

    const response = await api.submitMove({
      pathParameters: { gameId },
      headers: { 'x-player-id': 'w1' },
      body: JSON.stringify({ from: 'E3', to: 'E4' })
    } as any);

    expect([400, 409]).toContain(response.statusCode);
    expect(JSON.parse(response.body).error).toBe('No piece on source square');
  });

  test('submitMove returns client error when game is already over', async () => {
    const repo = new InMemoryRepo();
    const api = handlers(repo as any);
    const created = await api.createGame();
    const gameId = JSON.parse(created.body).gameId;

    await api.joinGame({
      pathParameters: { gameId },
      body: JSON.stringify({ color: 'white', playerId: 'w1' })
    } as any);

    const state = await repo.get(gameId);
    state!.gameOver = { winner: 'white', reason: 'checkmate' };
    await repo.save(gameId, state!);

    const response = await api.submitMove({
      pathParameters: { gameId },
      headers: { 'x-player-id': 'w1' },
      body: JSON.stringify({ from: 'E2', to: 'E4' })
    } as any);

    expect(response.statusCode).toBe(409);
    expect(JSON.parse(response.body).error).toBe('Game is over');
  });

  test('seat join and turn ownership are enforced', async () => {
    const repo = new InMemoryRepo();
    const api = handlers(repo as any);
    const created = await api.createGame();
    const gameId = JSON.parse(created.body).gameId;

    const whiteJoin = await api.joinGame({
      pathParameters: { gameId },
      body: JSON.stringify({ color: 'white', playerId: 'w1' })
    } as any);
    expect(whiteJoin.statusCode).toBe(200);

    const blackJoin = await api.joinGame({
      pathParameters: { gameId },
      body: JSON.stringify({ color: 'black', playerId: 'b1' })
    } as any);
    expect(blackJoin.statusCode).toBe(200);

    const wrongTurnMove = await api.submitMove({
      pathParameters: { gameId },
      headers: { 'x-player-id': 'b1' },
      body: JSON.stringify({ from: 'E7', to: 'E5' })
    } as any);
    expect(wrongTurnMove.statusCode).toBe(403);

    const whiteMove = await api.submitMove({
      pathParameters: { gameId },
      headers: { 'x-player-id': 'w1' },
      body: JSON.stringify({ from: 'E2', to: 'E4' })
    } as any);
    expect(whiteMove.statusCode).toBe(200);
  });

  test('joining an occupied seat is rejected', async () => {
    const repo = new InMemoryRepo();
    const api = handlers(repo as any);
    const created = await api.createGame();
    const gameId = JSON.parse(created.body).gameId;

    const first = await api.joinGame({
      pathParameters: { gameId },
      body: JSON.stringify({ color: 'white', playerId: 'w1' })
    } as any);
    expect(first.statusCode).toBe(200);

    const second = await api.joinGame({
      pathParameters: { gameId },
      body: JSON.stringify({ color: 'white', playerId: 'w2' })
    } as any);
    expect(second.statusCode).toBe(409);
  });
});
