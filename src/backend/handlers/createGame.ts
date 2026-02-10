import { handlers } from './factory.js';
import { GameRepository } from '../db/repository.js';

const repo = new GameRepository(process.env.GAME_TABLE_NAME || 'slamChessGames');
export const handler = handlers(repo).createGame;
