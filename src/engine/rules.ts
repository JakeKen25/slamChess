import { cloneBoard, coordsToSquare, enemy, findKing, squareToCoords } from './board.js';
import { Color, GameEvent, GameState, Move, Piece, Square } from './types.js';

const DIRS = {
  rook: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  bishop: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  queen: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
};

function sign(n: number): number {
  return n === 0 ? 0 : n > 0 ? 1 : -1;
}

function pathClear(board: Record<Square, Piece | undefined>, from: Square, to: Square): boolean {
  const a = squareToCoords(from);
  const b = squareToCoords(to);
  const dx = sign(b.x - a.x);
  const dy = sign(b.y - a.y);
  let x = a.x + dx;
  let y = a.y + dy;
  while (x !== b.x || y !== b.y) {
    const sq = coordsToSquare(x, y)!;
    if (board[sq]) return false;
    x += dx;
    y += dy;
  }
  return true;
}

function pseudoAttacksSquare(board: Record<Square, Piece | undefined>, from: Square, piece: Piece, target: Square): boolean {
  const a = squareToCoords(from);
  const b = squareToCoords(target);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  if (piece.type === 'pawn') {
    const dir = piece.color === 'white' ? 1 : -1;
    return dy === dir && adx === 1;
  }
  if (piece.type === 'knight') return (adx === 1 && ady === 2) || (adx === 2 && ady === 1);
  if (piece.type === 'king') return adx <= 1 && ady <= 1 && (adx + ady > 0);
  if (piece.type === 'rook') return (dx === 0 || dy === 0) && pathClear(board, from, target);
  if (piece.type === 'bishop') return adx === ady && pathClear(board, from, target);
  return (dx === 0 || dy === 0 || adx === ady) && pathClear(board, from, target);
}

export function isInCheck(board: Record<Square, Piece | undefined>, color: Color): boolean {
  const kingSq = findKing(board, color);
  if (!kingSq) return false;
  for (const [from, piece] of Object.entries(board)) {
    if (piece && piece.color !== color && pseudoAttacksSquare(board, from, piece, kingSq)) return true;
  }
  return false;
}

function candidateMoves(state: GameState, from: Square): Square[] {
  const piece = state.board[from];
  if (!piece || piece.color !== state.turn) return [];
  const res: Square[] = [];
  const a = squareToCoords(from);
  const addIfValid = (x: number, y: number) => {
    const to = coordsToSquare(x, y);
    if (!to) return;
    const target = state.board[to];
    if (!target || target.color !== piece.color) res.push(to);
  };

  if (piece.type === 'knight') {
    [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].forEach(([dx,dy]) => addIfValid(a.x+dx,a.y+dy));
  } else if (piece.type === 'king') {
    for (let dx=-1; dx<=1; dx++) for (let dy=-1; dy<=1; dy++) if (dx||dy) addIfValid(a.x+dx,a.y+dy);
    const rights = state.castlingRights;
    if (piece.color === 'white' && from === 'E1') {
      if (rights.whiteKingSide && !state.board['F1'] && !state.board['G1']) res.push('G1');
      if (rights.whiteQueenSide && !state.board['D1'] && !state.board['C1'] && !state.board['B1']) res.push('C1');
    }
    if (piece.color === 'black' && from === 'E8') {
      if (rights.blackKingSide && !state.board['F8'] && !state.board['G8']) res.push('G8');
      if (rights.blackQueenSide && !state.board['D8'] && !state.board['C8'] && !state.board['B8']) res.push('C8');
    }
  } else if (piece.type === 'pawn') {
    const dir = piece.color === 'white' ? 1 : -1;
    const one = coordsToSquare(a.x, a.y + dir);
    if (one && !state.board[one]) res.push(one);
    const startRank = piece.color === 'white' ? 1 : 6;
    const two = coordsToSquare(a.x, a.y + 2 * dir);
    if (a.y === startRank && one && two && !state.board[one] && !state.board[two]) res.push(two);
    for (const dx of [-1,1]) {
      const diag = coordsToSquare(a.x + dx, a.y + dir);
      if (!diag) continue;
      const target = state.board[diag];
      if (target && target.color !== piece.color) res.push(diag);
    }
  } else {
    const dirs = piece.type === 'rook' ? DIRS.rook : piece.type === 'bishop' ? DIRS.bishop : DIRS.queen;
    for (const [dx,dy] of dirs) {
      let x = a.x + dx; let y = a.y + dy;
      while (true) {
        const sq = coordsToSquare(x,y);
        if (!sq) break;
        const t = state.board[sq];
        if (!t) {
          res.push(sq);
        } else {
          if (t.color !== piece.color) res.push(sq);
          break;
        }
        x += dx; y += dy;
      }
    }
  }
  return res;
}

