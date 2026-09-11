import { useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { RotateCcw, Trophy } from 'lucide-react';
import {
  applyMove,
  chooseCpuMove,
  isCheckmate,
  isStalemate,
  legalMoves,
  moveLabel,
  parseFen,
  parseSquare,
  squareName,
  type Board,
  type Color,
  type Move,
  type Piece,
  type PieceType,
} from './chess';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const PIECE_NAMES: Record<PieceType, string> = { k: 'KING', q: 'QUEEN', r: 'ROOK', b: 'BISHOP', n: 'KNIGHT', p: 'PAWN' };
const MAX_WHITE_MOVES = 4;
const FAILED_ATTEMPTS_KEY = 'mk-chess-failed-attempts';

type Animation = { move: Move; boardBefore: Board; started: number };

const PIECE_IMAGE_PATHS: Record<Color, Record<PieceType, string>> = {
  w: { k: 'wK.png', q: 'wQ.png', r: 'wR.png', b: 'wB.png', n: 'wN.png', p: 'wP.png' },
  b: { k: 'bK.png', q: 'bQ.png', r: 'bR.png', b: 'bB.png', n: 'bN.png', p: 'bP.png' },
};

function ChessBoard({
  board,
  selected,
  destinations,
  animation,
  onSquareClick,
}: {
  board: Board;
  selected: string | null;
  destinations: Move[];
  animation: Animation | null;
  onSquareClick: (square: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const destinationMap = new Map(destinations.map((move) => [move.to, move]));

  useEffect(() => {
    const canvas = canvasRef.current;
    const holder = holderRef.current;
    if (!canvas || !holder) return;
    let frame: number | null = null;
    let size = 0;
    let dpr = 1;
    const imageCache = imageCacheRef.current;
    const basePath = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    const getPieceImage = (piece: Piece) => {
      const key = `${piece.color}${piece.type}`;
      const cached = imageCache.get(key);
      if (cached) return cached;
      const image = new Image();
      image.decoding = 'async';
      image.src = `${basePath}pieces/${PIECE_IMAGE_PATHS[piece.color][piece.type]}`;
      image.onload = () => {
        if (!cancelled) draw();
      };
      imageCache.set(key, image);
      return image;
    };
    let cancelled = false;
    const draw = (timestamp = performance.now()) => {
      const rect = holder.getBoundingClientRect();
      if (!size) size = rect.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const square = size / 8;
      const light = ctx.createLinearGradient(0, 0, size, size);
      light.addColorStop(0, '#d9924c'); light.addColorStop(.5, '#f0b665'); light.addColorStop(1, '#c47d3c');
      const dark = ctx.createLinearGradient(0, 0, size, size);
      dark.addColorStop(0, '#66260c'); dark.addColorStop(.55, '#8d3210'); dark.addColorStop(1, '#4b1c0a');
      ctx.clearRect(0, 0, size, size);
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? light : dark;
        ctx.fillRect(x * square, y * square, square + .5, square + .5);
        ctx.strokeStyle = (x + y) % 2 === 0 ? 'rgba(255,230,174,.06)' : 'rgba(18,4,0,.10)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * square, y * square, square, square);
      }
      if (selected) {
        const [sx, sy] = parseSquare(selected);
        ctx.fillStyle = 'rgba(245, 208, 99, .28)';
        ctx.fillRect(sx * square, sy * square, square, square);
        ctx.strokeStyle = 'rgba(255, 230, 145, .88)';
        ctx.lineWidth = Math.max(2, square * .035);
        ctx.strokeRect(sx * square + ctx.lineWidth, sy * square + ctx.lineWidth, square - ctx.lineWidth * 2, square - ctx.lineWidth * 2);
      }
      for (const destination of destinations) {
        const [dx, dy] = parseSquare(destination.to);
        const centerX = dx * square + square / 2;
        const centerY = dy * square + square / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, destination.captured ? square * .29 : square * .105, 0, Math.PI * 2);
        ctx.fillStyle = destination.captured ? 'rgba(236, 213, 145, .18)' : 'rgba(49, 25, 11, .34)';
        ctx.fill();
        if (destination.captured) {
          ctx.strokeStyle = 'rgba(251, 221, 143, .85)';
          ctx.lineWidth = Math.max(2, square * .035);
          ctx.stroke();
        }
      }
      const moving = animation ? Math.min(1, Math.max(0, (timestamp - animation.started) / 360)) : 1;
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
        const squareId = squareName(x, y);
        const isAnimatedSquare = animation && (animation.move.from === squareId || animation.move.to === squareId);
        const piece = isAnimatedSquare ? null : board[y][x];
        if (piece) {
          const image = getPieceImage(piece);
          if (image.complete && image.naturalWidth > 0) {
            const padding = square * .045;
            ctx.drawImage(image, x * square + padding, y * square + padding, square - padding * 2, square - padding * 2);
          }
        }
      }
      if (animation) {
        const [fx, fy] = parseSquare(animation.move.from);
        const [tx, ty] = parseSquare(animation.move.to);
        const eased = moving < 0.5 ? 4 * moving * moving * moving : 1 - Math.pow(-2 * moving + 2, 3) / 2;
        const image = getPieceImage(animation.move.piece);
        if (image.complete && image.naturalWidth > 0) {
          const padding = square * .045;
          ctx.drawImage(
            image,
            (fx + (tx - fx) * eased) * square + padding,
            (fy + (ty - fy) * eased) * square + padding,
            square - padding * 2,
            square - padding * 2,
          );
        }
        if (moving < 1) frame = requestAnimationFrame(draw);
      }
    };
    const resize = () => {
      const rect = holder.getBoundingClientRect();
      size = rect.width;
      dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.floor(size * dpr));
      if (canvas.width !== nextWidth || canvas.height !== nextWidth) {
        canvas.width = nextWidth;
        canvas.height = nextWidth;
      }
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(holder);
    resize();
    return () => { cancelled = true; observer.disconnect(); if (frame !== null) cancelAnimationFrame(frame); };
  }, [board, selected, destinations, animation]);

  return (
    <div className="board-inner" ref={holderRef} data-testid="chess-board">
      <canvas className="board-canvas" ref={canvasRef} aria-label="Playable chess board" />
      <div className="board-hit-grid" role="grid" aria-label="Chess squares">
        {Array.from({ length: 64 }, (_, index) => {
          const x = index % 8;
          const y = Math.floor(index / 8);
          const square = squareName(x, y);
          const destination = destinationMap.get(square);
          return (
            <button
              key={square}
              type="button"
              className="square-hit"
              data-testid={`square-${square}`}
              aria-label={`${square}${destination ? ', legal destination' : ''}`}
              onClick={() => onSquareClick(square)}
            />
          );
        })}
      </div>
    </div>
  );
}

