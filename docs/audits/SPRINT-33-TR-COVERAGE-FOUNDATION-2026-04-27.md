# Sprint 33 — TR coverage segment foundation

**Tarih:** 2026-04-27
**Önceki tag:** `v1.43.0-confirm-password-live-val` (Sprint 32)
**Closure tag:** `v1.44.0-tr-coverage-foundation`
**Stable branch:** HEAD
**Segment:** TR coverage (S33–S37 planned, brief in `docs/sprints/SPRINT-33-KICKOFF-BRIEF-2026-04-27.md`)

---

## TL;DR

Sprint 32 closure'ında "Sprint 33 = TR coverage segment kickoff (council launch-blocking)" olarak parking edilen iş bu sprint'te **foundation katmanıyla** açıldı. Council 6 kararı **all ♥** ile sonuçlandı:

| # | Karar | Seçim |
|---|---|---|
| §3.1 | Coverage gold standard | **B** — L1+L2+L3 (email Sprint 38+) |
| §3.2 | Verification | **B** — static + Playwright TR session |
| §3.3 | Stub policy | **B** — `INTENTIONAL_EN` marker |
| §3.4 | Sprint cadence | **B** — per-feature surface |
| §3.5 | Translation source | **C** — LLM-draft + native review |
| R4 | KVKK avukat review | Sprint 37 öncesi mandatory gate (devam) |

Sprint 33 foundation = primitive + scaffold test'ler; davranış değişikliği yok, mevcut tr.ts'e dokunulmadı. Sprint 34+ migration'ları hazır zemin üzerinde çalışacak.

---

## Coverage taxonomy reminder (kickoff brief §1'den)

| Katman | Tanım | Sprint 33 sonu |
|---|---|---|
| L1 Namespace parity | tr.ts her top-level namespace'i `...en.X` ile spread'liyor | ✅ 48/48 (Sprint 7) |
| L2 Per-key parity | Her leaf string TR override'a sahip | ⚠️ ~95% — **scaffold test eklendi** (informational + soft assert) |
| L3 Hardcoded survivor | UI'da catalog dışı literal EN | ❌ ~287 suspect — Sprint 34+ |
| L4 Transactional | Email + auth error + server log | ❌ Sprint 38+ backlog |

Sprint 33 = L2 framework + verification harness. L2 fill, L3 sweep, L4 closure ayrı sprint'lere yayıldı.

---

## PR #1 — `INTENTIONAL_EN` marker + `tr-key-parity.test.ts` scaffold

**Tag (planned):** `v1.43.1-intentional-en-marker`

### `src/lib/i18n/messages/_markers.ts` (yeni)

Identity wrapper:

```ts
export const INTENTIONAL_EN = <T>(value: T): T => value;
export const INTENTIONAL_EN_MARKER = "INTENTIONAL_EN" as const;
```

Runtime'da no-op; static analyzer'a "deliberate EN passthrough" olduğunu söyleyen tek-token grep target. Kullanım pattern'i:

```ts
nav: {
  ...en.nav,
  brand:     INTENTIONAL_EN(en.nav.brand),  // "OneAce"  brand
  dashboard: "Pano",                         // translated
  scan:      INTENTIONAL_EN(en.nav.scan),   // teknik terim
}
```

Sprint 33 hiçbir consumer migration'ı yapmıyor; primitive + tek pinned test.

### `src/lib/i18n/tr-key-parity.test.ts` (yeni, SCAFFOLD mode)

7 case:

| # | Assertion |
|---|---|
| 1 | `_markers.ts` `INTENTIONAL_EN` ve `INTENTIONAL_EN_MARKER` export ediyor |
| 2 | `INTENTIONAL_EN` identity-fn shape (`<T>(v: T): T => v`) |
| 3 | EN leaf inventory parsed (>500 user-copy) — parser sanity |
| 4 | TR leaf inventory parsed (>500 user-copy) — parser sanity |
| 5 | INTENTIONAL_EN consumer count logged (Sprint 33 baseline = 0) |
| 6 | TR/EN user-copy ratio >= 90% (regression floor; Sprint 7 değer = ~95%) |
| 7 | TODO approximation (`EN.user − TR.user − INTENTIONAL_EN`) finite ve `< EN.user` (parser smoke) |

Soft assertions only — Sprint 37 closure'ında hard ceiling (TODO ≤ whitelist) flip edilecek.

---

## PR #2 — Playwright TR smoke fixture + spec + static pin

**Tag (planned):** `v1.43.2-tr-smoke-fixture`

### `e2e/fixtures/tr-auth.ts` (yeni)

`authedPage` fixture'ını extend eder, `oneace-locale=tr` cookie'sini context'e set eder, `/dashboard`'a re-navigate. EN-locale auth flow'u fork'lamadan TR session'a geçer.

### `e2e/tr-smoke.spec.ts` (yeni)

2 test:

1. **Login page TR copy** — anon page'e cookie set, `/login` SSR'ı TR resolver. `E-posta` + `Şifre` + `Giriş yap` görünür.
2. **Dashboard nav 'Pano'** — `trAuthedPage` kullanır, sidebar'da `^pano$` link visible. **Negative guard:** `^dashboard$` link sayısı = 0.

