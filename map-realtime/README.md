# map-realtime

Premium realtime map app built with React + Vite frontend and Node + Socket.IO backend.

```text
┌───────────────────────────── Map (live markers) ─────────────────────────────┐
│  ● you (pulsing)         ○ user-102         ○ user-556                       │
│                                                                             ◱ │
└───────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────── Connected Users (glass panel) ──────────────────┐
│ You  lat: 40.71280  lng: -74.00600  12:03:45 PM                               │
│ user-102 ...                                                                  │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Stack

- Frontend: React 19.2 + Vite 7 + Tailwind CSS 4 + MapLibre GL JS v5.
- Backend: Node.js 24 + Express + Socket.IO 4.8 + TypeScript.

<!-- Version source citations:
React 19.2: https://react.dev/blog
Vite 7: https://vite.dev/blog
Tailwind CSS 4: https://tailwindcss.com/blog
Socket.IO 4.8: https://socket.io/docs/v4/changelog/
MapLibre GL JS v5: https://maplibre.org/maplibre-gl-js/docs/
Node.js 24: https://nodejs.org/en/about/previous-releases
Mapbox GL JS v3: https://docs.mapbox.com/mapbox-gl-js/guides/
-->

## Monorepo layout

- `frontend/` React SPA.
- `backend/` API + Socket server.
- `.github/workflows/ci.yml` CI for lint, typecheck, tests.

## Quick start

```bash
cp .env.example .env
npm ci
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

### Environment

- Frontend:
  - `VITE_SOCKET_URL` (default `http://localhost:4000`)
  - `VITE_MAP_PROVIDER` (`maplibre` | `mapbox`)
  - `VITE_MAPBOX_TOKEN` (optional)
- Backend:
  - `PORT` (default `4000`)
  - `REDIS_URL` (optional)

## How realtime works

1. Client connects over Socket.IO and emits `join` with a generated user name.
2. Client geolocation hook emits `update_location` (debounced to 1s).
3. Server validates and rate-limits location updates (1/s per socket).
4. Server maintains an in-memory map with TTL cleanup every 15s.
5. Server broadcasts full `positions` snapshots every 1s and on key changes.

## Scaling notes

- For horizontal scaling, enable the Redis adapter in `backend/src/sockets.ts`.
- Set `REDIS_URL` and uncomment adapter block.
- This shares Socket.IO rooms/events across instances.

## Deployment notes

- Frontend on Vercel: set build command `npm run build -w frontend` and output `frontend/dist`.
- Backend on Render: `backend/render.yaml` included.
- Docker backend: `backend/Dockerfile` included.

## Useful commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

## Official docs

- React: https://react.dev/
- Node.js: https://nodejs.org/
- Socket.IO: https://socket.io/docs/v4/
- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/

## Contributor commit message guide

Use PR-friendly Conventional Commit messages:

- `feat(frontend): add local marker pulse animation`
- `fix(backend): sanitize invalid location payloads`
- `chore(ci): add node 24 typecheck job`
