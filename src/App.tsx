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

function drawReferencePath(
  ctx: CanvasRenderingContext2D,
  build: () => void,
  fill: CanvasGradient,
  edge: string,
) {
  ctx.beginPath();
  build();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.stroke();
}

function drawReferenceBase(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  fill: CanvasGradient,
  edge: string,
  detail: string,
) {
  roundedRect(ctx, cx - scale * .22, cy + scale * .21, scale * .44, scale * .13, scale * .035);
  ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
  roundedRect(ctx, cx - scale * .275, cy + scale * .30, scale * .55, scale * .13, scale * .055);
  ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = edge; ctx.stroke();
  ctx.strokeStyle = detail;
  ctx.beginPath();
  ctx.moveTo(cx - scale * .20, cy + scale * .265);
  ctx.lineTo(cx + scale * .20, cy + scale * .265);
  ctx.moveTo(cx - scale * .245, cy + scale * .365);
  ctx.lineTo(cx + scale * .245, cy + scale * .365);
  ctx.stroke();
}

function drawReferenceBand(ctx: CanvasRenderingContext2D, cx: number, y: number, halfWidth: number, scale: number, detail: string) {
  ctx.strokeStyle = detail;
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth, y);
  ctx.lineTo(cx + halfWidth, y);
  ctx.moveTo(cx - halfWidth * .82, y + scale * .025);
  ctx.lineTo(cx + halfWidth * .82, y + scale * .025);
  ctx.stroke();
}

