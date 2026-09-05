# COD-RTO-frontend

Demo UX for **Find the Signal** — Quessathon 2026 Retail Challenge 01.

Talks to the FastAPI backend in [`COD-RTO-backend`](https://github.com/AdarshZapcom/COD-RTO-backend)
over REST. Shows an order picker (plus an ad-hoc order form for the live
jury curveball), the per-dimension evidence panel, supporting vs.
counter-evidence, historical precedent, the RELEASE / HOLD_FOR_VERIFICATION /
ESCALATE decision, the narrative (LLM or template fallback, clearly
tagged), operational insights, and open escalation tickets.

See `docs/tasks/06-react-frontend.md` in the backend repo for the full
component/spec breakdown.

## Stack

React + Vite, plain fetch against `VITE_API_BASE_URL`.

## Prerequisites

- Node.js 18+ (developed/tested on Node 24, npm 11)
- The FastAPI backend running (see `COD-RTO-backend`'s README) — this app
  has nothing to show without it

## Setup

```
npm install
copy .env.example .env      # macOS/Linux: cp .env.example .env
npm run dev
```

`npm install` pulls in React 18, Vite 5, and the React Vite plugin — no
other tools required.

## Environment variables

Copy `.env.example` to `.env` and set:

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Base URL of the running FastAPI backend, e.g. `http://localhost:8000` |

## Run the dev server

```
npm install
npm run dev
```

Starts the Vite dev server (default `http://localhost:5173`), pointed at
`VITE_API_BASE_URL` from `.env`. Requires the backend (`uvicorn
src.api:app --reload --port 8000` in `COD-RTO-backend`) to already be
running.

## Production build

```
npm run build      # outputs to dist/
npm run preview    # serves the built dist/ locally
```
