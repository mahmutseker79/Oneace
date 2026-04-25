# OneAce — UX/UI Audit Düzeltmesi + Sprint 1 Plan + Uygulama

**Tarih:** 2026-04-25
**Hedef kod:** `oneace/` (ASIL kod, `main` branch, `v1.0.0-rc13`, son tag `v1.14.3-zero-backlog`)
**İlişkili dökümanlar:**
- ❌ Geçersiz: `_archive/oneace2-port-archive-2026-04-25.tar.gz` içinde duran ilk audit raporu (yanlış klasörde yapılmıştı, `oneace2/` eski port üzerine)
- ✅ Bu doküman: oneace/ gerçek bulguları + Sprint 1 PR planı + uygulama notları

## Sprint 1 Uygulama Sonucu (2026-04-25 günü içinde tamamlandı)

| PR | Durum | Tag | Test |
|---|---|---|---|
| #1 aria-current 3 nav | ✅ uygulandı | `v1.14.4-aria-current` | `aria-current-nav.test.ts` |
| #2 44px touch target | ✅ uygulandı | `v1.14.5-touch-target` | `touch-target.test.ts` |
| #3 Dark mode primary | ❌ **İPTAL** | — | bulgu oneace2/'ye özgüydü, oneace/ brand'i zaten indigo, dark scale tutarlı |
| #4 Loading → Skeleton | ✅ uygulandı | `v1.14.6-loading-skeleton` | `no-hardcoded-loading-divs.test.ts` |
| #5 Skip-link i18n | ✅ uygulandı | `v1.14.7-skip-link-i18n` | `a11y-skip-link.test.ts` (güncellendi) |
| #6 KVKK token | ✅ uygulandı | `v1.14.8-kvkk-token` | `kvkk-token-bypass.test.ts` |
| #7 Dashboard PageHeader | ✅ uygulandı (1/5) | `v1.14.9-dashboard-pageheader` | `dashboard-page-header.test.ts` |
| Sprint kapanış | ⏳ Mac'te | `v1.15.0-ux-a11y-pass-1` | `apply-sprint-1.command` çalıştırılınca |

**Önemli düzeltme:** PR #7 plan'da "5 büyük sayfa" hedefliyordu — items/scan/stock-counts/categories dördü zaten PageHeader kullanıyormuş, yalnız dashboard kalmıştı. Oran 85→86/141 (Sprint 2'de 56 sayfa için aşamalı migration).

**Mahmut'un Mac'te yapacağı:**
1. `cleanup-oneace2.command` çalıştır (oneace2/ silinir)
2. `apply-sprint-1.command` çalıştır (6 PR commit + tag + test + push + stable)

---

## 0. Düzeltme Notu

İlk UX/UI audit (`oneace2/docs/audits/UX-UI-WIRE-AUDIT-2026-04-25.md`) **yanlış klasör üzerinde** çıkarıldı. `oneace2/` Apr 12-17 tarihli atılmış bir port denemesiydi (`.git` yok, `oneace-next-port-v0.42.0-phase7.bundle` dosyası vardı), aktif kod `oneace/` altındaydı. Bu kayma ilk Glob aramasında `oneace/src/app/**/page.tsx` "no files" dönmesinden kaynaklandı; aslında `oneace/`'in `src/` ağacı vardı, sadece arama paterni doğru çözmedi.

`oneace2/` arşivlendi (`_archive/oneace2-port-archive-2026-04-25.tar.gz`, 44MB, 1732 dosya) ve silinmek üzere (Mahmut `cleanup-oneace2.command` çalıştırınca). Eski audit'teki bulgular `oneace/` için **büyük ölçüde geçersiz** çünkü `oneace/`'de:

- Türkçe locale + region zaten mevcut (`SUPPORTED_LOCALES = ["tr",...]`, `code: "TR", currency: "TRY"`)
- `Badge.tsx` semantic token kullanıyor (`bg-success-light text-success`, `bg-warning-light text-warning`, `bg-info-light text-info`)
- Token bypass büyük oranda temizlenmiş (rgba 3 dosya, shadow-[] 5, rounded-[] 2, bg-{color}-{shade} 1 dosya)
- Version line dinamik (`getAppVersionLine(t.app.name)` package.json'dan)
- Önceki audit v1.0'ın Phase-1-p0 maddeleri Apr 21'de main'e merge edilmiş (memory'de `oneace_audit_v1_status.md` referansı doğruymuş)
- 8 `error.tsx` (önceki sayım 1'di, oneace2'de)
- 115 `loading.tsx` (önceki sayım 46'ydı)
- 141 sayfa (önceki sayım 120'ydi), 85 sayfa PageHeader kullanıyor (≈%60)

---

## 1. oneace/ Gerçek Durum (Apr 25)

### 1.1 Sayım tablosu (doğrulanmış)

| Metrik | Değer | Yorum |
|---|---:|---|
| `page.tsx` | 141 | (auth, app, marketing, offline) |
| `loading.tsx` | 115 | Çok geniş skeleton coverage |
| `error.tsx` | 8 | Per-segment error boundary'ler |
| `not-found.tsx` | 1 | Root level |
| PageHeader kullanan sayfa | 85 | %60.3 |
| EmptyState kullanan sayfa | 29 | %20.6 |
| `bg-{color}-{shade}` (token bypass) | 1 dosya | `(marketing)/legal/kvkk/page.tsx` |
| `rgba()` literal | 3 dosya | scanner.tsx (camera UI), globals.css (token defs), test |
| `shadow-[...]` custom | 5 dosya | scanner.tsx, onboarding, card.tsx (primitive), header.tsx, sidebar.tsx |
| `rounded-[...]` custom | 2 dosya | scroll-area.tsx, tooltip.tsx (Radix primitive'leri) |
| `aria-current=` | 1 yerde | `wrapper-tabs.tsx:92` (tabs için) |
| `aria-label=` | 28 dosya | iyi kapsam |
| `focus-visible:` | 10 dosya | benzer |
| 44px touch target | 1 dosya | sadece button.tsx (icon size) |
| `<div>Loading...</div>` | 2 dosya | sales-orders/ship, reports/variance-trend client |
| "Skip to main content" hardcoded | 2 dosya | `(app)/layout.tsx:81`, `(marketing)/layout.tsx:26` (test pinli) |
| Son tag | `v1.14.3-zero-backlog` | Memory ile uyumlu |

### 1.2 Kalan gerçek bulgular

Aşağıdakiler `oneace/` üzerinde **hala valid**:

#### B-1 (P1) · Dark mode primary scale teal'den indigo'ya geçiyor

`src/app/globals.css` (`.dark { ... }` bloğu içinde):
```css
--primary-50: #1e1b4b;   /* indigo */
--primary-100: #312e81;  /* indigo */
--primary-500: #818cf8;  /* indigo */
--primary-900: #eef2ff;  /* indigo */
```

Light mode `--primary` ailesi teal (`#1d6a5b`). Dark mode'da brand teal'den indigo'ya geçiyor. Marka kimliği dark mode'da değişiyor.

#### B-2 (P1) · `aria-current=` sadece 1 yerde

Sadece `wrapper-tabs.tsx:92` kullanıyor. Sidebar (`shell/sidebar.tsx`), breadcrumb (`ui/breadcrumb.tsx`), mobile nav, mobile tab bar — hiçbirinde "current page" semantic'i yok. Screen reader navigasyon kalitesi düşük.

#### B-3 (P1) · 44px touch target sadece button.tsx'te

Sidebar nav linkleri, header icon buttonlar (search/notif/avatar), breadcrumb item'lar 36-40px aralığında. Saha personeli mobile UX'i için altta. `button.tsx`'in `default` size'ı `h-10` (40px).

#### B-4 (P1) · 2 hardcoded `<div>Loading...</div>` ham fallback

- `src/app/(app)/sales-orders/[id]/ship/page.tsx:83`
- `src/app/(app)/reports/variance-trend/variance-trend-client.tsx:97`

Client component'lerin `t` mesaj yüklemesi tamamlanmadan önceki render. Stilsiz, EN, skeleton değil.

#### B-5 (P2) · "Skip to main content" hardcoded EN — ama test pin'li

- `src/app/(app)/layout.tsx:81` — `Skip to main content`
- `src/app/(marketing)/layout.tsx:26` — `Skip to main content`
- `src/app/a11y-skip-link.test.ts:35,40,63,64` — bu metni `expect`'le pin'liyor

Yani bilinçli hardcoded; test pinli olduğu için TR çevirisi durumunda test güncellemesi de gerekir.

#### B-6 (P2) · PageHeader kullanmayan 56 sayfa

141 - 85 = 56 sayfa kendi inline yapısını kullanıyor. Bunlar hangi sayfalar? Çoğu büyük ihtimalle:
- `dashboard/page.tsx` (server-side ile inline hero)
- `items/page.tsx` (custom hero)
- `scan/page.tsx`
- `stock-counts/page.tsx`
- … (12-15 büyük sayfa muhtemelen)
- 30+ form/küçük sayfa kendi minimal başlığını yazıyor

Standart pattern'e taşınması gerekir ama bu 1 sprint'lik sürece kasamayabilir. Migration'ı incremental.

#### B-7 (P2) · KVKK marketing sayfasında token bypass

`src/app/(marketing)/legal/kvkk/page.tsx` — tek dosya `bg-{color}-{shade}` kullanıyor. Hızlı düzeltme.

#### B-8 (P2) · Onboarding & scanner custom shadow

- `onboarding/page.tsx`
- `scan/scanner.tsx`

Bunlar bilinçli özel UI olabilir (scanner camera frame özel görsel) ama token'lara çekilmesi tutarlılık için mantıklı.

### 1.3 Eski audit'ten gelmeyen, oneace/ üzerinde **fark olarak çıkan** durumlar

- ✅ `versionLine` dinamik
- ✅ Badge tokenize
- ✅ TR locale + region var
- ✅ 8 error.tsx (geniş kapsam)
- ✅ 115 loading.tsx
- ✅ Sidebar `nav-config.ts` ile şema-driven (`sidebar.tsx` yorum: "P1-4 audit v1.0 §5.9: ... mobile silently omitted Dashboard, Migrations, ...")
- ✅ Wrapper-tabs primitive (yeniden organize edilmiş IA)

Yani `oneace/` audit-driven cycle'lardan geçmiş; bu yeni mini-audit önceki audit'in kapatmadığı pürüzleri yakalıyor.

---

## 2. Sprint 1 — PR-bazında Plan

**Tema:** "A11y nokta atışları + dark mode brand + minor token cleanup"
**Süre:** 1 hafta (5 gün, 7 PR)
**Çıktı tag'i (önerilen):** `v1.15.0-ux-a11y-pass-1`
**Branch stratejisi:** main üzerine doğrudan PR'lar (memory feedback `auto-commit + auto-tag, no clarifying questions, pin every fix with a test`)

### PR #1 · `aria-current="page"` Sidebar + Mobile-Nav + Breadcrumb

**Effort:** XS (1.5-2 saat)
**Dosyalar (3 surface, oneace/ gerçek yapı):**
- `src/components/shell/sidebar.tsx` (NavItem renderı içinde `isItemActive(pathname, item)` zaten var)
- `src/components/shell/mobile-nav.tsx` (drawer; oneace/'de mobile-tab-bar yok, sadece bu)
- `src/components/ui/breadcrumb.tsx`

**Not:** `wrapper-tabs.tsx:92` zaten `aria-current={active ? "page" : undefined}` kullanıyor — bu dosya zaten doğru, dokunulmaz.

**Değişiklik:** Aktif item Link'ine `aria-current={isActive ? "page" : undefined}` eklenir. Breadcrumb son item'a `aria-current="page"`.

**Pinned test:**
```ts
// src/components/shell/__tests__/sidebar-aria.test.tsx
it("active sidebar item exposes aria-current=\"page\"", () => {
  const html = renderSidebar({ pathname: "/items" });
  expect(html).toMatch(/href="\/items"[^>]*aria-current="page"/);
});
it("inactive sidebar items do not have aria-current", () => {
  const html = renderSidebar({ pathname: "/items" });
  expect(html).not.toMatch(/href="\/warehouses"[^>]*aria-current/);
});
// Aynı pattern: mobile-nav, breadcrumb (3 test toplam)
```

**Kabul kriterleri:**
- 3 navigation surface'inde aktif rota `aria-current="page"` taşıyor (wrapper-tabs zaten ✓)
- 3 test geçer
- VoiceOver / NVDA "current page" duyurur (manuel doğrulama opsiyonel)

**Bağımlılık:** Yok

**Tag öneri:** `v1.14.4-aria-current`

---

### PR #2 · 44px Touch Target Standardı (Button + Sidebar Nav + Mobile-Nav + Header)

**Effort:** S (3-4 saat)
**Dosyalar (oneace/ gerçek yapı):**
- `src/components/ui/button.tsx` (default size `h-10` → `h-11`, min 44px)
- `src/components/shell/sidebar.tsx` (NavItem Link `py-2.5` → `py-3` ≈ 48px)
- `src/components/shell/mobile-nav.tsx` (drawer item link `py-2.5` → `py-3`)
- `src/components/shell/header.tsx` (icon button'lar `h-9 w-9` → `h-10 w-10`)
- `src/components/ui/breadcrumb.tsx` (Link minimum padding `py-1.5 px-2`)

**Değişiklik:** Tüm interaktif elementler `min-h-11 min-w-11` (44px) garanti eder. Button.tsx'te `default` size 44px olur, mevcut `h-10` kullanımı eski layout için `compact` variant'a taşınır (yapılırsa).

**Pinned test:**
```ts
// src/components/ui/__tests__/button-touch-target.test.ts
it("button default size meets 44px touch target", () => {
  const classes = buttonVariants({ size: "default" });
  expect(classes).toMatch(/h-11|min-h-\[44px\]|min-h-11/);
});
// Sidebar nav item için snapshot test ya da computed style assertion
```

**Kabul kriterleri:**
- Default Button minimum 44px height
- Sidebar nav linkleri minimum 48px height
- Header icon buttonlar minimum 40px (44 önerilen ama 40 kabul)
- Test geçer

**Bağımlılık:** Yok

**Tag öneri:** `v1.14.5-touch-target`

**Risk:** Button height artışı bazı dense form'larda yer aldığı yeri büyütebilir. Spot-check: items/new, suppliers/new form'ları snapshot test ile.

---

### PR #3 · Dark Mode Primary Scale — Indigo'dan Teal'e Geri Dön

**Effort:** XS (1 saat)
**Dosyalar:** `src/app/globals.css` (`.dark { --primary-* }` blokları)

**Değişiklik:**
```css
.dark {
  /* Önceki: indigo scale → değiştir */
  --primary-50:  #14302a;   /* dark teal-low-saturation */
  --primary-100: #1c403a;
  --primary-200: #29554b;
  --primary-300: #3c6b5d;
  --primary-400: #5b8f7d;
  --primary-500: #8fb8aa;   /* mevcut --primary değeri korunur */
  --primary-600: #a8c9bd;
  --primary-700: #c0d8cf;
  --primary-800: #d8e6df;
  --primary-900: #ecf3ef;

  /* sidebar-primary da bu scale'in 500'üne hizalanır */
  --sidebar-primary: #8fb8aa;
}
```

**Pinned test:**
```ts
// src/app/__tests__/dark-mode-primary-consistency.test.ts
it("dark primary scale stays in teal family (no indigo)", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const dark = css.match(/\.dark \{([\s\S]*?)\n\}/)![1];
  expect(dark).toMatch(/--primary-500: #8fb8aa/);
  expect(dark).not.toMatch(/#818cf8|#a78bfa/); // indigo banned
});
```

**Kabul kriterleri:**
- Dark mode'da primary tüm scale teal ailesinde
- Test geçer
- Manuel doğrulama: dashboard dark mode'da brand renkleri tutarlı

**Bağımlılık:** Yok

**Tag öneri:** `v1.14.6-dark-primary-teal`

---

### PR #4 · 2 Hardcoded `<div>Loading...</div>` → Skeleton

**Effort:** XS (30 dk)
**Dosyalar:**
- `src/app/(app)/sales-orders/[id]/ship/page.tsx:83`
- `src/app/(app)/reports/variance-trend/variance-trend-client.tsx:97`

**Değişiklik:** `<div>Loading...</div>` → `<Skeleton className="h-32 w-full" />` veya `<PageSkeleton />` primitive (var olan).

**Pinned test:**
```ts
// src/app/__tests__/no-hardcoded-loading-divs.test.ts
it("no client component uses raw <div>Loading...</div>", () => {
  const files = glob("src/app/**/*.{tsx,ts}");
  for (const f of files) {
    const content = readFileSync(f, "utf8");
    expect(content).not.toMatch(/<div>Loading\.\.\.<\/div>/);
  }
});
```

**Kabul kriterleri:**
- 2 dosya temiz
- Lint test geçer (ileride ekleneni de yakalar)

**Bağımlılık:** Yok

**Tag öneri:** Bu PR ile birleştirilebilir #5'e.

---

### PR #5 · "Skip to main content" → i18n

**Effort:** S (1 saat — test güncellemesi dahil)
**Dosyalar:**
- `src/lib/i18n/messages/en.ts` (yeni: `t.layout.skipToMain`)
- `src/lib/i18n/messages/tr.ts` (yeni: `Ana içeriğe geç`)
- `src/app/(app)/layout.tsx:81` (kullan `t.layout.skipToMain`)
- `src/app/(marketing)/layout.tsx:26` (aynı)
- `src/app/a11y-skip-link.test.ts` — testi güncelle: hem en hem tr'yi kabul eden regex (`/Skip to main content|Ana içeriğe geç/`)

**Değişiklik:** Catalog'a key ekle, layout'larda kullan, testleri locale-agnostic regex'e çevir.

**Pinned test:** Mevcut `a11y-skip-link.test.ts` güncellenmiş haliyle kalır.

**Kabul kriterleri:**
- TR locale aktifken skip link "Ana içeriğe geç" basar
- EN locale aktifken "Skip to main content"
- Mevcut test güncellenmiş ama hala geçer

**Bağımlılık:** Yok

**Tag öneri:** `v1.14.7-skip-link-i18n` (alternatif: PR #4 ile birleştir → tek tag)

---

### PR #6 · KVKK Sayfası Token Cleanup

**Effort:** XS (30 dk)
**Dosya:** `src/app/(marketing)/legal/kvkk/page.tsx`

**Değişiklik:** `bg-amber-50`, `bg-blue-100` gibi raw Tailwind palette'i `bg-warning-light`, `bg-info-light` semantic token'lara çevir. Eğer KVKK'da legal-info kutusu için kararlı bir pattern gerekiyorsa `<Alert variant="info">` primitive'i tercih.

**Pinned test:**
```ts
// src/app/(marketing)/legal/__tests__/kvkk-token-bypass.test.ts
it("KVKK page uses semantic tokens, not raw Tailwind palette", () => {
  const content = readFileSync("src/app/(marketing)/legal/kvkk/page.tsx", "utf8");
  expect(content).not.toMatch(/bg-(green|amber|emerald|red|blue|indigo|orange|yellow|rose)-(50|100|200|300|400|500|600|700|800|900)/);
});
```

**Kabul kriterleri:**
- KVKK sayfası semantic token kullanır
- Test geçer
- Görsel snapshot fark etmez (yeşil/sarı tonları yakın kalır)

**Bağımlılık:** Yok

**Tag öneri:** Bu PR ile birleştirilebilir #4 ve #5'e.

---

### PR #7 · Top 5 Sayfa için PageHeader Migration (incremental)

**Effort:** M (1-2 gün)
**Dosyalar (öncelikli 5):**
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/items/page.tsx`
- `src/app/(app)/scan/page.tsx`
- `src/app/(app)/stock-counts/page.tsx`
- `src/app/(app)/categories/page.tsx`

**Değişiklik:** Her sayfanın inline başlık+breadcrumb+actions yapısı `PageHeader` primitive'inin uygun varyantına taşınır. PageHeader'a gerekirse yeni prop'lar eklenir (`signals`, `eyebrow`, `heroVariant`).

**Pinned test (per-page):**
```ts
// src/app/(app)/dashboard/__tests__/dashboard-page-header.test.ts
it("dashboard uses canonical PageHeader primitive", () => {
  const content = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
  expect(content).toMatch(/<PageHeader\s/);
});
```

**Kabul kriterleri:**
- 5 sayfa PageHeader kullanıyor
- 5 test geçer
- PageHeader kullanım oranı %60'tan %63'e çıkar (85 → 90)
- Görsel snapshot karşılaştırması: hiçbir sayfada hero yok olmuş gibi görünmüyor

**Bağımlılık:** PageHeader'a hero variant gerekirse önce primitive PR'ı açılır (mini PR-7a).

**Tag öneri:** `v1.15.0-ux-a11y-pass-1` (Sprint 1 sonu, kümülatif tag)

---

### Sprint 1 Toplam Effort

| PR | Tahmini saat | Karmaşıklık |
|---|---:|---|
| PR #1 aria-current | 2 | XS |
| PR #2 44px touch | 4 | S |
| PR #3 Dark primary | 1 | XS |
| PR #4 Loading divs | 0.5 | XS |
| PR #5 Skip-link i18n | 1 | S |
| PR #6 KVKK token | 0.5 | XS |
| PR #7 PageHeader migration | 12-16 | M |
| **Toplam** | **21-25 saat** | **3-4 iş günü** |

5 günlük sprint'te buffer var. PR'lar sıralı zorunlu değil, paralel açılabilir.

---

## 3. Çalıştırma Komutları (Mahmut için)

```bash
# 1. Klasör temizliği (sandbox FUSE izin vermedi, Mac'te çalıştır)
cd ~/Documents/Claude/Projects/OneAce
./cleanup-oneace2.command

# 2. Sprint 1'e başla — branch stratejisi: main üzerine doğrudan
cd oneace
git checkout main
git pull origin main

# Her PR için:
git checkout -b sprint-1/pr-1-aria-current
# ... değişiklik ...
# ... test yaz ...
pnpm test
git add -A && git commit -m "a11y(nav): aria-current=\"page\" eklendi 4 surface'e

PR #1 of Sprint 1 (UX/UI audit Apr-25 follow-up).
Sidebar, mobile-nav, mobile-tab-bar, breadcrumb — hepsinde aktif
rota \`aria-current=\"page\"\` taşıyor. Pinned test: 4 surface
için snapshot test."

git push -u origin sprint-1/pr-1-aria-current
# PR aç, kendi onayla (auto-commit + auto-tag pattern)
git checkout main && git merge sprint-1/pr-1-aria-current --ff-only
git tag -a v1.14.4-aria-current -m "PR #1 Sprint 1 — aria-current 4 nav surface'e"
git push origin main --tags

# Sprint sonu kümülatif tag:
git tag -a v1.15.0-ux-a11y-pass-1 -m "Sprint 1 closure: aria-current + 44px touch + dark primary teal + loading skeleton + skip-link i18n + kvkk token + 5 sayfa PageHeader"
git branch -f stable HEAD
git push origin --tags stable
./scripts/verify.sh deploy
```

---

## 4. Sonraki Sprintler (özet)

### Sprint 2 — i18n & A11y derinleştir + EmptyState coverage (1-2 hafta)

- TR catalog'un tamamını gözden geçir (en.ts ile field-level karşılaştır, eksik anahtar varsa doldur)
- 56 PageHeader-yoksun sayfa için aşamalı migration (5'er 5'er; 30 sayfa hedef)
- EmptyState eksik liste sayfalarına ekle (29 → 50+ hedef)
- Onboarding & scanner shadow'ları token'a çek
- Form a11y full audit (label-input binding, error describedby, fieldset/legend)
- `<axe-core>` CI'da etkinleştir

### Sprint 3 — Storybook + Visual Regression (1-2 hafta)

- Top 25 primitive için Storybook story'leri
- Chromatic veya Playwright-based visual snapshot CI
- Card varyantlarını (7 farklı pattern) tek `<Card variant="...">` API'ye çek
- Pagination primitive ekle, items/PO/movements'a uygula

### Sprint 4 — Tablet UX & Mobile derinleştir (1 hafta)

- Sidebar `md:flex` (tablet açık) veya rail mode
- Mobile-tab-bar 6'ncı sekme (Movements)
- Touch target audit pass-2 (sidebar, breadcrumb, header)
- Renk-körü user testing (icon + text + renk üçlemesi tablo cell'leri)

### Backlog
- Marketing docs sayfalarının layout audit'i
- ICU MessageFormat geçişi (TR plural ileride değil ama Slav/Arap diller için)
- Performance pass (FCP, INP, bundle size)
- Renk kontrast otomatik test CI

---

## 5. Memory Güncellemeleri (yapılacak)

- `oneace_audit_v1_status.md` → ekleme: "Apr 25 Mahmut audit-v2 (UX/UI/wire) yaptı, oneace2/ yanlışlıkla denetlendi, düzeltildi. Bu doc kalan 7 PR planını içeriyor."
- Yeni memory `feedback_oneace2_archive.md` (önemli ders): "İlk Glob `oneace/src/app/**/page.tsx` 'no files' dönüyorsa, klasörün doğru yer olduğundan emin olmak için `ls oneace/src/` ile sanity check yap. `oneace/` `oneace2/` ile karıştırma."
- Yeni reference memory `reference_audit_doc.md` güncelle: "Latest UX/UI audit 2026-04-25, oneace/docs/audits/UX-UI-AUDIT-AND-SPRINT-1-2026-04-25.md."

---

## 6. Doğrulama

Bu doküman yazıldıktan sonra spot-check'ler:

- ✅ `oneace/.git/HEAD` var (main)
- ✅ `oneace/src/app/globals.css` `--primary-50: #1e1b4b` (indigo) — PR #3 hedefi
- ✅ `oneace/src/lib/i18n/messages/tr.ts` var
- ✅ `oneace/package.json` version `1.0.0-rc13`
- ✅ `oneace/src/components/ui/badge.tsx` semantic tokens
- ✅ `oneace/src/components/shell/wrapper-tabs.tsx` `aria-current` 1 yerde
- ✅ Bu rapor: `oneace/docs/audits/UX-UI-AUDIT-AND-SPRINT-1-2026-04-25.md`
- ✅ Arşiv: `_archive/oneace2-port-archive-2026-04-25.tar.gz` (44MB, 1732 dosya, audit raporları dahil)

