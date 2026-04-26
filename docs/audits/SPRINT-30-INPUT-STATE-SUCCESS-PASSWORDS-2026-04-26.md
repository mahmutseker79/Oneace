# Sprint 30 — Input.state.success activation in auth password forms

**Tarih:** 2026-04-26
**Önceki tag:** `v1.40.0-control-h-lg-token-audit` (Sprint 29 closure)
**Closure tag:** `v1.41.0-input-state-success-passwords`
**Stable branch:** HEAD

---

## TL;DR

Sprint 22 §D-1 census başlangıcında 0 kullanım olan **Input.state.success** variant'ı, Sprint 30'da auth password input'larında aktive edildi. Bu, unused-variant audit'inin son açık track'iydi: artık §D-1 + unused-variant pack tamamen kapatılmış durumda.

| Surface | Aktivasyon | Tetikleyici |
|---|---|---|
| `register-form` password | `state="success"` | password.length >= 8 |
| `reset-password-form` new-password | `state="success"` | password.length >= MIN_PASSWORD_LENGTH (8) |
| `reset-password-form` confirm-password | `state="success"` | confirm.length >= MIN AND confirm === password |

**Login form HARİÇ** (autoComplete="current-password" semantiği — kullanıcının mevcut şifresini sunucu validate eder, success false-positive sinyaldir).

**Pinned test toplam (Sprint 30):** 1 yeni dosya, 6 case + §D-1 census ternary-aware genişletme.

---

## Karar mantığı

Sprint 28'de Input.size.lg ve SelectTrigger.size.lg **retire** edilmişti (0 kullanım, primitive cva temizliği). Sprint 30'da state.success için iki yön mümkündü:

1. **Aynı pattern'i tekrarla, retire et** — clean cva surface, 1 daha az variant.
2. **Doğal use-case bul, aktive et** — variant'ın gerçek değeri var, sistem genişlesin.

Tercih: **Aktivasyon**, çünkü:
- Şifre policy karşılandı sinyali, baseline UX pattern'idir (yeşil border = "geçtin").
- Sync client check, backend dependency yok — sıfır risk.
- 3 surface'te tutarlı uygulama lock-step pattern'i kanıtlar.
- Son kalan unused-variant'ı aktive etmek, audit closure'unu **6 activate + 2 retire** dengesiyle bitirir (sırf retire spree değil).

Eğer Sprint 31+ taramasında 1-2 sprint sonra hâlâ tek kullanıcı bunlarsa, retire kararı tekrar düşünülebilir — ama o zaman bile son kullanım var.

---

## PR #1 — state="success" ternary aktivasyonu

**Tag (planned):** `v1.40.1-input-state-success-passwords`

### `src/app/(auth)/register/register-form.tsx`

```diff
       <Input
         id="password"
         type="password"
         ...
         minLength={8}
         value={password}
         onChange={(e) => setPassword(e.target.value)}
+        // Sprint 30 — Input.state.success activation: visual confirmation
+        // when the new password meets the 8-char minimum. ...
+        state={password.length >= 8 ? "success" : "default"}
       />
```

### `src/app/(auth)/reset-password/reset-password-form.tsx`

```diff
       <Input
         id="new-password"
         ...
         minLength={MIN_PASSWORD_LENGTH}
         value={password}
         onChange={(e) => setPassword(e.target.value)}
+        state={password.length >= MIN_PASSWORD_LENGTH ? "success" : "default"}
       />
       ...
       <Input
         id="confirm-password"
         ...
         minLength={MIN_PASSWORD_LENGTH}
         value={confirm}
         onChange={(e) => setConfirm(e.target.value)}
+        state={
+          confirm.length >= MIN_PASSWORD_LENGTH && confirm === password
+            ? "success"
+            : "default"
+        }
       />
```

`confirm` input için kasıtlı tasarım: mismatch durumunda **error değil default** kalır (kullanıcı henüz yazıyor olabilir). Submit denemesinde `setError("Passwords do not match.")` çalışır — error ondan sonra görünür.

---

## PR #2 — Pinned test guard + §D-1 census ternary-aware genişletme

**Tag (planned):** `v1.40.2-input-state-success-passwords-test`

### Yeni `sprint-30-input-state-success-passwords.test.ts` (6 case)

| # | Assertion |
|---|---|
| 1 | register-form: password Input state ternary `password.length >= 8` ile success |
| 2 | reset-password: new-password Input state ternary `password.length >= MIN_PASSWORD_LENGTH` |
| 3 | reset-password: confirm Input state ternary `confirm.length >= MIN AND confirm === password` |
| 4 | **HARD GUARD:** login-form'da hiçbir Input'ta state=success yok (false-positive guard) |
| 5 | Cumulative: repo'da Input state=success surface sayısı >= 3 |
| 6 | Input cva'da `success: "border-success"` hâlâ tanımlı (activation premise) |

### `input-state-census.test.ts` ternary-aware update