### `src/lib/i18n/tr-smoke-fixture.static.test.ts` (yeni)

7 case static pin — fixture/spec dosyalarını parse edip:
- Cookie name'in `LOCALE_COOKIE` constant'a parite
- Fixture'ın doğru fixture'ı extend ettiğini (base playwright değil)
- Spec'in 4 canonical TR string'i (`Giriş yap`, `E-posta`, `Şifre`, `Pano`) reference ettiğini
- Negative guard (`toHaveCount(0)` + `^dashboard$`) varlığını
- Test sayısı >= 2

E2e infra çalışmasa bile (CI'da gating var) static pin vitest job'da fail eder — drift cheap-job'da yakalanır.

---

## PR #3 — CLAUDE.md drift fix + closure doc + apply script

**Tag (planned):** `v1.44.0-tr-coverage-foundation`

### `CLAUDE.md` i18n satırı

Eski iddia: "Today it is a scaffold with `en` only".
Yeni iddia: gerçek state — TR namespace 48/48, %95 leaf coverage, fallback chain, region registered + Sprint 33 foundation referansı + Sprint 34+ roadmap.

§5.23 honest-scaffold guard'ı korunuyor (yeni locale eklemenin contract'ı değişmedi).

### `docs/sprints/SPRINT-33-KICKOFF-BRIEF-2026-04-27.md`

DRAFT etiketi düşürüldü; decision log eklendi (all ♥). §4 sprint breakdown S34–S37 için live roadmap.

### `scripts/sprints/2026-04-27-tr-coverage-segment-kickoff/apply-sprint-33.command`

8 fazlı apply script (Sprint 32 pattern'i ile aynı):
1. Preflight (branch=main, prev tag, 7 dosya mevcut)
2. FUSE index fix
3. Sanity diff (>50 değişiklik = abort)
4. Pinned test smoke (yeni 2 test + mevcut tr-coverage + locale-parity)
5. PR #1 commit + tag
6. PR #2 commit + tag
7. PR #3 commit + tag (apply script kendini de stage'ler)
8. Push main+stable+tags + post-push verify

---

## Bundle özeti

```
<HASH-3>  docs(audit): Sprint 33 closure — TR coverage foundation              [v1.44.0]
            + CLAUDE.md i18n drift fix
            + DRAFT etiketi düşürülmüş kickoff brief
            + apply-sprint-33.command
<HASH-2>  test(i18n): Playwright TR smoke fixture + spec + static pin          [v1.43.2]
<HASH-1>  test(i18n): INTENTIONAL_EN marker + tr-key-parity scaffold           [v1.43.1]
```

---

## Coverage segment status (Sprint 33 sonrası)

| Katman | Sprint 33 | Sprint 34 (planned) | Sprint 37 closure |
|---|---|---|---|
| L1 Namespace | ✅ tam (S7) | tam | tam |
| L2 Per-key | ⚠️ scaffold | sweep başlar | TODO ≤ whitelist (hard) |
| L3 Hardcoded | ❌ | tier 1 (auth+chrome) | tier 3 + ESLint rule (no-hardcoded-jsx-text) |
| L4 Transactional | ❌ | — | backlog (S38+) |
| Verification | static + smoke fixture | + ESLint | + 5 e2e core flow |

Segment "TR coverage" SEAL hedefi: `v1.49.0-tr-coverage-segment-sealed` (Sprint 37 closure manifest).

---

## Risk + rollback

- **Risk:** çok düşük. Foundation = primitive + scaffold; mevcut tr.ts'e dokunulmadı, davranış değişikliği yok.
- **Rollback:** PR #1 + PR #2 revert iki commit. PR #3 (CLAUDE.md + doc + script) rollback ayrı, bağımsız.
- **CI etkisi:** yeni 2 vitest dosyası eklendi (tr-key-parity + tr-smoke-fixture.static). Vitest required-job süresine ~1-2sn ekler.
- **E2e CI:** `tr-smoke.spec.ts` mevcut e2e suite'e katılır. CI'da E2E_BASE_URL ile çalışıyorsa otomatik koşar; lokal `npx playwright test` da kapsar. Foundation'da fail beklenmiyor (TR translations Sprint 7'den beri canlı).

---

## Sprint 34+ roadmap

Kickoff brief §4'te detaylı; özet:

| Sprint | Focus | Closure tag (planned) |
|---|---|---|
| S34 | L3 sweep tier 1 (app/page, not-found, auth, chrome) + `no-hardcoded-jsx` ESLint rule | `v1.45.0-tr-l3-auth-chrome` |
| S35 | L3 sweep tier 2 (items, dashboard, scan + toast'ların ilk yarısı) | `v1.46.0-tr-l3-operations` |
| S36 | L3 sweep tier 3 (PO, sales, kits, settings + kalan toast/aria-label) | `v1.47.0-tr-l3-modules` |
| S37 | L2 fill (LLM-draft + native review) + 5 e2e flow + KVKK avukat gate + segment SEAL | `v1.48.0-tr-l2-fill-closure` + `v1.49.0-tr-coverage-segment-sealed` |
| S38+ | L4 transactional (4 email template + Better Auth wrapper) | TBD post-launch |
