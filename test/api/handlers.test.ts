import { handlers } from '../../src/backend/handlers/factory.js';
import { GameState } from '../../src/engine/types.js';

class InMemoryRepo {
  map = new Map<string, GameState>();
  async create(id: string, state: GameState) { this.map.set(id, state); }
  async get(id: string) { return this.map.get(id); }
  async save(id: string, state: GameState) { this.map.set(id, state); }
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

    const moved = await api.submitMove({
      pathParameters: { gameId },
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

    const response = await api.submitMove({
      pathParameters: { gameId },
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

    const response = await api.submitMove({
      pathParameters: { gameId },
      body: JSON.stringify({ from: 'E3', to: 'E4' })
    } as any);

    expect([400, 409]).toContain(response.statusCode);
    expect(JSON.parse(response.body).error).toBe('No piece on source square');
  });
});
