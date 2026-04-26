# Sprint 28 — Input + SelectTrigger `lg` size retire

**Tarih:** 2026-04-26 (re-apply post-rollback)
**Önceki tag:** `v1.38.0-filter-bar-full-sm` (Sprint 27 closure)
**Closure tag:** `v1.39.0-input-select-lg-retire`
**Stable branch:** HEAD

---

## TL;DR

Input + SelectTrigger primitive'lerinin `size="lg"` variant'ı **kullanılmıyor** (her ikisi de 0 instance). Sprint 28 bu yüzden cva surface'inden çıkarır. Button.lg aktif kullanımda olduğu için `--control-h-lg` CSS token'ı `globals.css`'te korunur — yalnızca Input + Select'in cva tanımları temizlenir.

| Primitive | Önce | Sonra | Kullanım | Karar |
|---|---|---|---|---|
| Input.size | sm / default / lg | sm / default | lg = 0 | ✅ retire |
| SelectTrigger.size | sm / default / lg | sm / default | lg = 0 | ✅ retire |
| Button.size | sm / default / lg / icon | (değişmedi) | lg = 10 | ✅ kalır |

**NOT:** Bu sprint daha önce 2026-04-26'da uygulanmaya çalışıldı; FUSE git index korruption nedeniyle commit 322,852 satır + 1531 dosya silinmesi içeriyordu. Hard reset ile geri alındı (`backup-pre-reset-v1.46.0` branch'inde arşiv). Bu re-apply sandbox FUSE temiz olduğu için doğru sadece 6 dosyayı içerir.

**Pinned test toplam (Sprint 28):** 1 yeni dosya, 6 case (`sprint-28-input-select-lg-retire.test.ts`).

---

## PR #1 — Primitive cva temizliği

**Tag (planned):** `v1.38.1-input-select-lg-retire`

### `src/components/ui/input.tsx`

```diff
       size: {
         sm: "h-[var(--control-h-sm)] px-2.5 py-1.5 text-sm",
         default: "h-[var(--control-h-md)] px-3 py-2 text-sm",
-        lg: "h-[var(--control-h-lg)] px-4 py-2.5 text-base",
       },
```

### `src/components/ui/select.tsx`

```diff
+// Sprint 28 — `lg` retired (0 kullanım, primitive cva temizliği). ...
       size: {
         sm: "h-[var(--control-h-sm)] px-2.5 py-1.5 text-sm",
         default: "h-[var(--control-h-md)] px-3 py-2 text-sm",
-        lg: "h-[var(--control-h-lg)] px-4 py-2.5 text-base",
       },
```

### Existing test alignment

- `src/components/input-state-census.test.ts` — cva union assertion `lg:\s*"/` → `not.toMatch(...)`, comment "3 size" → "2 size"
- `src/components/sprint-27-filter-bar-full-sm.test.ts` — Select cva size assertion 3-size → 2-size

### Kasıtlı korunanlar

- `src/app/globals.css:507` → `--control-h-lg: 3rem` token (Button.lg için)
- `src/components/ui/button.tsx` → `lg: "h-[var(--control-h-lg)]"` (Button primitive değişmedi)
- `src/components/touch-target.test.ts` → CSS token assertion (token korunduğu için geçer)

---

## PR #2 — Pinned test guard

**Tag (planned):** `v1.38.2-input-select-lg-retire-test`

Yeni `sprint-28-input-select-lg-retire.test.ts` (6 case):

| # | Assertion |
|---|---|
| 1 | Input cva: `sm + default` mevcut, `lg` cva-style yok, `var(--control-h-lg)` reference yok |
| 2 | SelectTrigger cva: `sm + default` mevcut, `lg` cva-style yok, `var(--control-h-lg)` reference yok |
| 3 | `globals.css` → `--control-h-lg: 3rem` korunur |
| 4 | `button.tsx` → `lg: "h-[var(--control-h-lg)]` korunur |
| 5 | **HARD FAIL:** repo'da `<Input size="lg">` = 0 |
| 6 | **HARD FAIL:** repo'da `<SelectTrigger size="lg">` = 0 |

---

## PR #3 — Sprint 28 closure audit doc

**Tag (planned):** `v1.39.0-input-select-lg-retire`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti

```
<HASH-3>  docs(audit): Sprint 28 closure — input+select lg retire        [v1.39.0]
<HASH-2>  test(input+select): lg retire pinned guard (6 case)            [v1.38.2]
<HASH-1>  ui(input+select): retire size=lg variant from cva (0 usage)    [v1.38.1]
<v1.38.0 7b0a525>  docs(audit): Sprint 27 closure (PR #3)                 [prev HEAD]
```

**Closure tag:** `v1.39.0-input-select-lg-retire`
**Stable branch:** HEAD

---

## Risk + rollback

- **Risk:** sıfır. Hem `<Input size="lg">` hem `<SelectTrigger size="lg">` repo'da 0 kullanım — primitive cva'dan çıkarmak hiçbir surface'i etkilemez.
- **Rollback:** primitive cva'ya `lg:` satırını geri eklemek tek commit. Token zaten globals.css'te.

---

## Önceki olaydan dersler (apply script'te uygulanmış)

Yeni apply script'te (`apply-sprint-28-redo.command`) şu guard'lar var:
1. **Pre-flight prev-tag exit-on-mismatch** (sleep+continue YASAK)
2. **FUSE health check:** `git ls-files --others --exclude-standard | wc -l > 50` → abort
3. **Push-öncesi diff stat guard:** `git diff --cached --numstat | awk '{sum+=$2} END {print sum}'` > 1000 deletion → abort
4. Sprint 28-redo notu: önceki Sprint 28 PR #1 commit `9e6a31f8` rolled back, bu sprint o yanlışı düzeltir

---

## Sprint 29+ backlog (council yol haritası)

Sprint 28 tag'lendikten sonra:
1. **Sprint 29** = `--control-h-lg` token sole-consumer audit (Sprint 28 retire'ın token-level emniyet katmanı)
2. **Sprint 30** = Input.state.success activation (auth password forms)
3. **Sprint 31** = audit closure manifest (UX/UI segment SEAL)
4. **Sprint 32** = confirm-password live-validation (S30 risk maddesi)
5. **Sprint 33** = TR coverage segment kickoff (council launch-blocking)
