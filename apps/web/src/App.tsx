import { useMemo, useState } from 'react';

type Color = 'white' | 'black';
type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
type Square = string;

type Piece = { type: PieceType; color: Color };

type GameEvent =
  | { type: 'Moved'; piece: Piece; from: Square; to: Square }
  | { type: 'Slammed'; attacker: Piece; target: Piece; from: Square; to: Square; distance: number }
  | { type: 'Destroyed'; piece: Piece; at: Square; reason: 'collision' | 'offboard' }
  | { type: 'Promotion'; at: Square; from: PieceType; to: PieceType }
  | { type: 'Check'; against: Color }
  | { type: 'Checkmate'; winner: Color };

type HistoryEntry = { move: { from: Square; to: Square }; events: GameEvent[] };

type GameState = {
  board: Record<Square, Piece | undefined>;
  turn: Color;
  history: HistoryEntry[];
  gameOver?: { winner: Color; reason: 'checkmate' };
};

type Move = { from: Square; to: Square };

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const files = 'ABCDEFGH'.split('');
const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

const pieceGlyphs: Record<Color, Record<PieceType, string>> = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
};

type AnimationState = {
  move?: { from: Square; to: Square };
  slam?: { from: Square; to: Square; targetPiece: Piece; finalSquare?: Square; destroyed?: string };
  promotion?: { at: Square; to: PieceType };
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init
  });

  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `API request failed (${response.status})`);
  }
  return data;
}

function toSquare(x: number, y: number): Square | undefined {
  if (x < 0 || x > 7 || y < 0 || y > 7) return undefined;
  return `${files[x]}${y + 1}`;
}

function toCoords(square: Square): { x: number; y: number } {
  return { x: files.indexOf(square[0].toUpperCase()), y: Number(square[1]) - 1 };
}

function normalizeSquare(square: string): Square {
  return `${square[0].toUpperCase()}${square[1]}`;
}

function inferSlamFinal(events: GameEvent[]): AnimationState['slam'] {
  const slammed = events.find((event) => event.type === 'Slammed');
  if (!slammed || slammed.type !== 'Slammed') return undefined;
  const destroyed = events.find((event) => event.type === 'Destroyed');
  if (destroyed && destroyed.type === 'Destroyed') {
    return {
      from: normalizeSquare(slammed.from),
      to: normalizeSquare(destroyed.at),
      targetPiece: slammed.target,
      destroyed: destroyed.reason
    };
  }

  const moved = events.find((event) => event.type === 'Moved');
  if (!moved || moved.type !== 'Moved') {
    return {
      from: normalizeSquare(slammed.from),
      to: normalizeSquare(slammed.to),
      targetPiece: slammed.target
    };
  }

  const from = toCoords(normalizeSquare(slammed.from));
  const to = toCoords(normalizeSquare(moved.to));
  let dx = Math.sign(to.x - from.x);
  let dy = Math.sign(to.y - from.y);
  if (slammed.attacker.type === 'knight') {
    dx = Math.abs(to.x - from.x) === 2 ? Math.sign(to.x - from.x) : 0;
    dy = Math.abs(to.y - from.y) === 2 ? Math.sign(to.y - from.y) : 0;
  }

  const final = toSquare(from.x + dx * slammed.distance, from.y + dy * slammed.distance);
  return {
    from: normalizeSquare(slammed.from),
    to: final ?? normalizeSquare(slammed.to),
    finalSquare: final,
    targetPiece: slammed.target
  };
}