function Home() {
  const [board, setBoard] = useState<Board>(() => parseFen('4k3/5ppp/8/8/2B5/8/4PPPP/3QK1N1 w - - 0 1'));
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ move: Move; label: string; side: Color }>>([]);
  const [captured, setCaptured] = useState<Piece[]>([]);
  const [whiteMoveCount, setWhiteMoveCount] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(() => {
    const saved = Number(window.localStorage.getItem(FAILED_ATTEMPTS_KEY));
    return Number.isFinite(saved) && saved >= 0 ? saved : 0;
  });
  const [turn, setTurn] = useState<Color>('w');
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState<'playing' | 'success' | 'failure'>('playing');
  const [animation, setAnimation] = useState<Animation | null>(null);
  const timerRef = useRef<number | null>(null);
  const whiteMoveCountRef = useRef(0);
  const thinkingRef = useRef(false);
  const attemptFinishedRef = useRef(false);
  const attemptIdRef = useRef(0);
  const selectedMoves = selected ? legalMoves(board, 'w', selected) : [];

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);
  useEffect(() => {
    window.localStorage.setItem(FAILED_ATTEMPTS_KEY, String(failedAttempts));
  }, [failedAttempts]);

  const finishFailure = () => {
    if (attemptFinishedRef.current) return;
    attemptFinishedRef.current = true;
    thinkingRef.current = false;
    setThinking(false);
    setTurn('w');
    setSelected(null);
    setResult('failure');
    setFailedAttempts((count) => count + 1);
  };

  const finishSuccess = () => {
    if (attemptFinishedRef.current) return;
    attemptFinishedRef.current = true;
    thinkingRef.current = false;
    setThinking(false);
    setTurn('w');
    setSelected(null);
    setResult('success');
  };

  const reset = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    attemptIdRef.current += 1;
    attemptFinishedRef.current = false;
    thinkingRef.current = false;
    whiteMoveCountRef.current = 0;
    setBoard(parseFen('4k3/5ppp/8/8/2B5/8/4PPPP/3QK1N1 w - - 0 1'));
    setSelected(null);
    setHistory([]);
    setCaptured([]);
    setWhiteMoveCount(0);
    setTurn('w');
    setThinking(false);
    setResult('playing');
    setAnimation(null);
  };

  const acceptCpuMove = (currentBoard: Board, attemptId: number) => {
    if (attemptId !== attemptIdRef.current || attemptFinishedRef.current) return;
    const cpuMove = chooseCpuMove(currentBoard);
    if (!cpuMove) {
      finishFailure();
      return;
    }
    const next = applyMove(currentBoard, cpuMove);
    setAnimation({ move: cpuMove, boardBefore: currentBoard, started: performance.now() });
    setBoard(next);
    setHistory((items) => [...items, { move: cpuMove, label: moveLabel(cpuMove, next), side: 'b' }]);
    if (cpuMove.captured) setCaptured((items) => [...items, cpuMove.captured as Piece]);
    thinkingRef.current = false;
    setThinking(false);
    setTurn('w');
    if (isCheckmate(next, 'w') || isStalemate(next, 'w')) finishFailure();
    window.setTimeout(() => setAnimation(null), 390);
  };

  const onSquareClick = (square: string) => {
    if (thinkingRef.current || attemptFinishedRef.current || result !== 'playing' || turn !== 'w') return;
    if (whiteMoveCountRef.current >= MAX_WHITE_MOVES) {
      finishFailure();
      return;
    }
    const piece = board[parseSquare(square)[1]][parseSquare(square)[0]];
    const chosenMove = selectedMoves.find((move) => move.to === square);
    if (chosenMove) {
      thinkingRef.current = true;
      const nextCount = whiteMoveCountRef.current + 1;
      whiteMoveCountRef.current = nextCount;
      setWhiteMoveCount(nextCount);
      const next = applyMove(board, chosenMove);
      setAnimation({ move: chosenMove, boardBefore: board, started: performance.now() });
      setBoard(next);
      setHistory((items) => [...items, { move: chosenMove, label: moveLabel(chosenMove, next), side: 'w' }]);
      if (chosenMove.captured) setCaptured((items) => [...items, chosenMove.captured as Piece]);
      setSelected(null);
      if (isCheckmate(next, 'b')) {
        finishSuccess();
        window.setTimeout(() => setAnimation(null), 390);
        return;
      }
      if (isStalemate(next, 'b') || nextCount >= MAX_WHITE_MOVES) {
        finishFailure();
        window.setTimeout(() => setAnimation(null), 390);
        return;
      }
      setThinking(true);
      setTurn('b');
      const attemptId = attemptIdRef.current;
      timerRef.current = window.setTimeout(() => acceptCpuMove(next, attemptId), 680);
      return;
    }
    if (piece?.color === 'w') setSelected(selected === square ? null : square);
    else setSelected(null);
  };

  const statusText = result === 'success' ? 'Challenge complete' : result === 'failure' ? 'Challenge closed' : thinking ? 'CPU thinking' : 'White to move';
  const pillClass = result === 'success' ? 'success' : result === 'failure' ? 'fail' : thinking ? 'thinking' : '';
  const whiteTaken = captured.filter((piece) => piece.color === 'b');
  const blackTaken = captured.filter((piece) => piece.color === 'w');

  return (
    <main className="room">
      <header className="room-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><Trophy /></div>
          <div>
            <div className="brand-title" data-testid="text-brand">MK BOARD GAMES</div>
            <div className="brand-subtitle">MANUAL CHALLENGE ROOM</div>
          </div>
        </div>
        <div className="header-note">CHALLENGE 01 / WEB EDITION<br />FOUR MOVES. NO SHORTCUTS.</div>
      </header>

      <div className="main-grid">
        <section aria-labelledby="challenge-title">
          <div className="eyebrow">CHESS / OPENING ATTACK</div>
          <h1 className="hero-title" id="challenge-title" data-testid="text-challenge-title">Scholar's Mate<br />Challenge</h1>
          <p className="hero-subtitle">A precise opening attack from a sparse position.</p>
          <div className={`turn-pill ${pillClass}`} data-testid="status-turn"><span className="turn-dot" />{statusText}</div>
          <div className="board-wrap">
            <div className="board-frame">
              <ChessBoard board={board} selected={selected} destinations={selectedMoves} animation={animation} onSquareClick={onSquareClick} />
              <div className="board-coordinates rank-labels" aria-hidden="true">{[8,7,6,5,4,3,2,1].map((rank) => <span key={rank}>{rank}</span>)}</div>
              <div className="board-coordinates file-labels" aria-hidden="true">{['a','b','c','d','e','f','g','h'].map((file) => <span key={file}>{file}</span>)}</div>
            </div>
            <div className="board-instruction">
              <span>Tap a piece, then choose a marked square.</span>
              <span className="legal">LEGAL PLAY</span>
            </div>
          </div>
        </section>

        <aside className="side-column">
          {result !== 'playing' && (
            <div className={`result-banner ${result === 'failure' ? 'failure' : ''}`} data-testid="status-result">
              {result === 'success' ? 'CHECKMATE. THE DIRECT ATTACK LANDED WITHIN FOUR MOVES.' : 'THE WINDOW HAS CLOSED. RESET THE ROOM AND TRY A CLEANER LINE.'}
            </div>
          )}
          <div className="focus-card">
            <div className="section-label">FOCUS</div>
            <h2 className="focus-title">Build a direct attack on the exposed king.</h2>
            <p className="focus-copy">A sparse position. A precise idea. Every move is yours.</p>
            <div className="divider" />
            <div className="position-line"><span>OBJECTIVE</span><strong>CHECKMATE THE KING</strong></div>
              <div className="position-line" style={{ marginTop: 13 }}><span>PLAYER LIMIT</span><strong>{whiteMoveCount} / {MAX_WHITE_MOVES} WHITE MOVES</strong></div>
              <div className="position-line" style={{ marginTop: 13 }}><span>FAILED ATTEMPTS</span><strong data-testid="text-failed-attempts">{failedAttempts}</strong></div>
            <div className="position-line" style={{ marginTop: 13 }}><span>CAPTURED</span><strong data-testid="text-captured">{whiteTaken.length ? `BLACK ${whiteTaken.map((piece) => PIECE_NAMES[piece.type]).join(', ')}` : 'NONE'}</strong></div>
          </div>
          <div className="move-panel">
            <div className="move-panel-head"><div className="section-label">MOVE RECORD</div><div className="move-count">{history.length} PLY</div></div>
            <div className="move-list" data-testid="text-move-history">
              {history.length ? history.map((item, index) => <span key={`${item.label}-${index}`} className={item.side === 'b' ? 'cpu' : ''}>{item.side === 'w' ? `${history.slice(0, index + 1).filter((entry) => entry.side === 'w').length}.` : 'CPU'} {item.label}</span>) : <span className="empty-moves">NO MOVES YET</span>}
            </div>
            <div className="position-line" style={{ marginTop: 16 }}><span>YOUR PIECES TAKEN</span><strong>{blackTaken.length ? blackTaken.map((piece) => PIECE_NAMES[piece.type]).join(', ') : 'NONE'}</strong></div>
            <button type="button" className="reset-button" data-testid="button-reset" onClick={reset}><RotateCcw size={14} /> Reset challenge</button>
          </div>
        </aside>
      </div>
      <div className="footnote">MK BOARD GAMES / CHALLENGE 01 / WHITE TO MOVE / LEGAL PLAY ONLY</div>
    </main>
  );
}

function Router() {
  return (
    <ErrorBoundary resetKey={useLocation()[0]}>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter>;
}

export default App;