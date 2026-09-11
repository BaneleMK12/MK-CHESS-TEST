# MK Chess Test

A standalone browser chess challenge based on MK Board Games Challenge 01.

- Manual White play only — no autoplay or auto-solver
- Deterministic CPU replies
- Local transparent PNG chess pieces and canvas-rendered board highlights
- Legal move handling, move animation, move history, captures, and reset
- Web-only four-player-move limit

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