export function App() {
  const [gameId, setGameId] = useState<string>('');
  const [game, setGame] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Record<Square, Square[]>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [animation, setAnimation] = useState<AnimationState>({});
  const [message, setMessage] = useState<string>('Create a game to begin.');
  const [loading, setLoading] = useState(false);

  const destinationSet = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set((legalMoves[selected] ?? []).map((square) => square.toUpperCase()));
  }, [legalMoves, selected]);

  const checkBanner = useMemo(() => {
    if (!game) return null;
    const latest = game.history.at(-1)?.events ?? [];
    const mate = latest.find((event) => event.type === 'Checkmate');
    if (mate && mate.type === 'Checkmate') return `Checkmate! ${mate.winner.toUpperCase()} wins.`;
    const check = latest.find((event) => event.type === 'Check');
    if (check && check.type === 'Check') return `${check.against.toUpperCase()} king is in check.`;
    return null;
  }, [game]);

  async function refresh(currentGameId = gameId) {
    if (!currentGameId) return;
    const [stateResponse, legalResponse, historyResponse] = await Promise.all([
      api<{ gameId: string; state: GameState }>(`/games/${currentGameId}`),
      api<{ legalMoves?: Move[]; moves?: Record<string, string[]> }>(`/games/${currentGameId}/legal-moves`),
      api<{ history: HistoryEntry[] }>(`/games/${currentGameId}/history`)
    ]);

    setGame(stateResponse.state);
    setHistory(historyResponse.history ?? stateResponse.state.history ?? []);
    const nextLegal: Record<string, string[]> = {};
    if (Array.isArray(legalResponse.legalMoves)) {
      for (const move of legalResponse.legalMoves) {
        const from = normalizeSquare(move.from);
        const to = normalizeSquare(move.to);
        nextLegal[from] = [...(nextLegal[from] ?? []), to];
      }
    } else if (legalResponse.moves) {
      Object.entries(legalResponse.moves).forEach(([from, to]) => {
        nextLegal[normalizeSquare(from)] = to.map(normalizeSquare);
      });
    }
    setLegalMoves(nextLegal);
  }

  async function createGame() {
    setLoading(true);
    try {
      const response = await api<{ gameId: string; state: GameState }>('/games', { method: 'POST' });
      setGameId(response.gameId);
      setMessage(`Game ${response.gameId} created.`);
      setSelected(null);
      await refresh(response.gameId);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submitMove(from: Square, to: Square) {
    if (!gameId) return;
    setLoading(true);
    try {
      const response = await api<{ state: GameState; events: GameEvent[] }>(`/games/${gameId}/moves`, {
        method: 'POST',
        body: JSON.stringify({ from: from.toLowerCase(), to: to.toLowerCase() })
      });
      const movedEvent = response.events.find((event) => event.type === 'Moved');
      const promotion = response.events.find((event) => event.type === 'Promotion');
      setAnimation({
        move: movedEvent && movedEvent.type === 'Moved' ? { from: normalizeSquare(movedEvent.from), to: normalizeSquare(movedEvent.to) } : undefined,
        slam: inferSlamFinal(response.events),
        promotion: promotion && promotion.type === 'Promotion' ? { at: normalizeSquare(promotion.at), to: promotion.to } : undefined
      });
      setTimeout(() => setAnimation({}), 900);
      setMessage(`${from} → ${to} submitted.`);
      setSelected(null);
      setGame(response.state);
      setHistory(response.state.history);
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function onSquareClick(square: Square) {
    if (!game) return;
    const piece = game.board[square];

    if (!selected) {
      if (piece && piece.color === game.turn) setSelected(square);
      return;
    }

    if (square === selected) {
      setSelected(null);
      return;
    }

    if (destinationSet.has(square)) {
      void submitMove(selected, square);
      return;
    }

    if (piece && piece.color === game.turn) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  }

  return (
    <main className="layout">
      <section className="board-section">
        <header>
          <h1>Slam Chess</h1>
          <p>{message}</p>
        </header>

        <div className="controls">
          <button disabled={loading} onClick={() => void createGame()}>New game</button>
          <button disabled={!gameId || loading} onClick={() => void refresh()}>Refresh state</button>
          <code>{gameId || 'No game id yet'}</code>
        </div>

        <div className="status-row">
          <div>Side to move: <strong>{game?.turn.toUpperCase() ?? '-'}</strong></div>
          {checkBanner ? <div className="banner">{checkBanner}</div> : null}
          {game?.gameOver ? <div className="banner mate">Game over ({game.gameOver.reason})</div> : null}
        </div>

        <div className="board" role="grid" aria-label="Slam chess board">
          {ranks.map((rank, rankIndex) =>
            files.map((file, fileIndex) => {
              const square = `${file}${rank}`;
              const piece = game?.board[square];
              const dark = (rankIndex + fileIndex) % 2 === 1;
              const isSelected = selected === square;
              const isDestination = destinationSet.has(square);
              const moving = animation.move && (animation.move.from === square || animation.move.to === square);
              const slammed = animation.slam && (animation.slam.from === square || animation.slam.to === square);
              const promoted = animation.promotion?.at === square;
              return (
                <button
                  key={square}
                  onClick={() => onSquareClick(square)}
                  className={[
                    'square',
                    dark ? 'dark' : 'light',
                    isSelected ? 'selected' : '',
                    isDestination ? 'legal' : '',
                    moving ? 'animate-move' : '',
                    slammed ? `animate-slam ${animation.slam?.destroyed ? 'destroyed' : ''}` : '',
                    promoted ? 'animate-promotion' : ''
                  ].join(' ')}
                >
                  <span className="coord">{square}</span>
                  <span className="piece">{piece ? pieceGlyphs[piece.color][piece.type] : ''}</span>
                </button>
              );
            })
          )}
        </div>
      </section>

      <aside className="sidebar">
        <section>
          <h2>Move Timeline</h2>
          <ol>
            {history.map((entry, index) => (
              <li key={`${entry.move.from}-${entry.move.to}-${index}`}>
                <strong>{entry.move.from} → {entry.move.to}</strong>
                <ul>
                  {entry.events.map((event, eventIndex) => (
                    <li key={eventIndex}>{formatEvent(event)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </main>
  );
}

function formatEvent(event: GameEvent): string {
  switch (event.type) {
    case 'Moved':
      return `${event.piece.color} ${event.piece.type} moved ${event.from} → ${event.to}`;
    case 'Slammed':
      return `${event.attacker.color} ${event.attacker.type} slammed ${event.target.color} ${event.target.type}`;
    case 'Destroyed':
      return `${event.piece.color} ${event.piece.type} destroyed (${event.reason}) at ${event.at}`;
    case 'Promotion':
      return `Promotion at ${event.at}: ${event.from} → ${event.to}`;
    case 'Check':
      return `${event.against} in check`;
    case 'Checkmate':
      return `Checkmate by ${event.winner}`;
  }
}
