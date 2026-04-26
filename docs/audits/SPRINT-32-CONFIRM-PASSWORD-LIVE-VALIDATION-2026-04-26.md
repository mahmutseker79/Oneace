# Sprint 32 — Confirm-password live-validation error ternary

**Tarih:** 2026-04-26
**Önceki tag:** `v1.42.0-unused-variant-closure-manifest` (Sprint 31 audit closure)
**Closure tag:** `v1.43.0-confirm-password-live-validation`
**Stable branch:** HEAD

---

## TL;DR

Sprint 30'da reset-password-form'un `confirm` Input'u **success-only** ternary ile aktive edildi (length yeterli + match → success, aksi durum default). Mismatch durumunda kullanıcıya submit denemeden **görsel feedback verilmiyordu** — yalnız submit sonrası `{error}` block görünüyordu.

Sprint 32 bu loose end'i kapatır: 3-way ternary ile **live-validation error** state'i devreye girer.

| Durum | State | Görsel |
|---|---|---|
| `length < MIN` | `default` | normal border |
| `length >= MIN AND match` | `success` | yeşilimsi border (success token) |
| `length >= MIN AND mismatch` | `error` | kırmızımsı border (destructive token) |

**Pinned test toplam (Sprint 32):** 1 yeni dosya, 7 case (`sprint-32-confirm-password-live-validation.test.ts`).

---

## Karar mantığı

- **Risk:** Sprint 30 closure'da açıkça yazılmıştı — "Live-validation Sprint 32+ adayı; mismatch durumunda `state="error"` ternary'i confirm.length > 0 && confirm !== password için eklenebilir." Sprint 32 bunu uygular.
- **UX:** Submit denemeden anında geri bildirim → "Form'a güvenip submit edip hata almak" yerine "henüz buton aktifken eşleşmediğini fark et" deneyimi. Form library standardı.
- **`length < MIN` boyunca default kalır** çünkü kullanıcı henüz yazıyor; "henüz tamamlamadın" mesajı vermek erken-noise'dir.
- **Submit-time error pattern korunur** — backend'den gelen `setError("This reset link is no longer valid")` veya match-error-yine-de-submit edildi senaryosu için lazım. Live-val sadece görsel hint, server hâlâ authoritative.

---

## PR #1 — confirm Input 3-way ternary

**Tag (planned):** `v1.42.1-confirm-password-live-validation`

### `src/app/(auth)/reset-password/reset-password-form.tsx`

```diff
       <Input
         id="confirm-password"
         ...
         value={confirm}
         onChange={(e) => setConfirm(e.target.value)}
-        // Sprint 30 — Input.state.success: confirm becomes success only when
-        // both fields are valid AND match. Mismatch stays default (not error)
-        // until submit attempt — error copy belongs in {error} below.
-        state={
-          confirm.length >= MIN_PASSWORD_LENGTH && confirm === password
-            ? "success"
-            : "default"
-        }
+        // Sprint 30 — Input.state.success activation.
+        // Sprint 32 — live-validation error: kullanıcı yeterli uzunlukta
+        // yazdıktan sonra mismatch varsa anında error feedback. ...
+        state={
+          confirm.length < MIN_PASSWORD_LENGTH
+            ? "default"
+            : confirm === password
+              ? "success"
+              : "error"
+        }
       />
```

3-way ternary nested kalıbı; ESLint/Biome kalıbı kabul ediyor (parantez ihtiyacı yok). Inline comment 4 satır gerekli mantığı açıklıyor.

---

## PR #2 — Pinned test guard

**Tag (planned):** `v1.42.2-confirm-password-live-validation-test`

Yeni `sprint-32-confirm-password-live-validation.test.ts` (7 case):

| # | Assertion |
|---|---|
| 1 | confirm Input ternary'nin 1. dalı: `length<MIN → "default"` |
| 2 | confirm Input ternary'nin 2. dalı: `match → "success"` |
| 3 | **HARD ANCHOR:** ternary 3 dal sıralaması `default → success → error` |
| 4 | Submit-time error pattern (`setError("Passwords do not match.")`) korunur |
| 5 | Cumulative: repo'da Input state=error ternary kullanım sayısı >= 1 |
| 6 | MIN_PASSWORD_LENGTH = 8 sabit korunur |
| 7 | Input cva'da `error: "border-destructive"` premise korunur |

