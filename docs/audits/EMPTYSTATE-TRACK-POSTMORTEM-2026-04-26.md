# EmptyState track post-mortem — iki yanlış karar + gerçek timeline

**Tarih:** 2026-04-26
**Önceki tag:** `v1.45.0-sprint-33-retire-reversal` (yanlış premise)
**Closure tag:** `v1.46.0-emptystate-track-postmortem`
**Stable branch:** HEAD

---

## TL;DR

EmptyState `variant="completed"` track'inin git history'sini araştırdık. Sprint 33 (retire) ve Sprint 33.5 (reversal) **iki yanlış karar üst üste**: ilki yanlış gerekçeyle doğru sonuca ulaştı, ikincisi yanlış hipotezle yanlış sonuca ulaştı.

Bu doc:
- Gerçek timeline'ı sabitler (eklenme + silinme commit'leri)
- İki yanlış karar açıklamasını verir
- Memory'i düzeltir
- Sprint 34 için temiz başlangıç noktasını işaretler

---

## Gerçek timeline

**EmptyState primitive eklenme commit:**
```
7cbbd84897bdf369a2526df9829d38390065d36c 2026-04-14T15:22:45+03:00 feat(hardening): EmptyState component + fix items filtered-empty bug
```

**EmptyState primitive silinme commit'leri:**
```
9e6a31f8312fe8b727c238d1cc92a5fc951b11fb|2026-04-26T11:18:17+03:00|ui(input+select): retire size=lg variant from cva (0 usage) (Sprint 28 PR #1)

src/components/ui/empty-state.tsx
3fdd8720c008f5b8edf7574623f45216e708cc5e|2026-04-17T08:00:36+03:00|fix: override install command for Vercel

src/components/ui/empty-state.tsx
5e305deaafe4591f717987e7d959d16733acfcaf|2026-04-15T08:56:56+03:00|fix: regenerate pnpm-lock.yaml for Vercel deployment

src/components/ui/empty-state.tsx
```


**HEAD'de durum (mevcut):**
- `src/components/ui/empty-state.tsx` → YOK
- `<EmptyState>` consumer count → 0
- `variant="completed"` surface count → 0
- EmptyState track tamamen yok (primitive seviyesinde)

---

## İki yanlış karar

### Sprint 33 retire (`v1.44.0-emptystate-completed-track-final-closure`)

**Yanlış gerekçe:** Mac deep-scan disk üzerinde grep yaptı, 0 sonuç buldu, "aday < 2 → retire" Senaryo B'ye geçti. **Gerekçenin temeli yanlış** çünkü:
- Disk grep dosya yokluğunu "kullanım yok" diye yorumladı
- Aslında EmptyState primitive `history`'de var ama HEAD'de yok bilgisi vardı
- `git ls-tree HEAD` veya `git grep` kullansaydık aynı 0 sonucu doğru gerekçeyle bulurduk

**Sonuç tesadüfen doğru:** Track gerçekten HEAD'de yok, retire mantıken doğru.

### Sprint 33.5 reversal (`v1.45.0-sprint-33-retire-reversal`)

**Yanlış hipotez:** "Disk-git desync" hipotezi kurduk (FUSE patolojisi). Aslında:
- `git diff HEAD --name-only` → 0
- `git diff HEAD --diff-filter=D` → 0
- Sync TAMAMEN doğruydu, dosyalar zaten silinmişti

**Yanlış sonuç:** Reversal doc "track AÇIK" iddiası attı. Aslında track YOK. Reversal commit'inin içeriği gerçeğe uymuyor.

---

## Memory düzeltmeleri

Memory'de bayatlamış iddialar:
- ~~"Sprint 23 EmptyState completed pack 1 = 4 surface aktive"~~ → **Sprint 23 olmuş, sonra primitive silinmiş**
- ~~"Sprint 33 retire = doğru karar (cva variant kalır)"~~ → **Track + primitive HEAD'de yok; cva yok**
- ~~"Sprint 33.5 reversal = track AÇIK"~~ → **Track YOK; reversal yanlış premise**

Yeni durum: **EmptyState track artık ERP scope'unda mevcut değil.** Sprint 23-33-33.5 zinciri tarihsel kayıttır, mevcut işleyiş için anlamı yok.

---

## Önlemler (gelecekteki Mac-side script'ler için)

1. **Disk grep yerine git grep kullan:**
   ```bash
   # Yanlış (disk-bağımlı):
   grep -rln 'pattern' src

   # Doğru:
   git grep -ln 'pattern'
   git ls-tree -r HEAD --name-only | grep -i 'pattern'
   ```

2. **Memory iddialarını her zaman git'le doğrula:**
   ```bash
   # Memory: "Sprint X 4 surface aktive"
   # Doğrulama:
   git log --all --grep="Sprint X" --oneline
   git show <sprint-tag>:src/path/to/file
   ```

3. **Hipotez kurmadan önce iki kontrol:**
   - `git diff HEAD` (working tree vs HEAD)
   - `git log --all --diff-filter=D -- <path>` (silinme tarihi)

Memory'ye eklenecek feedback: `feedback_deep_scan_use_git_grep.md` + `feedback_memory_iddia_git_dogrulamasi.md`.

---

## Sprint 34+ backlog (güncel + temiz)

EmptyState track'i kapalı (artık tarihsel kayıt). Yeni adımlar:

1. **Sprint 34 = TR coverage segment kickoff** (council kararı, launch-blocking)
2. Storybook coverage 12→25 — post-launch parking
3. Card variant census (§C-3) — post-launch parking
4. Eğer EmptyState ileride yeniden lazım olursa: yeni primitive olarak eklenir, eski Sprint 23-33-33.5 zinciri arşiv olarak kalır

---

## Risk + rollback

- **Risk:** sıfır. Bu post-mortem sadece doc + memory düzeltmesi; Sprint 33 retire ve Sprint 33.5 reversal commit'leri git history'de kalır.
- **Rollback:** Bu doc'u silmek tek revert. Tarihsel doğruluk kaybedilir ama repo bozulmaz.
