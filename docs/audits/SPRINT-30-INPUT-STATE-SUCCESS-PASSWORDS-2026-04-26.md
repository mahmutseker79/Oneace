# Sprint 30 — Input.state.success activation in auth password forms

**Tarih:** 2026-04-26 (re-apply post-rollback)
**Önceki tag:** `v1.40.0-control-h-lg-token-audit` (Sprint 29)
**Closure tag:** `v1.41.0-input-state-success-passwords`
**Stable branch:** HEAD

---

## TL;DR

Sprint 22 §D-1 census başlangıcında 0 kullanım olan **Input.state.success** variant'ı, Sprint 30'da auth password input'larında aktive edildi.

| Surface | Aktivasyon | Tetikleyici |
|---|---|---|
| `register-form` password | `state="success"` | password.length >= 8 |
| `reset-password-form` new-password | `state="success"` | password.length >= MIN_PASSWORD_LENGTH (8) |
| `reset-password-form` confirm-password | `state="success"` | confirm.length >= MIN AND confirm === password |

**Login form HARİÇ** (autoComplete="current-password" semantiği — kullanıcının mevcut şifresini sunucu validate eder, success false-positive sinyaldir).

**Pinned test toplam (Sprint 30):** 1 yeni dosya, 6 case + §D-1 census ternary-aware extension.

---

## Karar mantığı

Sprint 28'de Input.size.lg ve SelectTrigger.size.lg **retire** edilmişti (0 kullanım). Sprint 30'da state.success için iki yön mümkündü:
1. Aynı pattern'i tekrarla, retire et
2. Doğal use-case bul, aktive et

Tercih: **Aktivasyon**, çünkü:
- Şifre policy karşılandı sinyali, baseline UX pattern'idir (yeşil border = "geçtin")
- Sync client check, backend dependency yok — sıfır risk
- 3 surface'te tutarlı uygulama lock-step pattern'i kanıtlar

---

## PR #1 — state="success" ternary aktivasyonu

**Tag (planned):** `v1.40.1-input-state-success-passwords`

### `src/app/(auth)/register/register-form.tsx`

```diff
       <Input
         id="password"
         ...
         minLength={8}
         value={password}
         onChange={(e) => setPassword(e.target.value)}
+        state={password.length >= 8 ? "success" : "default"}
       />
```

### `src/app/(auth)/reset-password/reset-password-form.tsx`

```diff
       <Input
         id="new-password"
         ...
         value={password}
         onChange={(e) => setPassword(e.target.value)}
+        state={password.length >= MIN_PASSWORD_LENGTH ? "success" : "default"}
       />
       ...
       <Input
         id="confirm-password"
         ...
         value={confirm}
         onChange={(e) => setConfirm(e.target.value)}
+        state={
+          confirm.length >= MIN_PASSWORD_LENGTH && confirm === password
+            ? "success"
+            : "default"
+        }
       />
```

`confirm` input için kasıtlı tasarım: mismatch durumunda **error değil default** kalır. Submit denemesinde `setError("Passwords do not match.")` çalışır.

---

## PR #2 — Pinned test guard + §D-1 census ternary-aware

**Tag (planned):** `v1.40.2-input-state-success-passwords-test`

Yeni `sprint-30-input-state-success-passwords.test.ts` (6 case):

| # | Assertion |
|---|---|
| 1 | register-form: password Input state ternary `password.length >= 8` ile success |
| 2 | reset-password: new-password Input state ternary `password.length >= MIN_PASSWORD_LENGTH` |
| 3 | reset-password: confirm Input state ternary `confirm.length >= MIN AND confirm === password` |
| 4 | **HARD GUARD:** login-form'da hiçbir Input'ta state=success yok |
| 5 | Cumulative: repo'da Input state=success surface sayısı >= 3 |
| 6 | Input cva'da `success: "border-success"` hâlâ tanımlı |

### `input-state-census.test.ts` ternary-aware update

Yeni `STATE_TERNARY_REGEX` ile ternary expression içindeki literal state değerleri de census'e dahil. Sprint 30 sonrası snapshot:
```
[input-state-census] total=N invalid_prop=N
  states: success=3, default=3
```

Mevcut literal-only davranış kırılmadı.

---

## PR #3 — Sprint 30 closure audit doc

**Tag (planned):** `v1.41.0-input-state-success-passwords`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti

```
<HASH-3>  docs(audit): Sprint 30 closure                                    [v1.41.0]
<HASH-2>  test(input.state): success pinned guard + census ternary-aware    [v1.40.2]
<HASH-1>  ui(auth): wire state=success on register+reset password inputs    [v1.40.1]
```

---

## Audit cumulative status (Sprint 30 sonrası)

| Variant | Karar | Sprint |
|---|---|---|
| Button.success | activate | S24 (pre-rollback) |
| Alert.success+info | activate | S25 (pre-rollback) |
| Input.size.sm | activate | S26+S27 (pre-rollback) |
| Input.size.lg | retire | S28 (re-apply) |
| SelectTrigger.size.lg | retire | S28 (re-apply) |
| `--control-h-lg` token | sole-consumer audit | S29 (re-apply) |
| **Input.state.success** | **activate** | **S30 (yeni)** |

7/7 unused-variant track + token audit RESOLVED.

---

## Risk + rollback

- **Risk:** düşük. 3 surface'te ternary state expression eklendi; `state="default"` ile davranış aynı.
- **Rollback:** PR #1 revert tek commit.
- **Edge case — confirm error semantiği:** Sprint 30 mismatch'te default kalır; Sprint 32 (live-validation) ile error ternary eklenecek.

---

## Sprint 31+ backlog

1. **Sprint 31** = Audit closure manifest (segment SEAL)
2. **Sprint 32** = Confirm-password live-validation (S30 risk maddesi closure)
3. **Sprint 33** = TR coverage segment kickoff (council launch-blocking)
