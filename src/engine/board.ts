import { Color, GameState, Piece, Square } from './types.js';

export const files = 'ABCDEFGH';

export function squareToCoords(square: Square): { x: number; y: number } {
  const file = square[0]?.toUpperCase();
  const rank = Number(square.slice(1));
  return { x: files.indexOf(file), y: rank - 1 };
}

export function coordsToSquare(x: number, y: number): Square | undefined {
  if (x < 0 || x > 7 || y < 0 || y > 7) return undefined;
  return `${files[x]}${y + 1}`;
}

export function cloneBoard(board: Record<Square, Piece | undefined>): Record<Square, Piece | undefined> {
  const next: Record<Square, Piece | undefined> = {};
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      const sq = coordsToSquare(x, y)!;
      const p = board[sq];
      if (p) next[sq] = { ...p };
    }
  }
  return next;
}

export function initialState(): GameState {
  const board: Record<Square, Piece | undefined> = {};
  const back: Piece['type'][] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let i = 0; i < 8; i++) {
    board[`${files[i]}1`] = { type: back[i], color: 'white' };
    board[`${files[i]}2`] = { type: 'pawn', color: 'white' };
    board[`${files[i]}7`] = { type: 'pawn', color: 'black' };
    board[`${files[i]}8`] = { type: back[i], color: 'black' };
  }
  return {
    board,
    turn: 'white',
    castlingRights: {
      whiteKingSide: true,
      whiteQueenSide: true,
      blackKingSide: true,
      blackQueenSide: true
    },
    history: []
  };
}

export function enemy(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

export function findKing(board: Record<Square, Piece | undefined>, color: Color): Square | undefined {
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      const sq = coordsToSquare(x, y)!;
      const p = board[sq];
      if (p?.type === 'king' && p.color === color) return sq;
    }
  }
  return undefined;
}
