# Quantara — Backend

NestJS REST API for the Quantara NSE stock market dashboard. Handles authentication and watchlist persistence via PostgreSQL.

## Tech Stack

| Tool | Version | Role |
|---|---|---|
| NestJS | 11 | API framework |
| TypeScript | 5.7 | Type safety |
| Prisma | 6 | ORM & migrations |
| PostgreSQL | — | Database |
| Redis (ioredis) | 5 | Rate limiting, pub/sub notifications, Binance ticker cache |
| Socket.IO | 4 | Live market data (`/market` namespace) |
| Groq SDK | — | AI chat assistant |
| Passport + JWT | — | Authentication |
| class-validator | — | DTO validation |

## Prerequisites

- Node.js 20+
- PostgreSQL database (local or hosted)
- Redis instance (local or hosted, e.g. [Upstash](https://upstash.com))
- Groq API key for AI chat (optional — get one at [console.groq.com](https://console.groq.com))

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your env file from the example
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, REDIS_URL, GROQ_API_KEY

# 3. Run database migrations
npx prisma migrate dev

# 4. Start the dev server
npm run start:dev
```

API runs at **http://localhost:4000**.

## Environment Variables

See [`.env.example`](.env.example) for the full list with placeholder values.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret used to sign JWT tokens |
| `JWT_EXPIRES_IN` | No | Token expiry duration (default: `7d`) |
| `PORT` | No | Port to listen on (default: `4000`) |
| `REDIS_URL` | Yes | Redis connection string (use `rediss://` for TLS providers like Upstash) |
| `GROQ_API_KEY` | Yes (for AI chat) | Groq API key used by the `/ai/chat` endpoint |
| `FRONTEND_URL` | No | Comma-separated list of allowed CORS origins (default: `http://localhost:5173`) |

Example `DATABASE_URL`:
```
postgresql://postgres:password@localhost:5432/quantara
```

## Available Scripts

```bash
npm run start:dev      # Watch mode (restarts on file change)
npm run start:prod     # Production mode (requires prior build)
npm run start:render   # Run pending migrations, then start (used as the Render start command)
npm run build          # Compile TypeScript → dist/
npm run test           # Jest unit tests
npm run test:e2e       # End-to-end tests
npx tsc --noEmit       # Type-check without emitting
npx prisma migrate dev # Apply pending migrations
npx prisma studio      # Open Prisma DB browser GUI
```

## API Reference

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | `{ email, password, firstName?, lastName? }` | Create account |
| `POST` | `/auth/login` | `{ email, password }` | Returns `{ access_token }` |

### Watchlist

All watchlist endpoints require a valid JWT in the `Authorization: Bearer <token>` header.

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/watchlist` | — | List symbols for authenticated user |
| `POST` | `/watchlist` | `{ symbol: string }` | Add symbol to watchlist |
| `DELETE` | `/watchlist/:symbol` | — | Remove symbol from watchlist |

### Portfolio

JWT required.

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/portfolio` | — | List open positions for authenticated user |
| `POST` | `/portfolio` | `{ symbol, qty, price }` | Buy/add to a position |
| `POST` | `/portfolio/sell` | `{ symbol, qty, price }` | Sell from a position |
| `DELETE` | `/portfolio/:symbol` | — | Remove a position entirely |
| `GET` | `/portfolio/transactions?page=&limit=` | — | Paginated transaction history |

### Alerts

JWT required.

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/alerts` | — | List price alerts for authenticated user |
| `POST` | `/alerts` | `{ symbol, condition: "above"\|"below", targetPrice }` | Create a price alert |
| `DELETE` | `/alerts/:id` | — | Remove an alert |

A scheduled `AlertEvaluatorService` checks alert conditions and creates notifications when triggered.

### Notifications

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/notifications/stream?token=<jwt>` | — | SSE stream of live notifications (JWT passed as query param, since `EventSource` can't send headers) |
| `GET` | `/notifications` | — | List notifications (JWT required) |
| `PATCH` | `/notifications/:id/read` | — | Mark one notification as read (JWT required) |
| `POST` | `/notifications/read-all` | — | Mark all as read (JWT required) |
| `DELETE` | `/notifications` | — | Clear all notifications (JWT required) |

### AI Chat

JWT required, rate-limited via Redis (20 requests / 60s).

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/ai/chat` | `{ message, history? }` | Streams an AI assistant response (SSE) via Groq |

### Live Market Data (WebSocket)

Socket.IO namespace `/market` streams live Binance ticker/kline/depth/trade data, cached and rebroadcast through Redis. Clients `subscribe`/`unsubscribe` to rooms (`ticker`, `kline:<symbol>`, `depth:<symbol>`, `trade:<symbol>`).

## Database Schema

```
User
  id            String         (UUID, PK)
  email         String         (unique)
  password      String         (bcrypt hashed)
  firstName     String?
  lastName      String?
  createdAt     DateTime
  updatedAt     DateTime
  watchlist     Watchlist[]
  alerts        Alert[]
  notifications Notification[]
  positions     Position[]
  transactions  Transaction[]

Watchlist
  id          String    (UUID, PK)
  symbol      String    (NSE ticker, e.g. "HDFCBANK")
  userId      String    (FK → User)
  createdAt   DateTime
  @@unique([userId, symbol])

Position
  id           String        (UUID, PK)
  userId       String        (FK → User)
  symbol       String
  qty          Float
  avgBuy       Float
  createdAt    DateTime
  updatedAt    DateTime
  transactions Transaction[]
  @@unique([userId, symbol])

Transaction
  id         String   (UUID, PK)
  userId     String   (FK → User)
  positionId String?  (FK → Position, nullable)
  symbol     String
  type       "BUY" | "SELL"
  qty        Float
  price      Float
  executedAt DateTime

Alert
  id            String         (UUID, PK)
  userId        String         (FK → User)
  symbol        String
  condition     "above" | "below"
  targetPrice   Float
  isActive      Boolean
  createdAt     DateTime
  triggeredAt   DateTime?
  notifications Notification[]

Notification
  id        String   (UUID, PK)
  userId    String   (FK → User)
  alertId   String?  (FK → Alert, nullable)
  symbol    String
  message   String
  isRead    Boolean
  createdAt DateTime
```

## CORS

Allowed origins come from the `FRONTEND_URL` env var (comma-separated for multiple origins, e.g. local dev + production). Falls back to `http://localhost:5173` if unset. This applies to both the REST API (`main.ts`) and the `/market` WebSocket gateway (`binance/market.gateway.ts`).

## Deployment (free tier)

This stack deploys for free on **Render** (API + WebSockets), **Neon** (Postgres), and **Upstash** (Redis).

1. **Database — [Neon](https://neon.tech)**
   - Create a free project, then copy the pooled connection string into `DATABASE_URL`.

2. **Redis — [Upstash](https://upstash.com)**
   - Create a free Redis database (any region), then copy the `rediss://...` connection string into `REDIS_URL`. `ioredis` enables TLS automatically for `rediss://` URLs.

3. **API — [Render](https://render.com)**
   - New → Web Service → connect the `quantara-backend` GitHub repo.
   - Environment: **Node**
   - Build command: `npm install && npm run build`
   - Start command: `npm run start:render` (runs `prisma migrate deploy` before starting, so production migrations apply automatically on each deploy)
   - Instance type: **Free**
   - Add environment variables: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` (generate a new strong secret — **do not reuse the local dev value**), `JWT_EXPIRES_IN`, `GROQ_API_KEY`, `FRONTEND_URL` (your Vercel frontend URL)

4. **Frontend**
   - In the `quantara` Vercel project, set `VITE_API_URL` to your Render service URL and redeploy.

5. **Wire CORS up**
   - Once both are live, set `FRONTEND_URL` on Render to your Vercel production URL (and any preview domains, comma-separated) and redeploy the backend.

### Free-tier caveats

- Render free web services **sleep after 15 minutes of inactivity**. The first request after sleeping takes ~30-60s (cold start) and any open WebSocket/SSE connections are dropped until the service wakes back up.
- Neon and Upstash free tiers have usage caps suitable for personal/demo projects, not production traffic.
- Never commit `.env` or paste real secrets into READMEs/code — set them only in the Render/Vercel dashboards.