function executeUnchecked(state: GameState, move: Move): { state: GameState; events: GameEvent[] } {
  const piece = state.board[move.from]!;
  const target = state.board[move.to];
  const board = cloneBoard(state.board);
  const events: GameEvent[] = [];

  delete board[move.from];
  board[move.to] = piece;
  events.push({ type: 'Moved', piece, from: move.from, to: move.to });

  if (piece.type === 'king' && (move.from === 'E1' || move.from === 'E8') && (move.to === 'G1' || move.to === 'C1' || move.to === 'G8' || move.to === 'C8')) {
    if (move.to === 'G1') { board['F1'] = board['H1']; delete board['H1']; }
    if (move.to === 'C1') { board['D1'] = board['A1']; delete board['A1']; }
    if (move.to === 'G8') { board['F8'] = board['H8']; delete board['H8']; }
    if (move.to === 'C8') { board['D8'] = board['A8']; delete board['A8']; }
  }

  if (target) {
    const attacker = piece;
    if (target.type !== 'king') {
      const fromC = squareToCoords(move.from);
      const toC = squareToCoords(move.to);
      const baseDx = toC.x - fromC.x;
      const baseDy = toC.y - fromC.y;
      let dx = sign(baseDx);
      let dy = sign(baseDy);
      let distance = Math.max(Math.abs(baseDx), Math.abs(baseDy));
      if (attacker.type === 'knight') {
        distance = 3;
        dx = baseDx === 0 ? 0 : Math.abs(baseDx) === 2 ? sign(baseDx) : 0;
        dy = baseDy === 0 ? 0 : Math.abs(baseDy) === 2 ? sign(baseDy) : 0;
      }
      if (attacker.type === 'king') distance = 1;

      events.push({ type: 'Slammed', attacker, target, from: move.to, to: move.to, distance });
      let x = toC.x;
      let y = toC.y;
      let destroyed: GameEvent | undefined;
      for (let i = 0; i < distance; i++) {
        x += dx; y += dy;
        const sq = coordsToSquare(x,y);
        if (!sq) { destroyed = { type: 'Destroyed', piece: target, at: move.to, reason: 'offboard' }; break; }
        if (board[sq]) { destroyed = { type: 'Destroyed', piece: target, at: sq, reason: 'collision' }; break; }
      }
      if (destroyed) {
        events.push(destroyed);
      } else {
        const landing = coordsToSquare(x,y)!;
        board[landing] = target;
        if (target.type === 'pawn' && ((target.color === 'white' && landing.endsWith('8')) || (target.color === 'black' && landing.endsWith('1')))) {
          board[landing] = { ...target, type: 'queen' };
          events.push({ type: 'Promotion', at: landing, from: 'pawn', to: 'queen' });
        }
      }
    }
  }

  const next: GameState = {
    ...state,
    board,
    turn: enemy(state.turn),
    castlingRights: updateCastlingRights(state, move),
    history: [...state.history]
  };
  return { state: next, events };
}

function updateCastlingRights(state: GameState, move: Move) {
  const rights = { ...state.castlingRights };
  const p = state.board[move.from];
  if (!p) return rights;
  if (p.type === 'king') {
    if (p.color === 'white') { rights.whiteKingSide = false; rights.whiteQueenSide = false; }
    else { rights.blackKingSide = false; rights.blackQueenSide = false; }
  }
  if (move.from === 'A1' || move.to === 'A1') rights.whiteQueenSide = false;
  if (move.from === 'H1' || move.to === 'H1') rights.whiteKingSide = false;
  if (move.from === 'A8' || move.to === 'A8') rights.blackQueenSide = false;
  if (move.from === 'H8' || move.to === 'H8') rights.blackKingSide = false;
  return rights;
}

export function listLegalMoves(state: GameState, color = state.turn): Move[] {
  const moves: Move[] = [];
  for (const [from, piece] of Object.entries(state.board)) {
    if (!piece || piece.color !== color) continue;
    for (const to of candidateMoves({ ...state, turn: color }, from)) {
      const castling = piece.type === 'king' && ((from === 'E1' && (to === 'G1' || to === 'C1')) || (from === 'E8' && (to === 'G8' || to === 'C8')));
      if (castling) {
        const path = to[0] === 'G' ? [from, piece.color === 'white' ? 'F1' : 'F8', to] : [from, piece.color === 'white' ? 'D1' : 'D8', to];
        if (path.some((sq) => isInCheck(state.board, piece.color) || isSquareAttacked(state.board, sq, enemy(piece.color)))) continue;
      }
      try {
        const applied = executeUnchecked({ ...state, turn: color }, { from, to });
        if (!isInCheck(applied.state.board, color)) moves.push({ from, to });
      } catch {
        // ignore
      }
    }
  }
  return moves;
}

function isSquareAttacked(board: Record<Square, Piece | undefined>, square: Square, byColor: Color): boolean {
  for (const [from, piece] of Object.entries(board)) {
    if (piece && piece.color === byColor && pseudoAttacksSquare(board, from, piece, square)) return true;
  }
  return false;
}

export function applyMove(gameState: GameState, move: Move): { newState: GameState; events: GameEvent[] } {
  const piece = gameState.board[move.from];
  if (!piece) throw new Error('No piece on source square');
  if (piece.color !== gameState.turn) throw new Error('Not your turn');
  const legal = listLegalMoves(gameState).some((m) => m.from === move.from && m.to === move.to);
  if (!legal) throw new Error('Illegal move');

  const { state, events } = executeUnchecked(gameState, move);
  if (isInCheck(state.board, state.turn)) {
    events.push({ type: 'Check', against: state.turn });
    if (listLegalMoves(state, state.turn).length === 0) {
      const winner = enemy(state.turn);
      events.push({ type: 'Checkmate', winner });
      state.gameOver = { winner, reason: 'checkmate' };
    }
  }
  const finalState = { ...state, history: [...state.history, { move, events }] };
  return { newState: finalState, events };
}
