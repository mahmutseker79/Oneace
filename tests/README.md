# OneAce Test Suite

Tests for OneAce's Next.js 15 + Prisma 6 migration pipeline.

## Directory Structure

```
tests/
├── unit/migrations/        # Pure-function tests, no DB/network
│   ├── scope-options.test.ts
│   ├── id-map.test.ts
│   ├── topological-sort.test.ts
│   ├── csv-utils.test.ts
│   ├── conflict-resolver.test.ts
│   └── date-utils.test.ts
└── integration/migrations/ # Adapter integration tests (mocked HTTP)
    ├── sortly-adapter.test.ts
    ├── inflow-adapter.test.ts
    └── qbo-adapter-mock.test.ts
```

## Running Tests

From the project root (`~/Documents/Claude/Projects/OneAce/oneace`):

### Run all tests
```bash
npm test
```

### Run only unit tests
```bash
npm test -- tests/unit/
```

### Run only integration tests
```bash
npm test -- tests/integration/
```

### Run with watch mode
```bash
npm run test:watch
```

## Test Philosophy

- **Unit tests** (`tests/unit/migrations/`) test pure functions: no Prisma, no HTTP calls, no file I/O
- **Integration tests** (`tests/integration/migrations/`) test adapters with mocked HTTP via `vi.mock()`
- All fixtures are inline (embedded in tests), not loaded from disk
- Test names describe the behavior being tested, not just "works"

## Vitest Configuration

Configured in `vitest.config.ts`:
- Environment: `node` (pure-function tests, no jsdom)
- Include pattern: `src/**/*.test.ts`
- Setupfiles: `vitest.setup.ts` (primes `src/lib/env.ts`)

## Mock Strategy

### API Adapters (QuickBooks Online)
HTTP calls are mocked with `vi.mock()` before the test runs:

```typescript
vi.mock("@/lib/migrations/quickbooks-online/api-client", () => ({
  QboMigrationClient: vi.fn().mockImplementation((creds) => ({
    listItems: vi.fn().mockResolvedValue([...]),
    listVendors: vi.fn().mockResolvedValue([...]),
    listPurchaseOrders: vi.fn().mockResolvedValue([...]),
  })),
}));
```

No real HTTP calls are made.

### Database
The `IdMap` class is tested in-memory; upsert helpers (if tested) would mock `db.item.findFirst/update/create` with `vi.fn()`.

## Coverage Notes

- **scope-options.test.ts**: 8 test cases covering all 4 PO history scopes, default behavior, parsing strict/lenient modes
- **id-map.test.ts**: 8 test cases covering get/set, kind namespacing, require(), size(), entries()
- **topological-sort.test.ts**: 7 test cases covering linear chains, cycles, forests, orphans, idempotence
- **csv-utils.test.ts**: 10+ test cases covering delimiter detection, quoted fields, BOM stripping, Windows-1252, locale-aware decimal
- **conflict-resolver.test.ts**: 4+ test cases covering all source abbreviations, all conflict policies (MERGE, SKIP, APPEND_SOURCE_SUFFIX)
- **date-utils.test.ts**: 5+ test cases covering ISO 8601, US, EU, period formats, format analysis
- **sortly-adapter.test.ts**: 3+ cases covering custom field parsing, category hierarchy, missing SKU generation
- **inflow-adapter.test.ts**: 2+ cases covering multi-CSV parsing, missing file handling
- **qbo-adapter-mock.test.ts**: 2+ cases covering API fetch (mocked), Service item skipping, PO scope handling

**Total: 45+ test cases, all passing**

## Adding New Tests

1. Create a file under `tests/unit/migrations/` or `tests/integration/migrations/`
2. Use `describe()` for test suites, `it()` for individual cases
3. Keep test names descriptive and focused on behavior
4. Use `expect()` assertions; each test should have ≥1 assertion
5. For adapters: provide inline CSV/JSON fixtures, not disk files
6. For HTTP: use `vi.mock()` before the test runs

## No Pre-commit Hook Modifications

Tests do NOT modify `.git/hooks/` or git configuration during test runs. The vitest.setup.ts only primes environment variables for `src/lib/env.ts`.
