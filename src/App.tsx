import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlertTriangle, Check, ChevronRight, CircleHelp, RotateCcw, Trophy, X } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

type Color = 'w' | 'b';
type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
type Piece = { color: Color; type: PieceType };
type Board = (Piece | null)[];
type Square = { row: number; col: number };
type Move = { from: number; to: number; capture?: Piece | null; promotion?: PieceType };
type GameState = { board: Board; turn: Color; history: Move[]; captured: Piece[]; lastMove?: Move };

const START_FEN = '4k3/5ppp/8/8/2B5/8/4PPPP/3QK1N1 w - - 0 1';
const FILES = 'abcdefgh';
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];
const PIECE_NAMES: Record<PieceType, string> = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };
const queryClient = new QueryClient();

function index(row: number, col: number) { return row * 8 + col; }
function squareName(value: number) { return `${FILES[value % 8]}${8 - Math.floor(value / 8)}`; }
function parseFen(fen: string): GameState {
  const fields = fen.split(' ');
  const board: Board = Array(64).fill(null);
  fields[0].split('/').forEach((rank, row) => {
    let col = 0;
    for (const token of rank) {
      if (/\d/.test(token)) col += Number(token);
      else { board[index(row, col)] = { color: token === token.toUpperCase() ? 'w' : 'b', type: token.toLowerCase() as PieceType }; col += 1; }
    }
  });
  return { board, turn: fields[1] === 'b' ? 'b' : 'w', history: [], captured: [] };
}
function rowCol(value: number): Square { return { row: Math.floor(value / 8), col: value % 8 }; }
function inside(row: number, col: number) { return row >= 0 && row < 8 && col >= 0 && col < 8; }
function opposite(color: Color): Color { return color === 'w' ? 'b' : 'w'; }
function findKing(board: Board, color: Color) { return board.findIndex((piece) => piece?.type === 'k' && piece.color === color); }
function pseudoMoves(state: GameState, from: number, attacksOnly = false): Move[] {
  const piece = state.board[from]; if (!piece) return [];
  const { row, col } = rowCol(from);
  const moves: Move[] = [];
  const push = (r: number, c: number) => {
    if (!inside(r, c)) return false;
    const to = index(r, c); const target = state.board[to];
    if (target?.color === piece.color) return false;
    if (!target) moves.push({ from, to });
    if (target && target.color !== piece.color) moves.push({ from, to, capture: target });
    return !target;
  };
  if (piece.type === 'p') {
    const direction = piece.color === 'w' ? -1 : 1;
    for (const dc of [-1, 1]) {
      const r = row + direction, c = col + dc;
      if (inside(r, c)) {
        const target = state.board[index(r, c)];
        if (attacksOnly) moves.push({ from, to: index(r, c), capture: target });
        else if (target && target.color !== piece.color) moves.push({ from, to: index(r, c), capture: target, promotion: r === 0 || r === 7 ? 'q' : undefined });
      }
    }
    if (attacksOnly) return moves;
    const one = row + direction;
    if (inside(one, col) && !state.board[index(one, col)]) {
      moves.push({ from, to: index(one, col), promotion: one === 0 || one === 7 ? 'q' : undefined });
      const start = piece.color === 'w' ? 6 : 1;
      if (row === start && !state.board[index(row + direction * 2, col)]) moves.push({ from, to: index(row + direction * 2, col) });
    }
    return moves;
  }
  if (piece.type === 'n') {
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) push(row + dr, col + dc);
  } else if (piece.type === 'k') {
    for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) if (dr || dc) push(row + dr, col + dc);
  } else {
    const directions = piece.type === 'b' ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : piece.type === 'r' ? [[-1, 0], [1, 0], [0, -1], [0, 1]] : [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) { let r = row + dr, c = col + dc; while (inside(r, c)) { const clear = push(r, c); if (!clear) break; r += dr; c += dc; } }
  }
  return moves;
}
function attacked(board: Board, square: number, by: Color) {
  const state: GameState = { board, turn: by, history: [], captured: [] };
  return board.some((piece, source) => piece?.color === by && pseudoMoves(state, source, true).some((move) => move.to === square));
}
function applyUnchecked(state: GameState, move: Move): Board {
  const board = [...state.board]; const moving = board[move.from];
  board[move.from] = null; board[move.to] = moving ? { ...moving, type: move.promotion ?? moving.type } : null;
  return board;
}
function leavesKingSafe(state: GameState, move: Move) {
  const board = applyUnchecked(state, move); const king = findKing(board, state.turn);
  return king >= 0 && !attacked(board, king, opposite(state.turn));
}
function legalMovesFor(state: GameState, from: number) {
  const piece = state.board[from]; if (!piece || piece.color !== state.turn) return [];
  return pseudoMoves(state, from).filter((move) => {
    const target = state.board[move.to]; return target?.type !== 'k' && leavesKingSafe(state, move);
  });
}
function allLegalMoves(state: GameState, color = state.turn) {
  const scoped = color === state.turn ? state : { ...state, turn: color };
  return scoped.board.flatMap((piece, source) => piece?.color === color ? legalMovesFor(scoped, source) : []);
}
function checkState(state: GameState) {
  const king = findKing(state.board, state.turn);
  const inCheck = king >= 0 && attacked(state.board, king, opposite(state.turn));
  const noMoves = allLegalMoves(state).length === 0;
  return { inCheck, checkmate: inCheck && noMoves, stalemate: !inCheck && noMoves };
}
function makeMove(state: GameState, move: Move): GameState {
  const capture = state.board[move.to];
  const next: GameState = { board: applyUnchecked(state, move), turn: opposite(state.turn), history: [...state.history, move], captured: capture ? [...state.captured, capture] : state.captured, lastMove: move };
  return next;
}
function moveLabel(move: Move, state: GameState) {
  const piece = state.board[move.from]; if (!piece) return '';
  const prefix = piece.type === 'p' ? '' : piece.type.toUpperCase();
  const capture = move.capture ? 'x' : '–';
  return `${prefix}${squareName(move.from)}${capture}${squareName(move.to)}${move.promotion ? '=Q' : ''}`;
}

