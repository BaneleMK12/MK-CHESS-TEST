# MK Chess Test

A standalone browser version of Challenge 01 from MK Board Games.

## Challenge

Find Scholar's Mate from the authored sparse position:

- White: Ke1, Qd1, Bc4, Ng1, pawns e2/f2/g2/h2
- Black: Ke8, pawns f7/g7/h7
- White moves first
- Deliver checkmate in 4 moves or fewer

All moves are manual. There is no autoplay or AI opponent.

## Run locally

```bash
pnpm install
pnpm dev
```

Create a production build with:

```bash
pnpm build
pnpm preview
```

## Included

- Legal chess move generation with check, checkmate, and stalemate detection
- Manual piece selection with legal destination feedback
- Captures and promotion choices
- Last-move highlighting and short piece movement animation
- Captured-piece tracking and move record
- Four-white-move challenge limit with success and failure states
- Responsive desktop and mobile layout