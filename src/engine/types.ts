export type Color = 'white' | 'black';
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Square = string; // "A1".."H8"

export interface CastlingRights {
  whiteKingSide: boolean;
  whiteQueenSide: boolean;
  blackKingSide: boolean;
  blackQueenSide: boolean;
}

export interface Move {
  from: Square;
  to: Square;
}

export interface HistoryEntry {
  move: Move;
  events: GameEvent[];
}

export interface GameState {
  board: Record<Square, Piece | undefined>;
  turn: Color;
  castlingRights: CastlingRights;
  history: HistoryEntry[];
  players: Partial<Record<Color, string>>;
  version: number;
  gameOver?: { winner: Color; reason: 'checkmate' };
}

export type GameEvent =
  | { type: 'Moved'; piece: Piece; from: Square; to: Square }
  | { type: 'Slammed'; attacker: Piece; target: Piece; from: Square; to: Square; distance: number }
  | { type: 'Destroyed'; piece: Piece; at: Square; reason: 'collision' | 'offboard' }
  | { type: 'Promotion'; at: Square; from: PieceType; to: PieceType }
  | { type: 'Check'; against: Color }
  | { type: 'Checkmate'; winner: Color };
