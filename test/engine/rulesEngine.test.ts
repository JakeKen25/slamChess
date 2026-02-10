import { applyMove, GameState, listLegalMoves } from '../../src/engine/index.js';

function emptyState(turn: 'white' | 'black' = 'white'): GameState {
  return {
    board: {},
    turn,
    castlingRights: { whiteKingSide: false, whiteQueenSide: false, blackKingSide: false, blackQueenSide: false },
    history: []
  };
}

describe('slam rules engine', () => {
  test('rook slam off-board destroys target', () => {
    const s = emptyState();
    s.board['A1'] = { type: 'rook', color: 'white' };
    s.board['A5'] = { type: 'pawn', color: 'black' };
    s.board['E1'] = { type: 'king', color: 'white' };
    s.board['E8'] = { type: 'king', color: 'black' };
    const { newState, events } = applyMove(s, { from: 'A1', to: 'A5' });
    expect(newState.board['A5']?.type).toBe('rook');
    expect(Object.values(newState.board).find((p) => p?.color === 'black' && p.type === 'pawn')).toBeUndefined();
    expect(events.find((e) => e.type === 'Destroyed')).toBeTruthy();
  });

  test('rook short slam survives', () => {
    const s = emptyState();
    s.board['A1'] = { type: 'rook', color: 'white' };
    s.board['A2'] = { type: 'pawn', color: 'black' };
    s.board['E1'] = { type: 'king', color: 'white' };
    s.board['E8'] = { type: 'king', color: 'black' };
    const { newState } = applyMove(s, { from: 'A1', to: 'A2' });
    expect(newState.board['A3']?.type).toBe('pawn');
  });

  test('collision destroys pushed piece', () => {
    const s = emptyState();
    s.board['A1'] = { type: 'rook', color: 'white' };
    s.board['A2'] = { type: 'pawn', color: 'black' };
    s.board['A3'] = { type: 'bishop', color: 'white' };
    s.board['E1'] = { type: 'king', color: 'white' };
    s.board['E8'] = { type: 'king', color: 'black' };
    const { newState } = applyMove(s, { from: 'A1', to: 'A2' });
    expect(newState.board['A3']?.type).toBe('bishop');
    expect(Object.entries(newState.board).find(([,p]) => p?.type === 'pawn' && p.color === 'black')).toBeUndefined();
  });

  test('knight slam uses final step direction', () => {
    const s = emptyState();
    s.board['B1'] = { type: 'knight', color: 'white' };
    s.board['C3'] = { type: 'pawn', color: 'black' };
    s.board['E1'] = { type: 'king', color: 'white' };
    s.board['E8'] = { type: 'king', color: 'black' };
    const { newState } = applyMove(s, { from: 'B1', to: 'C3' });
    expect(newState.board['F3']?.type).toBe('pawn');
  });

  test('slammed pawn promotes on back rank', () => {
    const s = emptyState();
    s.board['D5'] = { type: 'bishop', color: 'white' };
    s.board['F7'] = { type: 'pawn', color: 'black' };
    s.board['E1'] = { type: 'king', color: 'white' };
    s.board['E8'] = { type: 'king', color: 'black' };
    const { newState, events } = applyMove(s, { from: 'D5', to: 'F7' });
    expect(newState.board['H8']?.type).toBe('queen');
    expect(events.find((e) => e.type === 'Promotion')).toBeTruthy();
  });

  test('castling legal and king cannot castle through check', () => {
    const s = emptyState();
    s.castlingRights.whiteKingSide = true;
    s.castlingRights.whiteQueenSide = true;
    s.board['E1'] = { type: 'king', color: 'white' };
    s.board['H1'] = { type: 'rook', color: 'white' };
    s.board['A1'] = { type: 'rook', color: 'white' };
    s.board['E8'] = { type: 'king', color: 'black' };
    s.board['F8'] = { type: 'rook', color: 'black' };
    const legal = listLegalMoves(s).map((m) => `${m.from}-${m.to}`);
    expect(legal).not.toContain('E1-G1');
    expect(legal).toContain('E1-C1');
  });

  test('illegal self-check prevented', () => {
    const s = emptyState();
    s.board['E1'] = { type: 'king', color: 'white' };
    s.board['E2'] = { type: 'rook', color: 'white' };
    s.board['E8'] = { type: 'rook', color: 'black' };
    s.board['A8'] = { type: 'king', color: 'black' };
    expect(() => applyMove(s, { from: 'E2', to: 'D2' })).toThrow('Illegal move');
  });

  test('checkmate event emitted', () => {
    const s = emptyState('black');
    s.board['A8'] = { type: 'king', color: 'black' };
    s.board['B6'] = { type: 'queen', color: 'white' };
    s.board['C7'] = { type: 'king', color: 'white' };
    const { events } = applyMove(s, { from: 'B6', to: 'B7' });
    expect(events.find((e) => e.type === 'Check')).toBeTruthy();
    expect(events.find((e) => e.type === 'Checkmate')).toBeTruthy();
  });
});