function drawReferencePiece(ctx: CanvasRenderingContext2D, piece: Piece, cx: number, cy: number, scale: number) {
  const isWhite = piece.color === 'w';
  const fill = ctx.createLinearGradient(cx - scale * .24, cy - scale * .46, cx + scale * .24, cy + scale * .42);
  if (isWhite) {
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(.52, '#e8e1d8');
    fill.addColorStop(1, '#9d9185');
  } else {
    fill.addColorStop(0, '#555c68');
    fill.addColorStop(.52, '#2a303c');
    fill.addColorStop(1, '#0b0e15');
  }
  const edge = isWhite ? '#312a29' : '#f1d7b9';
  const detail = isWhite ? 'rgba(255,255,255,.62)' : 'rgba(207,216,228,.68)';
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, scale * .03);
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = scale * .035;
  ctx.shadowOffsetY = scale * .04;
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + scale * .405, scale * .255, scale * .055, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  const path = (build: () => void) => drawReferencePath(ctx, build, fill, edge);
  if (piece.type === 'p') {
    path(() => {
      ctx.moveTo(cx - scale * .095, cy - scale * .17);
      ctx.bezierCurveTo(cx - scale * .105, cy - scale * .06, cx - scale * .095, cy + scale * .07, cx - scale * .145, cy + scale * .18);
      ctx.bezierCurveTo(cx - scale * .17, cy + scale * .235, cx - scale * .19, cy + scale * .27, cx - scale * .20, cy + scale * .30);
      ctx.lineTo(cx + scale * .20, cy + scale * .30);
      ctx.bezierCurveTo(cx + scale * .19, cy + scale * .27, cx + scale * .17, cy + scale * .235, cx + scale * .145, cy + scale * .18);
      ctx.bezierCurveTo(cx + scale * .095, cy + scale * .07, cx + scale * .105, cy - scale * .06, cx + scale * .095, cy - scale * .17);
      ctx.closePath();
    });
    ctx.fillStyle = fill; ctx.strokeStyle = edge;
    ctx.beginPath(); ctx.ellipse(cx, cy - scale * .17, scale * .14, scale * .045, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - scale * .30, scale * .108, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = detail; ctx.beginPath(); ctx.moveTo(cx - scale * .09, cy - scale * .315); ctx.lineTo(cx + scale * .045, cy - scale * .355); ctx.stroke();
  } else if (piece.type === 'r') {
    path(() => {
      ctx.moveTo(cx - scale * .165, cy - scale * .27);
      ctx.bezierCurveTo(cx - scale * .15, cy - scale * .14, cx - scale * .13, cy + scale * .08, cx - scale * .17, cy + scale * .30);
      ctx.lineTo(cx + scale * .17, cy + scale * .30);
      ctx.bezierCurveTo(cx + scale * .13, cy + scale * .08, cx + scale * .15, cy - scale * .14, cx + scale * .165, cy - scale * .27);
      ctx.closePath();
    });
    path(() => {
      ctx.moveTo(cx - scale * .20, cy - scale * .24); ctx.lineTo(cx - scale * .20, cy - scale * .43);
      ctx.lineTo(cx - scale * .125, cy - scale * .43); ctx.lineTo(cx - scale * .125, cy - scale * .35);
      ctx.lineTo(cx - scale * .045, cy - scale * .35); ctx.lineTo(cx - scale * .045, cy - scale * .43);
      ctx.lineTo(cx + scale * .045, cy - scale * .43); ctx.lineTo(cx + scale * .045, cy - scale * .35);
      ctx.lineTo(cx + scale * .125, cy - scale * .35); ctx.lineTo(cx + scale * .125, cy - scale * .43);
      ctx.lineTo(cx + scale * .20, cy - scale * .43); ctx.lineTo(cx + scale * .20, cy - scale * .24); ctx.closePath();
    });
    drawReferenceBand(ctx, cx, cy - scale * .235, scale * .18, scale, detail);
  } else if (piece.type === 'n') {
    path(() => {
      ctx.moveTo(cx - scale * .18, cy + scale * .30);
      ctx.bezierCurveTo(cx - scale * .19, cy + scale * .14, cx - scale * .205, cy + scale * .025, cx - scale * .18, cy - scale * .085);
      ctx.bezierCurveTo(cx - scale * .16, cy - scale * .16, cx - scale * .20, cy - scale * .22, cx - scale * .23, cy - scale * .28);
      ctx.lineTo(cx - scale * .13, cy - scale * .30);
      ctx.bezierCurveTo(cx - scale * .10, cy - scale * .34, cx - scale * .105, cy - scale * .405, cx - scale * .08, cy - scale * .445);
      ctx.lineTo(cx - scale * .015, cy - scale * .375);
      ctx.bezierCurveTo(cx + scale * .045, cy - scale * .43, cx + scale * .12, cy - scale * .43, cx + scale * .17, cy - scale * .38);
      ctx.bezierCurveTo(cx + scale * .15, cy - scale * .32, cx + scale * .20, cy - scale * .27, cx + scale * .195, cy - scale * .18);
      ctx.bezierCurveTo(cx + scale * .19, cy - scale * .07, cx + scale * .13, cy + scale * .08, cx + scale * .16, cy + scale * .30);
      ctx.closePath();
    });
    ctx.strokeStyle = detail; ctx.beginPath();
    ctx.moveTo(cx - scale * .14, cy - scale * .30); ctx.lineTo(cx + scale * .12, cy - scale * .35);
    ctx.moveTo(cx - scale * .13, cy - scale * .10); ctx.lineTo(cx + scale * .055, cy - scale * .16); ctx.stroke();
  } else if (piece.type === 'b') {
    path(() => {
      ctx.moveTo(cx - scale * .115, cy - scale * .19);
      ctx.bezierCurveTo(cx - scale * .12, cy - scale * .08, cx - scale * .13, cy + scale * .09, cx - scale * .17, cy + scale * .30);
      ctx.lineTo(cx + scale * .17, cy + scale * .30);
      ctx.bezierCurveTo(cx + scale * .13, cy + scale * .09, cx + scale * .12, cy - scale * .08, cx + scale * .115, cy - scale * .19);
      ctx.closePath();
    });
    path(() => {
      ctx.moveTo(cx, cy - scale * .47);
      ctx.bezierCurveTo(cx - scale * .11, cy - scale * .40, cx - scale * .14, cy - scale * .27, cx - scale * .10, cy - scale * .19);
      ctx.lineTo(cx + scale * .10, cy - scale * .19);
      ctx.bezierCurveTo(cx + scale * .14, cy - scale * .27, cx + scale * .11, cy - scale * .40, cx, cy - scale * .47);
      ctx.closePath();
    });
    ctx.strokeStyle = detail; ctx.beginPath(); ctx.moveTo(cx - scale * .04, cy - scale * .405); ctx.lineTo(cx + scale * .045, cy - scale * .245); ctx.stroke();
    drawReferenceBand(ctx, cx, cy - scale * .18, scale * .12, scale, detail);
  } else if (piece.type === 'q') {
    path(() => {
      ctx.moveTo(cx - scale * .13, cy - scale * .20);
      ctx.bezierCurveTo(cx - scale * .13, cy - scale * .05, cx - scale * .12, cy + scale * .10, cx - scale * .18, cy + scale * .30);
      ctx.lineTo(cx + scale * .18, cy + scale * .30);
      ctx.bezierCurveTo(cx + scale * .12, cy + scale * .10, cx + scale * .13, cy - scale * .05, cx + scale * .13, cy - scale * .20);
      ctx.closePath();
    });
    path(() => {
      ctx.moveTo(cx - scale * .205, cy - scale * .20); ctx.lineTo(cx - scale * .17, cy - scale * .40);
      ctx.bezierCurveTo(cx - scale * .13, cy - scale * .34, cx - scale * .095, cy - scale * .30, cx - scale * .055, cy - scale * .39);
      ctx.lineTo(cx, cy - scale * .30); ctx.lineTo(cx + scale * .055, cy - scale * .39);
      ctx.bezierCurveTo(cx + scale * .095, cy - scale * .30, cx + scale * .13, cy - scale * .34, cx + scale * .17, cy - scale * .40);
      ctx.lineTo(cx + scale * .205, cy - scale * .20); ctx.closePath();
    });
    drawReferenceBand(ctx, cx, cy - scale * .19, scale * .18, scale, detail);
  } else {
    path(() => {
      ctx.moveTo(cx - scale * .135, cy - scale * .20);
      ctx.bezierCurveTo(cx - scale * .14, cy - scale * .05, cx - scale * .13, cy + scale * .10, cx - scale * .18, cy + scale * .30);
      ctx.lineTo(cx + scale * .18, cy + scale * .30);
      ctx.bezierCurveTo(cx + scale * .13, cy + scale * .10, cx + scale * .14, cy - scale * .05, cx + scale * .135, cy - scale * .20);
      ctx.closePath();
    });
    ctx.fillStyle = fill; ctx.strokeStyle = edge;
    roundedRect(ctx, cx - scale * .18, cy - scale * .35, scale * .36, scale * .17, scale * .035); ctx.fill(); ctx.stroke();
    roundedRect(ctx, cx - scale * .026, cy - scale * .49, scale * .052, scale * .20, scale * .012); ctx.stroke();
    roundedRect(ctx, cx - scale * .085, cy - scale * .425, scale * .17, scale * .05, scale * .012); ctx.stroke();
    drawReferenceBand(ctx, cx, cy - scale * .19, scale * .18, scale, detail);
  }
  drawReferenceBase(ctx, cx, cy, scale, fill, edge, detail);
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
  const destinationMap = new Map(destinations.map((move) => [move.to, move]));

  useEffect(() => {
    const canvas = canvasRef.current;
    const holder = holderRef.current;
    if (!canvas || !holder) return;
    let frame: number | null = null;
    let size = 0;
    let dpr = 1;
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
        if (piece) drawReferencePiece(ctx, piece, x * square + square / 2, y * square + square / 2, square);
      }
      if (animation) {
        const [fx, fy] = parseSquare(animation.move.from);
        const [tx, ty] = parseSquare(animation.move.to);
        const eased = moving < 0.5 ? 4 * moving * moving * moving : 1 - Math.pow(-2 * moving + 2, 3) / 2;
        drawReferencePiece(ctx, animation.move.piece, (fx + (tx - fx) * eased) * square + square / 2, (fy + (ty - fy) * eased) * square + square / 2, square);
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
    return () => { observer.disconnect(); if (frame !== null) cancelAnimationFrame(frame); };
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