# OneAce

> Inventory management, stock counting, and barcode-first workflows for growing businesses worldwide. Faster, cheaper, and friendlier than Sortly and inFlow.

[![CI](https://github.com/mahmutseker79/Oneace/actions/workflows/ci.yml/badge.svg)](https://github.com/mahmutseker79/Oneace/actions/workflows/ci.yml)

**Status:** Sprint 0 complete (auth + app shell + dashboard scaffold). See the full plan in [`../OneAce_Roadmap.md`](../OneAce_Roadmap.md).

## Tech Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router, RSC, Turbopack) | UI + API in one repo, edge-ready |
| Language | TypeScript 5.7 (strict, `noUncheckedIndexedAccess`) | Safety + refactor confidence |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui | 1:1 port of the Figma template |
| Auth | Better Auth 1.1 (email/password + sessions) | Self-hosted, Prisma adapter |
| Database | PostgreSQL (Neon, pooled + direct) | Serverless-friendly, cheap |
| ORM | Prisma 6.1 | Schema-first, migration-safe |
| State | TanStack Query v5 + Zustand (planned) | Server state + client state split |
| Offline | Dexie.js + next-pwa (Sprint 5) | Moat: offline stock counting |
| Scanner | BarcodeDetector API + @zxing/browser fallback (Sprint 3) | Moat: sub-second scanning |
| Lint | Biome 1.9 | Single tool instead of ESLint + Prettier |
| i18n | English default, 8 locales scaffolded, `Intl` API per region | Built for international customers |

## Project Layout

```
oneace-next/
├── prisma/
│   └── schema.prisma          # Organization, Membership, User, Session, Account, Verification
├── src/
│   ├── app/
│   │   ├── (auth)/            # login, register — split-screen brand panel
│   │   ├── (app)/             # authed shell: dashboard, onboarding, (sprint 1+: items, counts, ...)
│   │   ├── api/
│   │   │   ├── auth/[...all]/ # Better Auth handler
│   │   │   └── onboarding/organization/  # organization creation endpoint
│   │   ├── globals.css        # Theme tokens (ported from the Vite repo)
│   │   ├── layout.tsx         # Root layout, lang + dir per locale, metadata
│   │   └── page.tsx           # Root → session check → /login or /dashboard
│   ├── components/
│   │   ├── shell/             # Sidebar, Header
│   │   └── ui/                # shadcn primitives (button, card, input, ...)
│   ├── lib/
│   │   ├── auth.ts            # Better Auth server config
│   │   ├── auth-client.ts     # Better Auth React hooks
│   │   ├── db.ts              # PrismaClient singleton
│   │   ├── session.ts         # getCurrentSession / requireSession / requireActiveMembership
│   │   ├── utils.ts           # cn, slugify, formatCurrency, formatNumber
│   │   └── i18n/
│   │       ├── config.ts      # Supported locales + regions
│   │       ├── index.ts       # getMessages / getLocale / getRegion (React cache)
│   │       └── messages/en.ts # English dictionary (source of truth)
│   └── middleware.ts          # Public path allowlist, /login redirect
├── biome.json
├── next.config.ts             # Security headers, typedRoutes
├── postcss.config.mjs         # Tailwind 4
├── tsconfig.json              # @/* alias
└── SETUP.md                   # Local setup guide
```

## Quick Start

```bash
cp .env.example .env           # fill in the URLs and secrets
pnpm install
pnpm db:migrate --name init
pnpm dev                       # http://localhost:3000
```

Full setup and smoke test → [`SETUP.md`](./SETUP.md).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server (Turbopack) |
| `pnpm build` | Prisma generate + Next build |
| `pnpm start` | Production server |
| `pnpm typecheck` | `tsc --noEmit` — blocking in CI |
| `pnpm lint` | Biome check |
| `pnpm lint:fix` | Biome auto-fix |
| `pnpm db:generate` | Regenerate Prisma Client |
| `pnpm db:migrate` | Create + apply a migration (dev) |
| `pnpm db:deploy` | Apply migrations (prod) |
| `pnpm db:studio` | Prisma Studio GUI |
| `pnpm db:push` | Push schema without a migration (prototyping only) |

## Internationalization & Region Support

OneAce is built for international customers from day one. Every end-user string flows through the `src/lib/i18n/` dictionary system; nothing is hardcoded in components.

- **Default locale:** `en` (English)
- **Scaffolded locales:** `en`, `es`, `de`, `fr`, `pt`, `it`, `nl`, `ar` (RTL)
- **Detection:** `oneace-locale` cookie → `Accept-Language` → default
- **Regions:** configurable per-organization — currency, number/date format, and default time zone. See `SUPPORTED_REGIONS` in `src/lib/i18n/config.ts`.
- **RTL:** the root layout sets `dir="rtl"` automatically for Arabic.

Adding a language or region is documented in [`SETUP.md` §8](./SETUP.md#8-internationalization--regional-settings).

## Multi-Tenancy Model

Every row is isolated by `organizationId`. When a user signs in:

1. `getCurrentSession()` validates the Better Auth cookie.
2. `requireActiveMembership()` fetches their first `Membership`; if there is none, they're redirected to `/onboarding`.
3. Server Components attach `membership.organizationId` to every query.

> Sprint 1 adds an `organizationId` column + `@@index` to every CRUD table and ships a query helper (`withOrg(prisma, orgId)`).

## Sprint 0 Definition of Done

- [x] Next.js 15 + React 19 scaffold running
- [x] Prisma schema (User / Org / Membership / Session / Account) + client
- [x] Better Auth signup / signin / signout working
- [x] `/login`, `/register`, `/onboarding`, `/dashboard` routes green
- [x] App shell: Sidebar (10 nav items) + Header (search, bell, sign-out avatar)
- [x] Theme tokens ported 1:1 from the Vite repo
- [x] i18n scaffold with English dictionary + 8 locales wired up
- [x] `tsc --noEmit` → `EXIT: 0`
- [x] Happy path: register → onboarding → dashboard → sign out

## Roadmap (12 Weeks)

| Sprint | Week | Main deliverable |
| --- | --- | --- |
| 0 | Apr 14–20 | **Auth + shell** (done) |
| 1 | Apr 21–27 | Item / Warehouse / Category CRUD |
| 2 | Apr 28–May 4 | Stock movements + stock levels |
| 3 | May 5–11 | **Moat 1** — Barcode scanning UX |
| 4 | May 12–18 | Multi-warehouse + transfers |
| 5 | May 19–25 | **Moat 2** — Offline stock counting (Dexie + service worker) |
| 6 | May 26–Jun 1 | Purchase orders + suppliers |
| 7 | Jun 2–8 | Reports + exports |
| 8 | Jun 9–15 | Roles, invites, RBAC, locale/region picker |
| 9 | Jun 16–22 | Billing (Stripe) + plans |
| 10 | Jun 23–29 | QA, tests, beta telemetry |
| 11 | Jun 30–Jul 3 | Launch prep + onboarding polish |

**MVP target:** 2026-07-03.

Detailed sprint specs, moat design, and risk register → [`../OneAce_Roadmap.md`](../OneAce_Roadmap.md).

## License

Proprietary. © 2026 OneAce.
