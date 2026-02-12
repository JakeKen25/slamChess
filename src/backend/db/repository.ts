import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { GameState } from '../../engine/types.js';

export class GameRepository {
  private db: DynamoDBDocumentClient;
  constructor(private tableName: string, client = new DynamoDBClient({})) {
    this.db = DynamoDBDocumentClient.from(client);
  }

  async create(gameId: string, state: GameState): Promise<void> {
    await this.db.send(new PutCommand({ TableName: this.tableName, Item: { gameId, state } }));
  }

  async get(gameId: string): Promise<GameState | undefined> {
    const res = await this.db.send(new GetCommand({ TableName: this.tableName, Key: { gameId } }));
    return res.Item?.state as GameState | undefined;
  }

  async save(gameId: string, state: GameState, expectedVersion?: number): Promise<void> {
    if (typeof expectedVersion === 'number') {
      await this.db.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { gameId },
        UpdateExpression: 'SET #s = :s',
        ConditionExpression: '#s.#v = :expectedVersion',
        ExpressionAttributeNames: { '#s': 'state', '#v': 'version' },
        ExpressionAttributeValues: { ':s': state, ':expectedVersion': expectedVersion }
      }));
      return;
    }

    await this.db.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { gameId },
      UpdateExpression: 'SET #s = :s',
      ExpressionAttributeNames: { '#s': 'state' },
      ExpressionAttributeValues: { ':s': state }
    }));
  }
}
