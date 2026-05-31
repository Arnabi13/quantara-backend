# Quantara — Backend

NestJS REST API for the Quantara NSE stock market dashboard. Handles authentication and watchlist persistence via PostgreSQL.

## Tech Stack

| Tool | Version | Role |
|---|---|---|
| NestJS | 11 | API framework |
| TypeScript | 5.7 | Type safety |
| Prisma | 6 | ORM & migrations |
| PostgreSQL | — | Database |
| Passport + JWT | — | Authentication |
| class-validator | — | DTO validation |

## Prerequisites

- Node.js 20+
- PostgreSQL database (local or hosted)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your env file from the example
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET

# 3. Run database migrations
npx prisma migrate dev

# 4. Start the dev server
npm run start:dev
```

API runs at **http://localhost:4000**.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret used to sign JWT tokens |
| `JWT_EXPIRES_IN` | No | Token expiry duration (default: `7d`) |

Example `DATABASE_URL`:
```
postgresql://postgres:password@localhost:5432/quantara
```

## Available Scripts

```bash
npm run start:dev      # Watch mode (restarts on file change)
npm run start:prod     # Production mode (requires prior build)
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

## Database Schema

```
User
  id          String    (UUID, PK)
  email       String    (unique)
  password    String    (bcrypt hashed)
  firstName   String?
  lastName    String?
  createdAt   DateTime
  updatedAt   DateTime
  watchlist   Watchlist[]

Watchlist
  id          String    (UUID, PK)
  symbol      String    (NSE ticker, e.g. "HDFCBANK")
  userId      String    (FK → User)
  createdAt   DateTime
  @@unique([userId, symbol])
```

## CORS

Configured to allow requests from `http://localhost:5173` (the Vite dev server). Update `main.ts` for production origins.
