# OneAce — Local Setup

This document walks you through running OneAce (Next.js 15 + Prisma + Postgres) locally from scratch. Sprint 0 deliverable: **sign up → see the dashboard → sign out**, with `tsc` green and `next build` green.

## 1. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 20.11 (22.x recommended) | `node -v` |
| pnpm | ≥ 9.12 | `corepack enable && corepack prepare pnpm@9.12.0 --activate` |
| Postgres | 15+ | Docker locally, Neon, Supabase, or Railway — all work |
| Git | any | to clone the repo |

> npm also works (the repo was set up with pnpm but there is no lockfile yet). pnpm is preferred.

## 2. Install

```bash
# 1. Clone the repo (or open this folder)
cd oneace-next

# 2. Install dependencies
pnpm install
# or: npm install

# 3. Create your .env
cp .env.example .env
```

## 3. Provision Postgres

### Option A — Neon (recommended, free, up in seconds)

1. https://neon.tech → Sign up
2. "Create Project" → pick the region closest to your users (e.g. `eu-central-1` for Europe, `us-east-1` for North America)
3. Database name: `oneace_dev`
4. From the dashboard copy the connection strings — you need both the **pooled** and **direct** URLs.
5. Fill in `.env`:

```env
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/oneace_dev?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/oneace_dev?sslmode=require"
```

### Option B — Local Docker

```bash
docker run --name oneace-pg \
  -e POSTGRES_PASSWORD=oneace \
  -e POSTGRES_DB=oneace_dev \
  -p 5432:5432 \
  -d postgres:16
```

`.env`:

```env
DATABASE_URL="postgresql://postgres:oneace@localhost:5432/oneace_dev"
DIRECT_URL="postgresql://postgres:oneace@localhost:5432/oneace_dev"
```

## 4. Better Auth Secret

Generate a random 32-byte hex string and add it to `.env`:

```bash
# macOS / Linux
openssl rand -hex 32
```

```env
BETTER_AUTH_SECRET="<<paste output>>"
BETTER_AUTH_URL="http://localhost:3000"
```

## 5. Prisma — First Migration

```bash
# Generate the Prisma Client
pnpm db:generate

# Create and apply the first migration
pnpm db:migrate --name init
```

On success you'll see a `prisma/migrations/<timestamp>_init/` directory and the
`Organization`, `Membership`, `User`, `Session`, `Account`, and `Verification` tables will exist in the database.

## 6. Dev Server

```bash
pnpm dev
# http://localhost:3000
```

On first load: `/` → `/login` redirect.

## 7. Smoke Test (Sprint 0 Definition of Done)

1. Go to `http://localhost:3000/register`, fill in name, organization, email, and password, then **Create account**.
2. You should land on `/dashboard`. The header greets you by name and the sidebar shows 10 menu items.
3. Click the avatar in the top right → **Sign out** → back to `/login`.
4. Sign in again with the same credentials → dashboard.
5. Terminal: `pnpm typecheck` → no errors.
6. Terminal: `pnpm build` → all routes build successfully.

If all six steps pass, Sprint 0 is closed.

## 8. Internationalization & Regional Settings

OneAce ships as an international product. All end-user strings live in `src/lib/i18n/messages/<locale>.ts` — never hardcode copy in components.

- **Default locale:** English (`en`).
- **Supported locales today:** `en` is fully translated; `es`, `de`, `fr`, `pt`, `it`, `nl`, `ar` are wired up with English fallbacks until real translations land.
- **Detection order:** `oneace-locale` cookie → `Accept-Language` header → default (`en`).
- **Regions:** defined in `src/lib/i18n/config.ts`. Each region carries an ISO country code, currency, BCP-47 number locale, and default time zone. A Sprint 8 task will expose a region picker in Settings.
- **RTL:** `ar` is flagged as RTL in `RTL_LOCALES` and the root layout sets `dir` automatically.

To add a new locale:
1. Create `src/lib/i18n/messages/<code>.ts`, exporting the same shape as `en`.
2. Import it in `src/lib/i18n/index.ts` and add it to the `catalog` map.
3. Add the code to `SUPPORTED_LOCALES` in `config.ts`.

## 9. Common Errors

- **`Can't reach database server`**: wrong URL in `.env`, or the Neon branch is asleep. Run `pnpm prisma db push` once to wake it.
- **`PrismaClient is not configured`**: you forgot `pnpm db:generate` (or ran `npm install --ignore-scripts` → call it by hand).
- **`BETTER_AUTH_SECRET missing`**: `.env` is missing or the secret is empty. Generate it with the `openssl` command above.
- **`Invalid prisma.session.findUnique()`**: migrations haven't been applied → `pnpm db:migrate`.

## 10. What's Next

Once Sprint 0 is closed, see [OneAce_Roadmap.md](../OneAce_Roadmap.md) → **Sprint 1**:
- Organization-scoped CRUD: items, warehouses, categories
- First seed script
- Port the shadcn Table primitive
