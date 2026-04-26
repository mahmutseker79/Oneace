# Sprint 33 retire kararı reversal — yanlış premise

**Tarih:** 2026-04-26
**Önceki tag:** `v1.44.0-emptystate-completed-track-final-closure` (Sprint 33 Senaryo B)
**Reversal tag:** `v1.45.0-sprint-33-retire-reversal`
**Stable branch:** HEAD

---

## TL;DR

Sprint 33 `apply-sprint-33-deep-scan.command` Pack 1 surface count = 0 buldu, Senaryo B retire'a otomatik geçti. **Premise YANLIŞ:** working tree o anda disk-git senkron değildi (recovery sonrası dosyalar fiziksel olarak eksikti), git history ise Sprint 23 4-surface activation'ı içeriyordu.

`verify-sprint-33-baseline.command` çıktısı bunu kanıtladı:
- `9301534 ui(empty-state): completed variant pack 1 — 4 surface (Sprint 23 PR #1)`
- Tag `v1.26.1-emptystate-completed-variant` diff stat: 4 dosya, 126 insertion
- AMA `find src -name "empty*"` 0 dosya
- `git checkout HEAD -- .` ile restore sonrası dosyalar geri geldi

Bu reversal doc Sprint 33 retire kararını **çevirir**:

Working tree'deki Pack 1 doğrulaması (restore sonrası):
```
Toplam <EmptyState> consumer: 0
variant="completed" surface: 0

Pack 1 surface listesi:
```

---

## Karar

**Sprint 33 retire'ı çevriliyor.** EmptyState `variant="completed"` track'ı **AÇIK** kalıyor:
- v1.44.0 retire commit'i git history'de kalır (geçmiş silinmez)
- Bu reversal doc o kararın yanlış premise üzerine kurulu olduğunu kayda geçirir
- Pack 2 araması Sprint 34+ için tekrar gündemde

---

## Kök neden

Mac repo recovery sırasında `git clone` sonrası **working tree disk-git senkron değildi** — git index'i HEAD tree'yi içeriyordu, ama disk dosyalarının çoğu fiziksel olarak eksikti. `apply-sprint-33-deep-scan.command` disk üzerinde grep yaptığı için 0 sonuç buldu. `git ls-tree HEAD` veya `git ls-files` kullansaydı doğru sonucu görürdü.

Bu disk-git desync'in nedeni: FUSE mount layer'ın working tree'yi populate edememesi (CLAUDE.md `feedback_fuse_index_persistent_corruption` patolojisinin başka bir tezahürü).

---

## Önlem (Sprint 34+ için)

Mac-side deep-scan script'leri **disk grep yerine git ls-tree kullanmalı**:

```bash
# Yanlış (disk-bağımlı):
grep -rln 'variant="completed"' src

# Doğru (git tree-bağımlı, disk durumundan bağımsız):
git ls-tree -r HEAD --name-only | xargs -I{} git show HEAD:{} | grep ...
# veya
git grep 'variant="completed"' HEAD
```

`git grep` bu tür script'lerin de-facto standardı olmalı — disk corrupt olsa bile doğru sonuç verir.

Memory'ye eklenecek feedback: `feedback_deep_scan_use_git_grep.md`.

---

## Sprint 34+ backlog (güncel)

1. **Sprint 34 = EmptyState pack 2 doğru deep-scan** (git grep ile, restore'dan sonra) — fresh session, FUSE temiz
2. Sprint 35 = TR coverage segment kickoff (council launch-blocking)
3. Storybook coverage 12→25 — post-launch parking
4. Card variant census (§C-3) — post-launch parking

---

## Risk + rollback

- **Risk:** sıfır. Reversal doc + tag eklenir; mevcut Sprint 33 retire commit'i (`759e8d1`) git history'de kalır. `v1.44.0` tag'i de kalır (silinmez).
- **Rollback:** Bu reversal'ı revert etmek = Sprint 33 retire'ı tekrar yürürlüğe sokmak. Tek doc revert.