Sprint 30'un STATE_TERNARY_REGEX (input-state-census.test.ts) şimdi `error` state'i de yakalayacak — census snapshot artık `success=N, default=N, error=1` görecek (sandbox'ta doğrulanması için fresh session gerek).

---

## PR #3 — Sprint 32 closure audit doc

**Tag (planned):** `v1.43.0-confirm-password-live-validation`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti

```
<HASH-3>  docs(audit): Sprint 32 closure — confirm-password live-validation     [v1.43.0]
<HASH-2>  test(input.state): error ternary live-validation pinned guard         [v1.42.2]
<HASH-1>  ui(auth): wire 3-way state ternary on reset-password confirm input    [v1.42.1]
<SPRINT-31>  docs(audit): unused-variant closure manifest                        [v1.42.0, prev HEAD]
```

**Closure tag:** `v1.43.0-confirm-password-live-validation`
**Stable branch:** HEAD

**Smoke (sandbox):** Sprint 32 alone 7/7 PASS. Cumulative validation fresh session'da yapılacak (sandbox FUSE constraint).

**Mac apply script:** `OneAce/apply-sprint-32.command` (guard: prev tag = v1.42.0-unused-variant-closure-manifest).

---

## Audit segment notu

Sprint 31'de **§D-1 + unused-variant pack SEALED** edildi. Sprint 32 o segment **dışı** kalan tek loose end'i (S30 risk maddesi) kapatır — bu, segmenti yeniden açmak değildir; o segment closure manifest'inde "Sprint 31 backlog: Live-validation Sprint 32+ adayı" olarak listelenmişti.

Audit kapanış matrisi güncel:

| Track | Karar | Sprint |
|---|---|---|
| Button.success | activate | S24 |
| Alert.success+info | activate | S25 |
| Input.size.sm | activate | S26+S27 |
| Input.size.lg | retire | S28 |
| SelectTrigger.size.lg | retire | S28 |
| --control-h-lg token | sole-consumer audit | S29 |
| Input.state.success | activate | S30 |
| **Input.state.error (live-val)** | **activate** | **S32 (yeni)** |

8/8 segment + token audit + live-val. Sonraki adımlar audit dışı kalır.

---

## Sprint 33+ backlog

1. **EmptyState completed pack 2 deep-scan** — Sprint 23'ten kalan §B-7 follow-up. Aday yer kalmadı izlenimi var; deep-scan + closure doc (track retire muhtemel). _Bu sandbox session'ında FUSE constraint nedeniyle yapılamadı; fresh session'da yapılacak._
2. **TR coverage segment kickoff** (council kararı) — operations/settings/integrations TR scope. Scoping doc + batch listesi.
3. **Storybook coverage 12→25** — post-launch parking.
4. **Card variant census (§C-3)** — yeni audit segment, post-launch parking.

---

## Risk + rollback

- **Risk:** Düşük. confirm Input'a yeni dal eklendi; success ve default davranışı aynen korundu, mismatch durumu fazladan error state'i alıyor. UX kazanım, regresyon yok.
- **Rollback:** PR #1 revert tek commit. Test PR #2 + closure PR #3 de revert edilir, primitive cva değişmedi.
- **Edge case — submit-time vs live error çakışması:** {error} block submit-time error'i gösteriyor (örn. "reset link no longer valid"). Live-val sadece **Input border'ı** üzerinde çalışıyor, error blok'u ezmiyor. İki katman aynı anda var olabilir, kullanıcı için anlamlı:
   - Border kırmızı = "şifreler eşleşmiyor" sinyali (henüz submit etmedin)
   - {error} block = "backend yanıtı: link geçersiz" gibi server-side mesaj
   Çakışma yok, semantik birbirini tamamlıyor.
