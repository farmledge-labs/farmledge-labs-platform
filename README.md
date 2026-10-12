# farmledge-platform

Private monorepo for Farmledge — agricultural inventory finance on Stellar.

## Apps

| App | Description | Dev URL |
|-----|-------------|---------|
| `apps/api` | Backend REST API (Express + PostgreSQL) | http://localhost:3000 |
| `apps/custodian` | Custodian dashboard (React + Vite) | http://localhost:5173 |
| `apps/farmer` | Farmer web app / PWA (React + Vite) | http://localhost:5174 |
| `apps/lender` | Lender portal (React + Vite) | http://localhost:5175 |

## Packages

| Package | Description |
|---------|-------------|
| `packages/shared` | Shared TypeScript types and utilities |

## Setup

### Prerequisites
- Node.js >= 20
- npm >= 10
- Docker + Docker Compose

### Install

```bash
npm install
```

### Local setup (one-command Docker dev environment)

The simplest way to run the full API + database stack locally:

```bash
# 1. Copy the example env file (repo root — Docker Compose reads from here)
cp apps/api/.env.example .env

# 2. Edit .env and set real values for any secrets you need
#    Minimum required: JWT_SECRET, PLATFORM_ADMIN_SECRET, LENDER_API_KEY_SALT,
#    STELLAR_PLATFORM_SECRET, S3_BUCKET, S3_REGION
#    Leave DATABASE_URL / DIRECT_URL as-is — docker-compose overrides them to
#    use the internal "postgres" hostname automatically.

# 3. Build and start everything (API + PostgreSQL + Redis)
docker compose up --build

# 4. Verify the API is healthy
curl -i http://localhost:3000/health
# → HTTP/1.1 200 OK
# → {"status":"ok","version":"0.1.0","service":"farmledge-api"}
```

**Docker build context note:** The Dockerfile lives at the repo root and uses
the entire monorepo as build context. It copies `packages/shared` (the workspace
package) and `apps/api` in a single build — no separate build step needed.
`@stellar/stellar-sdk` is a regular npm package and is installed automatically.

**Compose hostname override:** `docker-compose.yml` automatically sets
`DATABASE_URL` and `DIRECT_URL` to use the Compose-internal `postgres` hostname,
overriding whatever is in `.env`. You do not need to maintain two copies of the
connection string.

**Production note:** The `postgres` service in `docker-compose.yml` is for local
development only. Production uses Supabase — set `DATABASE_URL` / `DIRECT_URL` to
your Supabase connection strings.

### Running tests without Docker

```bash
cd apps/api

# Copy the example env (tests use node --env-file-if-exists=.env)
cp .env.example .env

# Run the test suite
npm test
```

### Start infrastructure (legacy / alternative)

```bash
docker-compose -f infrastructure/docker-compose.yml up -d
```

### Environment

Copy `.env.example` in `apps/api` and fill in values:

```bash
cp apps/api/.env.example apps/api/.env
```

### Run apps

```bash
# API
npm run --workspace=apps/api dev

# Custodian dashboard
npm run --workspace=apps/custodian dev

# Farmer app
npm run --workspace=apps/farmer dev

# Lender portal
npm run --workspace=apps/lender dev
```

## Monorepo Structure

```
farmledge-platform/
├── apps/
│   ├── api/          # Express API
│   ├── custodian/    # Custodian React app
│   ├── farmer/       # Farmer React PWA
│   └── lender/       # Lender React app
├── packages/
│   └── shared/       # Shared types & utils
├── infrastructure/
│   ├── docker-compose.yml
│   └── nginx/
└── .github/
    └── workflows/
```

## Tech Stack

- **Backend**: Node.js 20, Express, PostgreSQL, Stellar SDK, Zod, Pino
- **Frontend**: React 18, Vite, Tailwind CSS, Stellar SDK
- **Infra**: Docker, PostgreSQL 16, Redis 7, Nginx
- **Blockchain**: Stellar Network
