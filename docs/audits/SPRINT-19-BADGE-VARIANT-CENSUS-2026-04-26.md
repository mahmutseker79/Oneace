# Sprint 19 — §C-4 Badge variant census + anti-pattern hard-fail

**Tarih:** 2026-04-26 (UX/UI audit Apr-25 §C-4 yeni track — atomic open & close)
**Bundle tag:** `v1.30.0-badge-variant-census`
**Önceki HEAD:** `412404d` (Sprint 18 closure, `v1.29.0-pageheader-closure-card-census`)
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (3 commit)_

NOT: Sandbox FUSE pattern (Sprint 15-18 ile aynı). `OneAce/apply-sprint-19.command`
ile Mac'te commit + tag + push.

---

## PR #1 — Badge anti-pattern migration (4 dosya, 7 instance)

**Tag (planned):** `v1.29.1-badge-anti-pattern-migration`

Sprint 19 census test'i ilk koşulduğunda 4 dosyada 7 Badge raw className
override yakaladı. PR #1 bunları variant prop'a çevirir.

| Dosya | Önceki | Sonraki |
|---|---|---|
| `reports/abc-analysis/abc-analysis-client.tsx` | `<Badge className="bg-destructive-light text-destructive">A</Badge>` | `<Badge variant="destructive">A</Badge>` |
| `reports/abc-analysis/abc-analysis-client.tsx` | `<Badge className="bg-warning-light text-warning">B</Badge>` | `<Badge variant="warning">B</Badge>` |
| `reports/abc-analysis/abc-analysis-client.tsx` | `<Badge className="bg-success-light text-success">C</Badge>` | `<Badge variant="success">C</Badge>` |
| `reports/count-comparison/count-comparison-client.tsx` | `<Badge variant="outline" className="bg-success-light">Match</Badge>` | `<Badge variant="success">Match</Badge>` |
| `reports/department-variance/department-variance-client.tsx` | `<Badge variant="outline" className="bg-success-light">Good</Badge>` | `<Badge variant="success">Good</Badge>` |
| `reports/department-variance/department-variance-client.tsx` | `<Badge variant="secondary" className="bg-warning-light">Warning</Badge>` | `<Badge variant="warning">Warning</Badge>` |
| `settings/reason-codes/reason-code-table-client.tsx` | `<Badge variant="outline" className="bg-success-light">Active</Badge>` | `<Badge variant="success">Active</Badge>` |

**Semantic intent korundu:**
- ABC analysis A/B/C lejantı: kırmızı/sarı/yeşil → `destructive/warning/success`
  (Badge variant tasarım sistemi `success/warning/info` için light tone bg + dark
  text kullanır; `destructive` solid koyu kırmızı. Daha önce tüm üçü light
  tone idi — yeni A solid kırmızı, ABC ölçeğindeki "kritik = en koyu"
  semantiğine daha uygun.)
- Tablo statü Badge'leri (Match/Good/Warning/Active): aynı görsel hedef,
  tek variant prop ile temizlendi.

---

## PR #2 — Badge variant census + anti-pattern hard-fail (yeni track §C-4)

**Tag (planned):** `v1.29.2-badge-variant-census`

Badge primitive 8 named variant kullanır (`default, secondary, destructive,
outline, success, warning, info, processing`), `cva` tabanlı. Sprint 19 census'u
kalıcılaştırır.

**Anti-pattern HARD FAIL = 0:**

```tsx
<Badge className="border-red-500" ...>          ❌
<Badge className="bg-yellow-100" ...>           ❌
<Badge className="bg-destructive" ...>          ❌ (use variant="destructive")
<Badge className="bg-warning-light" ...>        ❌ (use variant="warning")
<Badge className="bg-success-light" ...>        ❌ (use variant="success")
<Badge className="bg-info-light" ...>           ❌ (use variant="info")
<Badge className="bg-secondary" ...>            ❌ (use variant="secondary")
```

**Census snapshot (informational):**

| Variant | Kullanım sayısı |
|---|---|
| secondary | 38 |
| outline | 36 |
| success | 22 |
| destructive | 19 |
| info | 11 |
| warning | 8 |
| processing | 5 |
| default (explicit) | 2 |
| **default (implicit / no variant)** | **40** |
| **Total Badge instance** | **181** |

**Pinned test:** `badge-variant-census.test.ts` (3 case)
- Anti-pattern hard fail = 0
- Variant census snapshot (informational, 8 named + default)
- Variant union güncel (8 named values, cva)

---

## PR #3 — Sprint 19 closure audit doc

**Tag (planned):** `v1.30.0-badge-variant-census`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti (Mac apply script çıktısı sonrası)

```
<HASH-3>  docs(audit): Sprint 19 closure — §C-4 badge variant      [v1.30.0]
<HASH-2>  test(badge): variant census + anti-pattern hard-fail     [v1.29.2]
<HASH-1>  ui(badge): anti-pattern migration (4 dosya, 7 instance)  [v1.29.1]
412404d   docs(audit): Sprint 18 closure — §B-6 + §C-3 (PR #3)     [v1.29.0, prev HEAD]
```

**Closure tag:** `v1.30.0-badge-variant-census` → `<HASH-3>`
**Stable branch:** `<HASH-3>`

**Pinned test toplam (Sprint 19):** 1 yeni dosya, 3 case
- `badge-variant-census.test.ts` (3 case = §C-4 census + hard-fail + union)

**Smoke status (sandbox):** 123/123 ✓ (Sprint 14-19 cumulative — 9 test file)

**Mac apply script:** `OneAce/apply-sprint-19.command`

---

## UX/UI audit Apr-25 — Section status (cumulative)

| Section | Status | Sprint(s) |
|---|---|---|
| **§B-6 PageHeader** | ✅ FULLY CLOSED (115/115 coverage) | Sprint 8-14 + 18 |
| **§B-7 Inline empty pattern** | ✅ FULLY CLOSED (A=B=C=0 hard fail) | Sprint 11-17 |
| **§C-3 Card variant** | ✅ FULLY CLOSED (anti-pattern=0, census) | Sprint 10-12 + 18 |
| **§C-4 Badge variant** | ✅ FULLY CLOSED (anti-pattern=0, census, atomic) | Sprint 19 |

---

## Sprint 20+ backlog (güncel)

§B-6, §B-7, §C-3, §C-4 closed. Yeni track önerileri:

1. **TR native review pass** (Mahmut manuel — i18n string review, terminoloji tutarlılığı)
2. **Chromatic visual regression CI** (27+ story baseline — EmptyState 4 variant + Bare + Card 5 variant + Badge 8 variant + PageHeader)
3. **EmptyState `completed` variant'ı 2-3 daha surface'e yay** (fully reconciled, fully received)
4. **Button variant census** (Card/Badge ile aynı pattern — primary/secondary/destructive/outline/ghost/link kullanımı snapshot + anti-pattern hard-fail) — §C-5 yeni track adayı
5. **§B-8+** — UX/UI audit Apr-25'in B-6/B-7/C-3/C-4 dışındaki sections'larına geç (Mahmut audit doc'u açar, hangisi)