function PieceSvg({ type, color }: { type: PieceType; color: Color }) {
  const dark = color === 'b';
  return <svg viewBox="0 0 100 100" aria-label={`${dark ? 'Black' : 'White'} ${PIECE_NAMES[type]}`} role="img">
    <g className="piece-outline" fill="currentColor" strokeWidth="2.5" strokeLinejoin="round">
      {type === 'p' && <><path d="M50 21c-8 0-13 6-13 13 0 5 3 9 7 11-3 7-10 11-12 21h36c-2-10-9-14-12-21 4-2 7-6 7-11 0-7-5-13-13-13z" /><path d="M25 76h50v8H25z" /></>}
      {type === 'n' && <><path d="M31 80c-3-8 3-15 10-20-7-5-10-13-7-23 3-11 11-18 25-19l11 8-8 9 10 12-11 9c9 5 13 11 13 24H31z" /><path d="M36 57c10-4 20-5 28 0" fill="none" /></>}
      {type === 'b' && <><path d="M50 17c-8 8-15 15-15 25 0 8 6 14 10 18-8 4-13 9-15 17h40c-2-8-7-13-15-17 4-4 10-10 10-18 0-10-7-17-15-25z" /><path d="M44 28l12 15M25 76h50v8H25z" fill="none" /></>}
      {type === 'r' && <><path d="M28 18h10v8h8v-8h8v8h8v-8h10v18l-7 5v26c5 2 8 5 10 9H25c2-4 5-7 10-9V41l-7-5V18z" /><path d="M29 76h42v8H29z" /></>}
      {type === 'q' && <><path d="M23 20l9 12 9-15 9 15 9-15 9 15 9-12-7 39c-8 5-32 5-40 0L23 20z" /><path d="M28 68h44M25 76h50v8H25z" /></>}
      {type === 'k' && <><path d="M45 13h10v12h10v9H55v9c5 4 10 10 10 17 0 5-3 8-6 11H41c-3-3-6-6-6-11 0-7 5-13 10-17v-9H35v-9h10V13z" /><path d="M25 76h50v8H25z" /></>}
    </g>
    {!dark && <path d="M31 65h38" stroke="rgba(255,255,255,.55)" strokeWidth="2" opacity=".7" />}
  </svg>;
}

