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

## Setup

```
npm install
npm run dev
```
