# Unused-Variant Audit — Closure Manifest

**Tarih:** 2026-04-26
**Audit segment:** UX/UI Audit Apr-25 — §D-1 (state-bazlı primitive census) + downstream unused-variant pack
**Closure tag:** `v1.42.0-unused-variant-closure-manifest`
**Stable branch:** HEAD
**Önceki tag:** `v1.41.0-input-state-success-passwords` (Sprint 30)

---

## TL;DR

UX/UI audit Apr-25'in §D-1 (Input state census, **yeni track family**) ile başlayan unused-variant temizlik segmenti **Sprint 22 → Sprint 30** boyunca 9 sprint sürdü, **7 unused-variant track + 1 token audit**'i çözdü. Bu doc o segmentin kapanış mührüdür: tarihçe, kararlar, regresyon koruma haritası ve "hangi şartlarda yeniden açarız" rehberi.

| Toplam | Sayı |
|---|---|
| Sprint sayısı | 9 (S22..S30) + S31 closure |
| Track sayısı | 7 unused-variant + 1 token audit = **8 track resolved** |
| Aktivasyon | 5 (Button.success, Alert.success+info, Input.size.sm, Input.state.success) |
| Retire | 2 (Input.size.lg, SelectTrigger.size.lg) |
| Token audit | 1 (`--control-h-lg` sole-consumer) |
| Pinned test dosyası | 9+ (her sprint en az 1 yeni guard) |

**NOT:** Sprint 28-30 zinciri 2026-04-26'da iki kez uygulandı. İlk denemede FUSE git index korruption nedeniyle 322,852 satır + 1531 dosya silinmesi içeren corrupt commit (`9e6a31f8`) atıldı, audit zinciri o corrupt state üzerine inşa edildi. Hard reset to `v1.38.0` (Sprint 27 closure) + re-apply ile **temiz şekilde** yeniden uygulandı. Önceki yanlış zincir `backup-pre-reset-v1.46.0` branch'inde origin'de arşiv (audit doc'lar tarihsel kayıt).

---

## 1. Tarihçe — Sprint Çizelgesi

| Sprint | Başlık | Track | Karar | Closure tag |
|---|---|---|---|---|
| **S22** | Input state census (yeni track family §D-1) | Input.state + Input.size baseline | informational + cva union pin | (S22 closure pre-rollback) |
| **S24** | Button.success activation | Button.success | ✅ activate (2 surface) | (pre-rollback v1.31.0) |
| **S25** | Alert.success+info activation | Alert.success, Alert.info | ✅ activate (3+1 surface) | (pre-rollback v1.32.0) |
| **S26** | Input.size.sm activation pack 1 | Input.size.sm | ✅ activate (2 surface) | (pre-rollback v1.36.0) |
| **S27** | Filter-bar full sm + Select primitive | Input.size.sm expand + SelectTrigger.size primitive | ✅ activate (4 surface) + new primitive | `v1.38.0-filter-bar-full-sm` |
| **S28** | Input + SelectTrigger lg retire (re-apply) | Input.size.lg, SelectTrigger.size.lg | ✅ retire (0 use-case) | `v1.39.0-input-select-lg-retire` |
| **S29** | --control-h-lg token sole-consumer audit (re-apply) | `--control-h-lg` token | ✅ sole-consumer pinned (Button.lg) | `v1.40.0-control-h-lg-token-audit` |
| **S30** | Input.state.success activation (re-apply) | Input.state.success | ✅ activate (3 surface — auth passwords) | `v1.41.0-input-state-success-passwords` |
| **S31** | **Audit closure manifest** | (this doc) | 🏁 segment closed | `v1.42.0-unused-variant-closure-manifest` |

---

## 2. Decision Matrix — Track-by-Track

### 2.1 Button.success → ✅ Activate
- Sprint 22 baseline: 0, Sprint 30 sonrası: 2
- Use-case: Settings save confirmation, success toast trigger
- Sprint: S24

### 2.2 Alert.success + Alert.info → ✅ Activate
- success: 0 → 3, info: 0 → 1
- Use-case: import/export tamamlandı, integration synced (success); GDPR notice (info)
- Sprint: S25

### 2.3 Input.size.sm → ✅ Activate (incremental)
- 0 → 4 instance
- Use-case: Filter-bar compact rows (movements + purchase-orders search/date inputs)
- Sprint: S26 → S27 (4 SelectTrigger.sm + 2 Input.sm)
- Bonus: S27'de SelectTrigger primitive cva refactor (size variant eklendi)

### 2.4 Input.size.lg → ✅ Retire
- 0 instance, retired from cva
- Mantık: ERP scope'unda hero/landing input ihtiyacı yok; Button.lg yeterli
- Sprint: S28
- Pinned test: HARD GUARD `<Input size="lg">` = 0