Yeni regex `STATE_TERNARY_REGEX = /<Input\b[\s\S]*?\bstate=\{[\s\S]*?["'](\w+)["'][\s\S]*?\}/g` ile ternary expression içindeki literal state değerlerini de census'e dahil eder. Sprint 30 sonrası snapshot:

```
[input-state-census] total=145 invalid_prop=15
  states: success=3, default=3
  sizes:  sm=4
```

`success=3` = 3 surface'te `"success"` literal'ı, `default=3` = aynı 3 surface'te ternary'nin "default" alternatifi. Geçmiş literal-only davranış kırılmadı (mevcut test'ler hâlâ geçer); ternary kullanımı görünür hale geldi.

---

## PR #3 — Sprint 30 closure audit doc

**Tag (planned):** `v1.41.0-input-state-success-passwords`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti

```
<HASH-3>  docs(audit): Sprint 30 closure — input.state.success activation  [v1.41.0]
<HASH-2>  test(input.state): success activation pinned guard + census ext  [v1.40.2]
<HASH-1>  ui(auth): wire state=success on register+reset password inputs   [v1.40.1]
<SPRINT-29-PR2>  docs(audit): Sprint 29 closure (PR #2)                     [v1.40.0, prev HEAD]
```

**Closure tag:** `v1.41.0-input-state-success-passwords`
**Stable branch:** HEAD

**Smoke (sandbox) Sprint 30 + cumulative tabaka:**
```
✓ src/components/sprint-30-input-state-success-passwords.test.ts (6 tests)
✓ src/components/sprint-29-control-h-lg-token-audit.test.ts (7 tests)
✓ src/components/sprint-28-input-select-lg-retire.test.ts (6 tests)
✓ src/components/sprint-27-filter-bar-full-sm.test.ts (9 tests)
✓ src/components/input-state-census.test.ts (3 tests, ternary-aware)
Test Files  5 passed (5)  |  Tests 31 passed (31)
```

**Mac apply script:** `OneAce/apply-sprint-30.command` (guard: prev tag = v1.40.0-control-h-lg-token-audit).

---

## Audit cumulative status (Sprint 30 sonrası)

### Unused-variant audit (Sprint 22 §D-1 + downstream)

| Variant | Sprint 22 baseline | Şu an | Karar | Sprint |
|---|---|---|---|---|
| Button.success | 0 | 2 | ✅ activated | S24 |
| Alert.success | 0 | 3 | ✅ activated | S25 |
| Alert.info | 0 | 1 | ✅ activated | S25 |
| Input.size.sm | 0 | 4 | ✅ activated | S26+S27 |
| Input.size.lg | 0 | retired | ✅ retired | S28 |
| SelectTrigger.size.lg | (S27 added, 0) | retired | ✅ retired | S28 |
| `--control-h-lg` token | sole-consumer | sole-consumer | ✅ token audit | S29 |
| **Input.state.success** | **0** | **3** | ✅ **activated** | **S30 (yeni)** |

### 7/7 unused-variant track + token audit RESOLVED.

**Audit segmenti kapanışa hazır:** Sprint 31 = closure manifest doc (audit history tarihselleştirilir, kapanış mührü).

---

## Sprint 31+ backlog

1. **Unused-variant audit closure manifest** — tek bir KAPANIŞ doc'u: §D-1 + unused-variant pack tarihselleştirme. S22→S30 tüm sprint'leri tek tabloda, retired/activated dengesi, lessons learned, regresyon koruma haritası.
2. **Storybook coverage 12→25** — Sprint 8-9 storybook backlog (PageHeader, Combobox, MultiSelect vb.). Unused-variant track kapandığına göre coverage genişletme zamanı.
3. **EmptyState completed pack 2** — Sprint 23 sonrası deep-scan; kalan aday yer yoksa "completed pack tamam" doc'u.
4. **§B/§C bekleyen başka track family yok** — UX/UI audit Apr-25 §A..§E haritasındaki §D-1 son açık familyaydı. Sprint 31 closure manifest'i bunu da tarihselleştirir.

---

## Risk + rollback

- **Risk:** Düşük. 3 surface'te ternary state expression eklendi; `state="default"` ile davranış aynı (sınır olmayan input). Yalnız visual fark: success state border-success token'ı (yeşilimsi) geçerli şifrede.
- **Rollback:** PR #1 revert tek commit. Test PR #2 + closure PR #3 de revert edilir, primitive cva değişmedi.
- **Edge case — confirm error semantiği:** Sprint 30 confirm input'ta mismatch durumunda **error değil default** state kullanır. Bu kasıtlı: kullanıcı henüz yazıyor olabilir. Submit edip mismatch olunca `{error}` blokunun kendisi kullanıcıya geri bildirim verir. Eğer ileride live-validation istenirse `state="error"` ternary'i confirm.length > 0 && confirm !== password için eklenebilir (Sprint 32+ adayı).
- **Color contrast (a11y):** `--success` token Sprint 1+ pass'te WCAG AA contrast ile tasarlandı (touch-target.test.ts'in token testlerinde dolaylı doğrulanıyor). Border vurgusu aria-invalid sinyalinden ayrı; screen reader davranışı değişmedi.
