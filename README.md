# MK Chess Test

A standalone browser chess challenge based on MK Board Games.

- Manual White play only — no autoplay or auto-solver
- Deterministic CPU replies
- Challenge 02 unlocks after completing Challenge 01 and removes White's queen
- Local transparent PNG chess pieces and canvas-rendered board highlights
- Legal move handling, move animation, move history, captures, and reset
- Web-only four-player-move limit for Challenge 01 and eight-player-move limit for Challenge 02

The piece artwork is based on the Cburnett set from the Lichess project and is
stored locally under `public/pieces/` as PNG files for reliable rendering.

## Run locally

```bash
pnpm install
pnpm dev
```

## Build

```bash
pnpm build
```
