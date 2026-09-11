export type Color = 'w' | 'b';
export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export type Piece = {
  color: Color;
  type: PieceType;
};

export type Board = Array<Array<Piece | null>>;

export type Move = {
  from: string;
  to: string;
  piece: Piece;
  captured?: Piece;
  promotion?: PieceType;
};

export const START_FEN =
  '4k3/5ppp/8/8/2B5/8/4PPPP/3QK1N1 w - - 0 1';

export const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function parseSquare(square: string): [number, number] {
  return [files.indexOf(square[0]), 8 - Number(square[1])];
}

export function squareName(x: number, y: number): string {
  return `${files[x]}${8 - y}`;
}

export function parseFen(fen: string): Board {
  const board: Board = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
  fen.split(' ')[0].split('/').forEach((rank, y) => {
    let x = 0;
    for (const symbol of rank) {
      if (/\d/.test(symbol)) x += Number(symbol);
      else {
        const color = symbol === symbol.toUpperCase() ? 'w' : 'b';
        board[y][x] = { color, type: symbol.toLowerCase() as PieceType };
        x += 1;
      }
    }
  });
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((rank) => rank.map((piece) => (piece ? { ...piece } : null)));
}

function inside(x: number, y: number) {
  return x >= 0 && x < 8 && y >= 0 && y < 8;
}

function locateKing(board: Board, color: Color) {
  for (let y = 0; y < 8; y += 1)
    for (let x = 0; x < 8; x += 1)
      if (board[y][x]?.type === 'k' && board[y][x]?.color === color) return [x, y] as [number, number];
  return null;
}

function attacksSquare(board: Board, fromX: number, fromY: number, targetX: number, targetY: number) {
  const piece = board[fromY][fromX];
  if (!piece) return false;
  const dx = targetX - fromX;
  const dy = targetY - fromY;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (piece.type === 'p') {
    const direction = piece.color === 'w' ? -1 : 1;
    return dy === direction && ax === 1;
  }
  if (piece.type === 'n') return (ax === 1 && ay === 2) || (ax === 2 && ay === 1);
  if (piece.type === 'k') return Math.max(ax, ay) === 1;
  const diagonal = ax === ay && ax > 0;
  const straight = (dx === 0) !== (dy === 0);
  const canSlide = piece.type === 'q' || (piece.type === 'b' && diagonal) || (piece.type === 'r' && straight);
  if (!canSlide) return false;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  let x = fromX + stepX;
  let y = fromY + stepY;
  while (x !== targetX || y !== targetY) {
    if (board[y][x]) return false;
    x += stepX;
    y += stepY;
  }
  return true;
}

export function isInCheck(board: Board, color: Color) {
  const king = locateKing(board, color);
  if (!king) return true;
  const opponent = color === 'w' ? 'b' : 'w';
  for (let y = 0; y < 8; y += 1)
    for (let x = 0; x < 8; x += 1)
      if (board[y][x]?.color === opponent && attacksSquare(board, x, y, king[0], king[1])) return true;
  return false;
}

function pseudoMoves(board: Board, from: string): Move[] {
  const [x, y] = parseSquare(from);
  const piece = board[y][x];
  if (!piece) return [];
  const moves: Move[] = [];
  const add = (toX: number, toY: number, promotion?: PieceType) => {
    if (!inside(toX, toY)) return;
    const target = board[toY][toX];
    if (target?.color === piece.color || target?.type === 'k') return;
    moves.push({
      from,
      to: squareName(toX, toY),
      piece,
      captured: target ?? undefined,
      promotion,
    });
  };
  if (piece.type === 'p') {
    const direction = piece.color === 'w' ? -1 : 1;
    const startRank = piece.color === 'w' ? 6 : 1;
    if (inside(x, y + direction) && !board[y + direction][x]) {
      add(x, y + direction, y + direction === 0 || y + direction === 7 ? 'q' : undefined);
      if (y === startRank && !board[y + direction * 2][x]) add(x, y + direction * 2);
    }
    for (const dx of [-1, 1]) {
      const tx = x + dx;
      const ty = y + direction;
      if (inside(tx, ty) && board[ty][tx]?.color !== piece.color && board[ty][tx]) {
        add(tx, ty, ty === 0 || ty === 7 ? 'q' : undefined);
      }
    }
    return moves;
  }
  if (piece.type === 'n') {
    for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) add(x + dx, y + dy);
    return moves;
  }
  if (piece.type === 'k') {
    for (let dx = -1; dx <= 1; dx += 1)
      for (let dy = -1; dy <= 1; dy += 1)
        if (dx || dy) add(x + dx, y + dy);
    return moves;
  }
  const directions =
    piece.type === 'b' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] :
      piece.type === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] :
        [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of directions) {
    let tx = x + dx;
    let ty = y + dy;
    while (inside(tx, ty)) {
      const target = board[ty][tx];
      if (target?.color === piece.color) break;
      if (target?.type === 'k') break;
      add(tx, ty);
      if (target) break;
      tx += dx;
      ty += dy;
    }
  }
  return moves;
}

export function applyMove(board: Board, move: Move): Board {
  const next = cloneBoard(board);
  const [fromX, fromY] = parseSquare(move.from);
  const [toX, toY] = parseSquare(move.to);
  next[toY][toX] = move.promotion ? { color: move.piece.color, type: move.promotion } : { ...move.piece };
  next[fromY][fromX] = null;
  return next;
}

export function legalMoves(board: Board, color: Color, from?: string): Move[] {
  const candidates: Move[] = [];
  if (from) candidates.push(...pseudoMoves(board, from));
  else {
    for (let y = 0; y < 8; y += 1)
      for (let x = 0; x < 8; x += 1)
        if (board[y][x]?.color === color) candidates.push(...pseudoMoves(board, squareName(x, y)));
  }
  return candidates.filter((move) => !isInCheck(applyMove(board, move), color));
}

export function isCheckmate(board: Board, color: Color) {
  return isInCheck(board, color) && legalMoves(board, color).length === 0;
}

export function isStalemate(board: Board, color: Color) {
  return !isInCheck(board, color) && legalMoves(board, color).length === 0;
}

export function moveLabel(move: Move, boardAfter: Board) {
  const capture = move.captured ? '×' : '→';
  const check = isInCheck(boardAfter, move.piece.color === 'w' ? 'b' : 'w') ? '+' : '';
  const names: Record<PieceType, string> = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: '' };
  return `${names[move.piece.type]}${move.from}${capture}${move.to}${move.promotion ? '=Q' : ''}${check}`;
}

const pieceValue: Record<PieceType, number> = { p: 1, n: 3, b: 3.2, r: 5, q: 9, k: 100 };

export function chooseCpuMove(board: Board): Move | null {
  const moves = legalMoves(board, 'b');
  if (!moves.length) return null;
  const ranked = moves.map((move) => {
    const after = applyMove(board, move);
    const givesMate = isCheckmate(after, 'w');
    const givesCheck = isInCheck(after, 'w');
    const [x, y] = parseSquare(move.to);
    return {
      move,
      score:
        (givesMate ? 10000 : 0) +
        (givesCheck ? 400 : 0) +
        (move.captured ? pieceValue[move.captured.type] * 30 : 0) +
        (7 - y) * 0.02 +
        x * 0.001,
    };
  });
  ranked.sort((a, b) => b.score - a.score || a.move.from.localeCompare(b.move.from) || a.move.to.localeCompare(b.move.to));
  return ranked[0].move;
}