function Board({ state, selected, legal, onSquare, animation }: { state: GameState; selected: number | null; legal: Move[]; onSquare: (square: number) => void; animation: { move: Move; piece: Piece } | null }) {
  const checked = checkState(state);
  const checkSquare = checked.inCheck ? findKing(state.board, state.turn) : -1;
  return <div className="board-wrap" data-testid="chess-board">
    <div className="board-surface" />
    <div className="board-grid">
      {state.board.map((piece, square) => {
        const last = state.lastMove && (state.lastMove.from === square || state.lastMove.to === square);
        const selectedHere = selected === square;
        const checkHere = checkSquare === square;
        const target = legal.find((move) => move.to === square);
        const hidden = animation && (animation.move.from === square || animation.move.to === square);
        return <button key={square} type="button" className={`square ${last ? 'last-move' : ''} ${selectedHere ? 'selected' : ''} ${checkHere ? 'check' : ''}`} onClick={() => onSquare(square)} aria-label={squareName(square)} data-testid={`square-${squareName(square)}`}>
          {target && (target.capture ? <span className="legal-capture" /> : <span className="legal-dot" />)}
          {piece && !hidden && <span className={`piece ${piece.color === 'w' ? 'white' : 'black'}`}><PieceSvg type={piece.type} color={piece.color} /></span>}
        </button>;
      })}
    </div>
    <div className="board-coordinates" aria-hidden="true">
      {RANKS.map((rank) => <span className="rank-label" key={rank}>{rank}</span>)}
      {FILES.split('').map((file) => <span className="file-label" key={file}>{file}</span>)}
    </div>
    {animation && <span className={`animated-piece ${animation.piece.color === 'w' ? 'white' : 'black'}`} style={{ left: `calc(5.2% + ${(animation.move.from % 8) * 11.2}%)`, top: `calc(5.2% + ${Math.floor(animation.move.from / 8) * 11.2}%)`, ['--move-x' as string]: `${((animation.move.to % 8) - (animation.move.from % 8)) * 100}%`, ['--move-y' as string]: `${(Math.floor(animation.move.to / 8) - Math.floor(animation.move.from / 8)) * 100}%` } as CSSProperties}><PieceSvg type={animation.piece.type} color={animation.piece.color} /></span>}
  </div>;
}

function CapturedStrip({ pieces, color }: { pieces: Piece[]; color: Color }) {
  const list = pieces.filter((piece) => piece.color === color);
  return <div className="capture-strip">{list.length ? list.map((piece, i) => <span className="capture-piece" key={`${piece.type}-${i}`}><PieceSvg type={piece.type} color={opposite(piece.color)} /></span>) : <span className="capture-empty">none yet</span>}</div>;
}