### 2.5 SelectTrigger.size.lg → ✅ Retire
- 0 instance (yeni primitive feature), retired from cva
- Mantık: Input.lg ile lock-step
- Sprint: S28
- Pinned test: HARD GUARD `<SelectTrigger size="lg">` = 0

### 2.6 `--control-h-lg` token → ✅ Sole-consumer pinned
- 1 primitive consumer (Button.lg, 10 surface)
- Token korundu, sole-consumer pinned
- Sprint: S29
- Pinned test: 3. assertion `consumers === ["button.tsx"]`

### 2.7 Input.state.success → ✅ Activate
- 0 → 3 instance (auth password forms)
- Use-case: register password (length≥8), reset-password new-password + confirm
- Sprint: S30
- Census ext: `STATE_TERNARY_REGEX` ternary expression'ları yakalar

### 2.8 Input.state.error / invalid → ✅ Already in use (no track)
- invalid prop ≥ 15 (geçmişten beri aktif)
- Pattern: `aria-invalid={!!error}` veya `<Input invalid />`

---

## 3. Regression Protection Map

```
src/components/
├─ input-state-census.test.ts                    [§D-1 master census, ternary-aware]
│   ├─ Anti-pattern HARD FAIL: raw color/token override
│   ├─ State + size + invalid census snapshot
│   └─ cva union: 2 size + 3 state values (Sprint 28 sonrası)
│
├─ sprint-27-filter-bar-full-sm.test.ts          [Input.size.sm + SelectTrigger primitive]
├─ sprint-28-input-select-lg-retire.test.ts      [Input.lg + SelectTrigger.lg retire, 6 case]
├─ sprint-29-control-h-lg-token-audit.test.ts    [token sole-consumer, 7 case]
└─ sprint-30-input-state-success-passwords.test.ts [Input.state.success, 6 case]
```

---

## 4. Pattern Rehberi — Lessons Learned

### 4.1 Activate vs Retire trade-off
0 kullanımlı variant → "ERP scope'unda anlamlı use-case var mı?" → EVET = activate, HAYIR = retire. S28 (retire) ve S30 (activate) bu kararın iki ucu.

### 4.2 Pinned test üç katmanlı
1. Cva union pin (primitive source)
2. Surface usage pin (beklenen kullanım)
3. HARD GUARD (regresyon koruması: yasak kullanım = 0)

### 4.3 Lock-step token ailesi
`--control-h-sm/md/lg` üçü birden tasarlandı, primitive'ler arasında lock-step. S29 token audit bu lock-step'i pinned hale getirdi.

### 4.4 Comment-friendly regex
S28'de öğrenilen trap: `not.toMatch(/--control-h-lg/)` comment'lerde token adı yakalar. Çözüm: `var\(--control-h-lg\)` actual CSS expression match.

### 4.5 Ternary state expression (S30)
`state={password.length >= 8 ? "success" : "default"}` shape'i için `STATE_TERNARY_REGEX` eklendi. Multi-line tolerant.

### 4.6 FUSE corruption guard'ı (post-rollback dersi)
Apply script'te zorunlu pre-flight:
- `git ls-files --others --exclude-standard | wc -l > 50` → abort
- `git diff --cached --numstat` deletion > 1000 → abort

---

## 5. Backlog (audit segmenti dışı)

Bu manifest **§D-1 + unused-variant pack** segmentini kapatır. Aşağıdakiler farklı segmentlere ait:

1. **Sprint 32** = Confirm-password live-validation (S30 risk maddesi closure, küçük iş)
2. **Sprint 33** = TR coverage segment kickoff (council launch-blocking)
3. Storybook coverage 12→25 — post-launch parking
4. Card variant census + anti-pattern (§C-3) — post-launch parking

---

## 6. "Yeniden açma" rehberi

| Şart | Track yeniden açılır mı? | Nasıl |
|---|---|---|
| Yeni primitive `--control-h-lg` tüketmeye başlar | ✅ S29 test hard-fail | sole-consumer listesini güncelle |
| `<Input size="lg">` regresyon olarak gelir | ✅ S28 test hard-fail | tartış: cva'ya geri eklenmeli mi? |
| Live-validation request (confirm error) | ⏳ Sprint 32 | confirm Input'a `state="error"` ternary ekle |
| Yeni state variant ihtiyacı (warning, processing) | ⚠️ Ayrı sprint | Cva ekle + surface kullanımı + pinned test |

---

## 7. Audit closure mührü

```
🏁 §D-1 + unused-variant pack:    SEALED 2026-04-26
   Sprint sürekliliği:             S22..S30 (9 sprint, S28-30 re-apply post-rollback)
   Track resolution:               7/7 + 1 token audit
   Pinned test cumulative:         50+ case across 9 dosya
   Audit dengesi:                  5 activate + 2 retire + 1 audit
   Backup arşivi:                  origin/backup-pre-reset-v1.46.0
   Sonraki segment:                Sprint 32 (live-val) → Sprint 33 (TR coverage)
```
