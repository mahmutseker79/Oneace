# Sprint 32 — confirm-password live-validation (state=error ternary)

**Tarih:** 2026-04-27
**Önceki tag:** `v1.42.0-unused-variant-closure-manifest` (Sprint 31)
**Closure tag:** `v1.43.0-confirm-password-live-val`
**Stable branch:** HEAD

---

## TL;DR

Sprint 30 closure doc'unda risk maddesi olarak yazılan ve Sprint 31 closure manifest §6'da explicit olarak Sprint 32'ye atanan iş: **reset-password formundaki confirm-password Input'ı, mismatch'i submit denemesine kadar gizlemek yerine her keystroke'ta `state="error"` ile yüzeye çıkarsın.**

| Branch | Önce (Sprint 30) | Sonra (Sprint 32) |
|---|---|---|
| `confirm` boş | `default` | `default` (değişiklik yok) |
| `confirm` ≠ `password` | **`default`** (gizli, submit'e kadar) | **`error`** (live, anında) |
| `confirm` === `password` AND length ≥ MIN | `success` | `success` (değişiklik yok) |
| `confirm` === `password` AND length < MIN | `default` | `default` (değişiklik yok) |

Sentence-level "Passwords do not match." copy submit handler'da kalıyor — defense-in-depth, screen-reader otoritesi orada.

**Pinned test toplam (Sprint 32):** 1 yeni dosya (8 case), 1 mevcut dosya tek-assertion order-agnostic refactor.

---

## Karar mantığı

Sprint 30'da bilinçli bir tasarım kararı yapılmıştı: confirm field mismatch'te **default** kalır, error sadece submit'te yüzeye çıkar. Bu kararın gerekçesi:

- "Premature error" kötü UX'tir — kullanıcı henüz typing'i bitirmemiş olabilir
- Length policy zaten new-password field'ında görsel sinyal alıyor

Ancak production-grade auth formlarında **confirm-password specifically** için live mismatch error endüstri standardıdır:

- Kullanıcı zaten confirm'i kasıtlı olarak ikinci kez yazıyor → "henüz bitirmedim" varsayımı confirm'de zayıf
- Tutarsız iki şifre yazmak fiziksel typo demek; daha submit'e gitmeden uyarmak typo recovery time'ı düşürür
- Modern password managers'ın autofill akışı bile mismatch'i anında gösteriyor (parity with browser native UX)

Bu yüzden Sprint 32'de **sadece confirm field için, sadece error branch için, sadece "confirm.length > 0 AND mismatch" durumunda** live activation. Empty confirm hâlâ default — premature error tuzağına düşmüyoruz.

---

## PR #1 — confirm-password Input'a state=error live ternary

**Tag (planned):** `v1.42.1-confirm-password-error-ternary`

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
+        // Sprint 30 — Input.state.success when both fields valid AND match.
+        // Sprint 32 — confirm-password live-val: surface mismatch immediately
+        // via state="error" instead of waiting for submit. Sentence-level
+        // copy still lives in {error} below (only set on submit attempt).
+        //   - confirm empty            → default (no premature error)
+        //   - confirm ≠ password       → error  (live, before submit)
+        //   - confirm === password
+        //     AND length ≥ MIN         → success
+        //   - else (match but short)   → default (length signal lives on
+        //                                 the new-password field above)
+        state={
+          confirm.length === 0
+            ? "default"
+            : confirm !== password
+              ? "error"
+              : password.length >= MIN_PASSWORD_LENGTH
+                ? "success"
+                : "default"
+        }
       />
```

Sprint 30 SOT değişikliği: success branch'in length kontrolü artık `confirm.length` yerine `password.length` üzerinden — single source of truth peer field'da. `confirm === password` zaten geçerse iki uzunluk eşit demektir; tek field'ı kontrol etmek yeterli.

`aria-invalid` Input primitive tarafından otomatik set ediliyor (`state === "error"` → `aria-invalid={true}`), screen reader hint'i bedava geliyor. Sentence-level submit error message ayrı `<p role="alert">` içinde kalıyor.

---

## PR #2 — Pinned test guard + Sprint 30 testinin order-agnostic refactor'ü

**Tag (planned):** `v1.42.2-confirm-password-error-ternary-test`

### Yeni `sprint-32-confirm-password-live-val.test.ts` (8 case)

| # | Assertion |
|---|---|
| 1 | reset-password: confirm Input ternary'sinde hem error hem success branch var |
| 2 | reset-password: error branch ordering live mismatch'i kanıtlıyor (`confirm.length===0 → confirm!==password → "error" → "success"`) |
| 3 | reset-password: empty confirm short-circuit'i `"default"`a (premature error guard) |
| 4 | reset-password: success branch Sprint 30'dan korunuyor (`confirm===password AND password.length>=MIN → "success"`) |
| 5 | reset-password: submit-time `"Passwords do not match."` sentence + `if (password !== confirm)` guard hâlâ wired |
| 6 | **HARD GUARD:** register-form'a state=error ternary EKLENMEDİ (peer field yok, comparison yok) |
| 7 | **HARD GUARD:** login-form'da hâlâ ne state=success ne state=error var (current-password semantiği) |
| 8 | Input cva'da `error: "border-destructive"` hâlâ tanımlı (Sprint 32 activation premise) |

### `sprint-30-input-state-success-passwords.test.ts` order-agnostic refactor

Sprint 30'un confirm-password assertion'ı şu order-sensitive regex'i kullanıyordu:

```ts
/state=\{[\s\S]*?confirm\.length\s*>=\s*MIN_PASSWORD_LENGTH[\s\S]*?confirm\s*===\s*password[\s\S]*?"success"[\s\S]*?\}/
```

Sprint 32 ternary'si `confirm.length===0 → confirm!==password → password.length>=MIN → "success"` order'ına geçtiği için bu regex artık match etmiyordu. **Semantik invariant aynı** (success requires match AND length), sadece ifade order'ı ve length-source'u değişti. Test üç ayrı assertion'a bölündü:

```ts
expect(window_).toMatch(/"success"/);
expect(window_).toMatch(/confirm\s*===\s*password|password\s*===\s*confirm/);
expect(window_).toMatch(/(?:password|confirm)\.length\s*>=\s*MIN_PASSWORD_LENGTH/);
```

Diğer 6 Sprint 30 case'i değişmedi (register-form, new-password, login HARD GUARD, cumulative count, cva success branch).

---

## PR #3 — Sprint 32 closure audit doc

**Tag (planned):** `v1.43.0-confirm-password-live-val`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti

```
<HASH-3>  docs(audit): Sprint 32 closure                                    [v1.43.0]
<HASH-2>  test(input.state): confirm-password live-val pinned guard +       [v1.42.2]
            Sprint 30 confirm assertion order-agnostic refactor
<HASH-1>  ui(auth): wire state=error live ternary on confirm-password       [v1.42.1]
```

---

## Audit cumulative status (Sprint 32 sonrası)

| Variant | Karar | Sprint |
|---|---|---|
| Button.success | activate | S24 |
| Alert.success+info | activate | S25 |
| Input.size.sm | activate | S26+S27 |
| Input.size.lg | retire | S28 |
| SelectTrigger.size.lg | retire | S28 |
| `--control-h-lg` token | sole-consumer audit | S29 |
| Input.state.success | activate | S30 |
| **Input.state.error (live confirm)** | **activate** | **S32 (yeni)** |

8/8 unused-variant track + token audit RESOLVED. §D-1 + unused-variant pack segmenti hâlâ SEALED (Sprint 31'de mühürlenmişti); Sprint 32 o segmentin **risk maddesi closure**'ı, yeni bir track açmıyor — sadece S30'un bilinçli olarak ertelenmiş edge case'ini kapatıyor.

---

## Risk + rollback

- **Risk:** çok düşük. Tek dosyada tek `state` prop expression değişti; davranışsal etki sadece visual border rengi (success → error swap) ve `aria-invalid` flag'i. Submit yolunu değiştirmedi.
- **Rollback:** PR #1 revert tek commit; PR #2 testi de aynı revert ile fail edeceği için lock-step revert.
- **Edge case — autofill yarış durumu:** browser autofill bazı durumlarda iki field'ı asenkron set ediyor (yeni-password önce, confirm sonra). Race window'da `confirm` doluyken `password` hâlâ boş olabilir → confirm geçici olarak `error` görür. Submit handler her iki field'ı atomic okuyor; gerçek bir UX sorununa yol açmıyor. Re-evaluation: post-launch telemetry'den autofill mismatch report sayısı artarsa Sprint XX'de debounce ekle.

---

## Live-val pattern'in başka surface'lere taşınması (referans)

Bu sprint sadece `reset-password-form` confirm field'ını kapsıyor. Aynı pattern'in açıkça uygulanmadığı surface'ler:

| Surface | Live-val kararı | Gerekçe |
|---|---|---|
| `register-form` password | ❌ **uygulanmadı** | Tek field, peer comparison yok. Length zaten S30 success ile gösteriliyor. |
| `register-form` confirm-password | n/a | Register formunda confirm field yok (better-auth tek password alıyor) |
| `login-form` password | ❌ **uygulanmadı** | current-password semantiği — server authoritative, client-side mismatch sinyali false-positive |
| Diğer formlar (örn. profile change-password varsa) | ⏳ **post-launch backlog** | İhtiyaç doğdukça eski Sprint 30/32 pattern'i ile lock-step uygula |

---

## Sprint 33+ backlog

1. **Sprint 33** = TR coverage segment kickoff (council launch-blocking) — değişmedi
2. Storybook coverage 12→25 — post-launch parking
3. Card variant census + anti-pattern (§C-3) — post-launch parking
4. (yeni opsiyonel) Profile change-password formu eklendiğinde confirm-password live-val pattern'ini taşı
