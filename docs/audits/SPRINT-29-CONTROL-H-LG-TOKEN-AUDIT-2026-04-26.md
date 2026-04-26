# Sprint 29 — `--control-h-lg` token sole-consumer audit

**Tarih:** 2026-04-26 (re-apply post-rollback)
**Önceki tag:** `v1.39.0-input-select-lg-retire` (Sprint 28 closure)
**Closure tag:** `v1.40.0-control-h-lg-token-audit`
**Stable branch:** HEAD

---

## TL;DR

Sprint 28'de Input + SelectTrigger primitive'lerinden `lg` size variant retire edildi. CSS token `--control-h-lg` Button.lg için korundu. Sprint 29 bu durumu **token-level pinned guard** ile kilitler: yeni bir primitive yanlışlıkla `var(--control-h-lg)` tüketmeye başlarsa testler hard-fail olur.

| Token | Tanım | Primitive consumer | Kullanım |
|---|---|---|---|
| `--control-h-sm` | 2.25rem (36px) | Input + SelectTrigger + Button | 3+ |
| `--control-h-md` | 2.75rem (44px) | Input + SelectTrigger + Button | 3+ |
| `--control-h-lg` | 3rem (48px) | **Button (sole consumer)** | **1** |

**Pinned test toplam (Sprint 29):** 1 yeni dosya, 7 case (`sprint-29-control-h-lg-token-audit.test.ts`).

---

## Gerekçe

Sprint 28 closure'da risk maddesi şuydu:

> Token `--control-h-lg` sistemde duruyor; gelecekteki bir primitive yanlışlıkla bu token'ı tüketmeye başlarsa Sprint 28 retire kararı sessizce gevşer.

Sprint 29 bunu hard-fail ile yakalar:

```ts
expect(consumers).toEqual(["src/components/ui/button.tsx"]);
//   → AssertionError if başka primitive --control-h-lg kullanmaya başlarsa
```

Ek olarak **lock-step gerçeği** (sm + md tokens) doğrulanır: en az 3 primitive consumer (Input, SelectTrigger, Button) sm + md token'larını paylaşır. Bu, sm/md retire risklerini de kapatır.

---

## PR #1 — Pinned token audit guard

**Tag (planned):** `v1.39.1-control-h-lg-token-audit`

Yeni `sprint-29-control-h-lg-token-audit.test.ts` (7 case):

| # | Assertion |
|---|---|
| 1 | `--control-h-lg = 3rem` globals.css'te |
| 2 | Lock-step token tanımları: sm=2.25rem, md=2.75rem, lg=3rem |
| 3 | **HARD GUARD:** `var(--control-h-lg)` consumer = sadece button.tsx |
| 4 | Button.lg cva = exactly 1 occurrence |
| 5 | `--control-h-md` ≥ 3 primitive consumer |
| 6 | `--control-h-sm` ≥ 3 primitive consumer |
| 7 | Input + SelectTrigger `var(--control-h-lg)` = 0 (Sprint 28 kalıcı) |

---

## PR #2 — Sprint 29 closure audit doc

**Tag (planned):** `v1.40.0-control-h-lg-token-audit`

Bu doc'un kendisi PR #2'dir.

---

## Bundle özeti

```
<HASH-2>  docs(audit): Sprint 29 closure — control-h-lg token audit     [v1.40.0]
<HASH-1>  test(token-audit): control-h-lg sole-consumer pinned guard    [v1.39.1]
<v1.39.0 78f412a>  Sprint 28 closure (PR #3)                            [prev HEAD]
```

**Closure tag:** `v1.40.0-control-h-lg-token-audit`
**Stable branch:** HEAD

---

## Risk + rollback

- **Risk:** sıfır. Sprint 29 sadece test ekler, hiçbir source değişmez.
- **Rollback:** test dosyasını silmek tek commit. Token + tüm primitive davranışları aynen kalır.

---

## Sprint 30+ backlog (council yol haritası)

1. **Sprint 30** = Input.state.success activation (auth password forms)
2. **Sprint 31** = Audit closure manifest
3. **Sprint 32** = Confirm-password live-validation (S30 risk maddesi)
4. **Sprint 33** = TR coverage segment kickoff (council launch-blocking)
