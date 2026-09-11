import { useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { RotateCcw, Trophy } from 'lucide-react';
import {
  applyMove,
  chooseCpuMove,
  isCheckmate,
  isInCheck,
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

type Animation = { move: Move; boardBefore: Board; started: number };

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawPiece(ctx: CanvasRenderingContext2D, piece: Piece, cx: number, cy: number, size: number) {
  const isWhite = piece.color === 'w';
  const fill = isWhite ? '#f3e9c8' : '#24201a';
  const shadow = isWhite ? '#937b4a' : '#090806';
  const outline = isWhite ? '#6e542c' : '#c9a867';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = size * .09;
  ctx.shadowOffsetY = size * .055;
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1.2, size * .025);

  const base = (width: number, y: number, h: number) => {
    roundedRect(ctx, -width / 2, y, width, h, size * .035);
    ctx.fill();
    ctx.stroke();
  };
  const stem = (width: number, y: number, h: number) => {
    roundedRect(ctx, -width / 2, y, width, h, size * .04);
    ctx.fill();
    ctx.stroke();
  };
  if (piece.type === 'p') {
    ctx.beginPath();
    ctx.arc(0, -size * .23, size * .13, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    stem(size * .16, -size * .12, size * .17);
    base(size * .35, size * .035, size * .11);
    base(size * .43, size * .14, size * .11);
  } else if (piece.type === 'n') {
    ctx.beginPath();
    ctx.moveTo(-size * .18, size * .24);
    ctx.lineTo(-size * .2, -size * .12);
    ctx.quadraticCurveTo(-size * .2, -size * .32, -size * .03, -size * .4);
    ctx.lineTo(size * .2, -size * .33);
    ctx.lineTo(size * .13, -size * .19);
    ctx.lineTo(size * .23, -size * .05);
    ctx.lineTo(size * .08, size * .12);
    ctx.lineTo(size * .18, size * .24);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(size * .07, -size * .27, size * .018, 0, Math.PI * 2); ctx.fillStyle = outline; ctx.fill();
    base(size * .46, size * .22, size * .1);
  } else if (piece.type === 'b') {
    ctx.beginPath();
    ctx.moveTo(0, -size * .44);
    ctx.quadraticCurveTo(size * .19, -size * .31, size * .1, -size * .12);
    ctx.lineTo(size * .09, size * .12);
    ctx.lineTo(size * .19, size * .24);
    ctx.lineTo(-size * .19, size * .24);
    ctx.lineTo(-size * .09, size * .12);
    ctx.lineTo(-size * .1, -size * .12);
    ctx.quadraticCurveTo(-size * .19, -size * .31, 0, -size * .44);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-size * .04, -size * .37); ctx.lineTo(size * .05, -size * .13); ctx.strokeStyle = shadow; ctx.stroke();
    base(size * .47, size * .22, size * .1);
  } else if (piece.type === 'r') {
    base(size * .38, -size * .35, size * .13);
    ctx.beginPath();
    ctx.moveTo(-size * .17, -size * .23); ctx.lineTo(size * .17, -size * .23);
    ctx.lineTo(size * .13, size * .13); ctx.lineTo(-size * .13, size * .13); ctx.closePath(); ctx.fill(); ctx.stroke();
    base(size * .48, size * .22, size * .1);
  } else if (piece.type === 'q') {
    ctx.beginPath();
    ctx.moveTo(-size * .23, -size * .32); ctx.lineTo(-size * .13, -size * .09); ctx.lineTo(-size * .06, -size * .28);
    ctx.lineTo(0, -size * .09); ctx.lineTo(size * .08, -size * .29); ctx.lineTo(size * .16, -size * .09); ctx.lineTo(size * .23, -size * .32);
    ctx.lineTo(size * .17, size * .15); ctx.lineTo(-size * .17, size * .15); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const dot of [-.19, 0, .19]) { ctx.beginPath(); ctx.arc(size * dot, -size * .34, size * .045, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    base(size * .48, size * .16, size * .1);
  } else {
    base(size * .31, -size * .4, size * .12);
    stem(size * .17, -size * .3, size * .35);
    ctx.beginPath(); ctx.moveTo(-size * .23, -size * .25); ctx.lineTo(size * .23, -size * .25); ctx.stroke();
    base(size * .46, size * .2, size * .1);
  }
  ctx.restore();
}

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
  const frameRef = useRef<number | undefined>(undefined);
  const destinationMap = new Map(destinations.map((move) => [move.to, move]));

  useEffect(() => {
    const canvas = canvasRef.current;
    const holder = holderRef.current;
    if (!canvas || !holder) return;
    const draw = (timestamp = performance.now()) => {
      const rect = holder.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const size = rect.width;
      canvas.width = Math.max(1, Math.floor(size * dpr));
      canvas.height = Math.max(1, Math.floor(size * dpr));
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
        if (piece) drawPiece(ctx, piece, x * square + square / 2, y * square + square / 2, square * .82);
      }
      if (animation) {
        const [fx, fy] = parseSquare(animation.move.from);
        const [tx, ty] = parseSquare(animation.move.to);
        const eased = 1 - Math.pow(1 - moving, 3);
        drawPiece(ctx, animation.move.piece, (fx + (tx - fx) * eased) * square + square / 2, (fy + (ty - fy) * eased) * square + square / 2, square * .82);
        if (moving < 1) frameRef.current = requestAnimationFrame(draw);
      }
    };
    const resize = new ResizeObserver(() => draw());
    resize.observe(holder);
    draw();
    return () => { resize.disconnect(); if (frameRef.current) cancelAnimationFrame(frameRef.current); };
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
  const [turn, setTurn] = useState<Color>('w');
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState<'playing' | 'success' | 'failure'>('playing');
  const [animation, setAnimation] = useState<Animation | null>(null);
  const timerRef = useRef<number | null>(null);
  const moveCount = history.filter((item) => item.side === 'w').length;
  const selectedMoves = selected ? legalMoves(board, 'w', selected) : [];

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  const reset = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setBoard(parseFen('4k3/5ppp/8/8/2B5/8/4PPPP/3QK1N1 w - - 0 1'));
    setSelected(null); setHistory([]); setCaptured([]); setTurn('w'); setThinking(false); setResult('playing'); setAnimation(null);
  };

  const acceptCpuMove = (currentBoard: Board, moveNumber: number) => {
    const cpuMove = chooseCpuMove(currentBoard);
    if (!cpuMove) {
      setThinking(false); setTurn('w');
      setResult(isInCheck(currentBoard, 'w') ? 'failure' : 'failure');
      return;
    }
    const next = applyMove(currentBoard, cpuMove);
    setAnimation({ move: cpuMove, boardBefore: currentBoard, started: performance.now() });
    setBoard(next);
    setHistory((items) => [...items, { move: cpuMove, label: moveLabel(cpuMove, next), side: 'b' }]);
    if (cpuMove.captured) setCaptured((items) => [...items, cpuMove.captured as Piece]);
    setThinking(false);
    setTurn('w');
    if (isCheckmate(next, 'w') || isStalemate(next, 'w') || moveNumber >= 4) setResult('failure');
    window.setTimeout(() => setAnimation(null), 390);
  };

  const onSquareClick = (square: string) => {
    if (thinking || result !== 'playing' || turn !== 'w') return;
    const piece = board[parseSquare(square)[1]][parseSquare(square)[0]];
    const chosenMove = selectedMoves.find((move) => move.to === square);
    if (chosenMove) {
      const next = applyMove(board, chosenMove);
      setAnimation({ move: chosenMove, boardBefore: board, started: performance.now() });
      setBoard(next);
      setHistory((items) => [...items, { move: chosenMove, label: moveLabel(chosenMove, next), side: 'w' }]);
      if (chosenMove.captured) setCaptured((items) => [...items, chosenMove.captured as Piece]);
      setSelected(null);
      const nextCount = moveCount + 1;
      if (isCheckmate(next, 'b')) {
        setResult('success'); setTurn('w'); window.setTimeout(() => setAnimation(null), 390); return;
      }
      if (isStalemate(next, 'b') || nextCount >= 4) {
        setResult('failure'); setTurn('w'); window.setTimeout(() => setAnimation(null), 390); return;
      }
      setThinking(true); setTurn('b');
      timerRef.current = window.setTimeout(() => acceptCpuMove(next, nextCount), 680);
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
            <div className="position-line" style={{ marginTop: 13 }}><span>PLAYER LIMIT</span><strong>{moveCount} / 4 WHITE MOVES</strong></div>
            <div className="position-line" style={{ marginTop: 13 }}><span>CAPTURED</span><strong data-testid="text-captured">{whiteTaken.length ? `BLACK ${whiteTaken.map((piece) => PIECE_NAMES[piece.type]).join(', ')}` : 'NONE'}</strong></div>
          </div>
          <div className="move-panel">
            <div className="move-panel-head"><div className="section-label">MOVE RECORD</div><div className="move-count">{history.length} PLY</div></div>
            <div className="move-list" data-testid="text-move-history">
              {history.length ? history.map((item, index) => <span key={`${item.label}-${index}`} className={item.side === 'b' ? 'cpu' : ''}>{item.side === 'w' ? `${Math.floor(index / 2) + 1}.` : 'CPU'} {item.label}</span>) : <span className="empty-moves">NO MOVES YET</span>}
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