function ChessRoom() {
  const [state, setState] = useState<GameState>(() => parseFen(START_FEN));
  const [selected, setSelected] = useState<number | null>(null);
  const [animation, setAnimation] = useState<{ move: Move; piece: Piece } | null>(null);
  const [promotion, setPromotion] = useState<{ move: Move; piece: Piece } | null>(null);
  const [result, setResult] = useState<'success' | 'failure' | null>(null);
  const [notice, setNotice] = useState('White to move. Find the direct attack.');
  const check = useMemo(() => checkState(state), [state]);
  const StatusIcon = result === 'success' ? Check : result === 'failure' ? X : CircleHelp;
  const whiteMoves = state.history.filter((move, i) => i % 2 === 0).length;
  const legal = selected === null ? [] : legalMovesFor(state, selected);
  const lastMove = state.lastMove;

  useEffect(() => {
    if (!animation) return;
    const timer = window.setTimeout(() => setAnimation(null), 500);
    return () => window.clearTimeout(timer);
  }, [animation]);

  const reset = () => { setState(parseFen(START_FEN)); setSelected(null); setAnimation(null); setPromotion(null); setResult(null); setNotice('White to move. Find the direct attack.'); };
  const commitMove = (move: Move, chosenPromotion?: PieceType) => {
    const piece = state.board[move.from]; if (!piece) return;
    const finalMove = { ...move, promotion: chosenPromotion ?? move.promotion };
    const next = makeMove(state, finalMove);
    setState(next); setSelected(null); setPromotion(null); setAnimation({ move: finalMove, piece });
    const nextCheck = checkState(next);
    const newWhiteMoves = next.history.filter((_, i) => i % 2 === 0).length;
    if (nextCheck.checkmate && state.turn === 'w') { setResult('success'); setNotice('Checkmate. The king has no escape.'); }
    else if (nextCheck.checkmate) { setResult('failure'); setNotice('The opposing king has been checkmated. Reset to try the challenge line.'); }
    else if (nextCheck.stalemate) { setResult('failure'); setNotice('Stalemate. The attack has run out of legal moves.'); }
    else if (newWhiteMoves >= 4 && next.turn === 'b') { setResult('failure'); setNotice('The four-move limit has been reached.'); }
    else if (nextCheck.inCheck) setNotice(`${next.turn === 'w' ? 'White' : 'Black'} is in check. Find the reply.`);
    else setNotice(`${next.turn === 'w' ? 'White' : 'Black'} to move. ${next.turn === 'w' ? 'Keep the pressure.' : 'Play the king’s reply manually.'}`);
  };
  const onSquare = (square: number) => {
    if (result || promotion || animation) return;
    const piece = state.board[square];
    if (selected !== null) {
      const move = legal.find((candidate) => candidate.to === square);
      if (move) { if (move.promotion) setPromotion({ move, piece: state.board[move.from]! }); else commitMove(move); return; }
      if (piece?.color === state.turn) { setSelected(square); return; }
      setSelected(null); setNotice(`${state.turn === 'w' ? 'White' : 'Black'} to move. Select a highlighted piece.`); return;
    }
    if (piece?.color === state.turn) { setSelected(square); setNotice(`${PIECE_NAMES[piece.type]} selected. Choose a highlighted destination.`); }
    else setNotice(`It is ${state.turn === 'w' ? 'White' : 'Black'}'s turn.`);
  };

  return <main className="chess-app">
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Trophy size={18} strokeWidth={1.7} /></span><div className="brand-copy"><div className="brand-name">MK Board Games</div><div className="brand-kicker">Manual challenge room</div></div></div>
        <div className="challenge-pill"><span>Challenge</span><strong>01 / 30</strong><ChevronRight size={13} /></div>
      </header>
      <div className="room">
        <section className="board-column">
          <div className="board-heading"><div><div className="eyebrow">CHESS / OPENING ATTACK</div><h1>Scholar's Mate Challenge</h1></div><div className="turn-chip"><span className="turn-dot" />{state.turn === 'w' ? 'White to move' : 'Black to move'}</div></div>
          <Board state={state} selected={selected} legal={legal} onSquare={onSquare} animation={animation} />
          <div className="board-caption"><span>Tap a piece, then choose a marked square.</span><span className="mono">{check.inCheck ? 'CHECK' : 'LEGAL PLAY'}</span></div>
        </section>
        <aside className="hud" aria-label="Challenge information">
          <div className="hud-top"><div className="hud-label">Focus</div><h2 className="hud-title">Build a direct attack on the exposed king.</h2><div className="hud-focus">A sparse position. A precise idea. Every move is yours.</div></div>
          <div className="hud-section"><div className="metric-row"><span className="hud-label">Player moves</span><span className="metric-value" data-testid="text-move-count">{whiteMoves} / 4</span></div><div className="progress-track"><div className="progress-bar" style={{ width: `${Math.min(100, whiteMoves / 4 * 100)}%` }} /></div></div>
          <div className="hud-section"><p className="objective">Deliver checkmate in 4 moves or fewer.</p></div>
          <div className="hud-section"><div className="hud-label">Starting position</div><p className="setup-text" data-testid="text-setup">White: Ke1, Qd1, Bc4, Ng1, pawns e2/f2/g2/h2. Black: Ke8, pawns f7/g7/h7. White to move.</p></div>
          <div className={`hud-section status-box ${result === 'success' ? 'success' : result === 'failure' ? 'failure' : ''}`} data-testid="status-challenge"><StatusIcon size={16} /><span>{notice}</span></div>
          <div className="hud-section"><div className="capture-title"><span>Captured by White</span><span>{state.captured.filter((p) => p.color === 'b').length}</span></div><CapturedStrip pieces={state.captured} color="b" /><div className="capture-title" style={{ marginTop: 15 }}><span>Captured by Black</span><span>{state.captured.filter((p) => p.color === 'w').length}</span></div><CapturedStrip pieces={state.captured} color="w" /></div>
          <div className="hud-section"><div className="moves-title"><span>Move record</span><span>{state.history.length ? `${state.history.length} ply` : 'empty'}</span></div><div className="move-list">{state.history.length === 0 && <span className="capture-empty">Your line will appear here.</span>}{Array.from({ length: Math.ceil(state.history.length / 2) }, (_, row) => <div className="move-row" key={row}><span className="move-num">{row + 1}.</span><span className={`move-san ${state.history[row * 2] === lastMove ? 'active' : ''}`}>{moveLabel(state.history[row * 2], rowState(state, row * 2))}</span><span className={`move-san ${state.history[row * 2 + 1] === lastMove ? 'active' : ''}`}>{state.history[row * 2 + 1] ? moveLabel(state.history[row * 2 + 1], rowState(state, row * 2 + 1)) : ''}</span></div>)}</div></div>
          <div className="hud-actions"><button className="action-btn" type="button" onClick={reset} data-testid="button-reset"><RotateCcw size={14} /> Reset</button><button className="action-btn" type="button" onClick={() => setNotice('The authored opening idea is Bxf7+, from c4 to f7.')} data-testid="button-hint"><CircleHelp size={14} /> Hint</button></div>
        </aside>
      </div>
    </div>
    {promotion && <div className="result-overlay" role="dialog"><div className="result-card"><div className="result-mark"><ChevronRight /></div><h2>Choose promotion</h2><p>Select the piece your pawn becomes.</p><div className="hud-actions">{(['q', 'r', 'b', 'n'] as PieceType[]).map((type) => <button className="action-btn primary" type="button" key={type} onClick={() => commitMove(promotion.move, type)} data-testid={`button-promote-${type}`}>{PIECE_NAMES[type]}</button>)}</div></div></div>}
    {result && <div className="result-overlay" role="dialog"><div className={`result-card ${result}`}><div className="result-mark">{result === 'success' ? <Trophy size={25} /> : <AlertTriangle size={25} />}</div><h2>{result === 'success' ? 'Challenge complete' : 'Attack interrupted'}</h2><p>{result === 'success' ? 'Checkmate landed inside the four-move limit.' : 'The king survived the four-move window. Reset and find a sharper line.'}</p><button className="action-btn primary" type="button" onClick={reset} data-testid="button-result-reset"><RotateCcw size={14} /> Try again</button></div></div>}
    {notice && !result && state.history.length > 0 && <div className="toast" data-testid="text-latest-status">{notice}</div>}
  </main>;
}

function rowState(state: GameState, moveIndex: number) {
  let snapshot = parseFen(START_FEN);
  for (let i = 0; i < moveIndex; i++) snapshot = makeMove(snapshot, state.history[i]);
  return snapshot;
}
function Router() { return <RoutedErrorBoundary><Switch><Route path="/" component={ChessRoom} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>; }
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;