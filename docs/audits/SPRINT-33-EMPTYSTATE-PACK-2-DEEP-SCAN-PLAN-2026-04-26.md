# Sprint 33 — EmptyState completed pack 2 deep-scan plan

**Tarih:** 2026-04-26
**Önceki tag:** `v1.43.0-confirm-password-live-validation` (Sprint 32)
**Bu PR tag (planlanan):** `v1.43.1-emptystate-pack-2-deep-scan-plan`
**Sprint 33 closure tag (sonra):** `v1.44.0-emptystate-pack-2-{activation|retire}`

---

## TL;DR

Sprint 23'te EmptyState `variant="completed"` track'ı için Pack 1 yapıldı (4 surface). Sprint 23 closure'da "Pack 2 için aday yer kalmadı izlenimi var, deep-scan gerek" notu vardı. Sprint 33 bu deep-scan'i Mac-side bir script ile yapar; sonuca göre **otomatik karar**:

- **Aday ≥ 2** → activation sprint (Sprint 34a), 4 surface'lik pack 1 pattern'i
- **Aday 0-1** → retire kararı, "no candidates after Pack 1" closure doc, track resmen kapanır

Bu yapıdaki amaç: sandbox FUSE constraint nedeniyle deep-scan sandbox'ta yapılamaz; Mac-side full-tree grep ile execute edilir, kararı script üretir.

---

## Sprint 23 Pack 1 referansı (hatırlatma)

Sprint 23'te aktive edilen 4 surface (memory'den):
- (Pack 1 detayı `docs/audits/SPRINT-23-EMPTYSTATE-COMPLETED-PACK-2026-04-26.md`'de — bu doc Mac-side deep-scan output'undan referans alacak)

Pattern: tamamlanmış / kapatılmış / sealed durum + pozitif geri bildirim → `<EmptyState variant="completed" ...>` + pozitif icon (CheckCircle2, Award, Trophy gibi).

---

## Pack 2 için aday domain'ler (hipotez)

Mac-side deep-scan bu domain'lerde anlamlı use-case arar:

| Domain | Aday surface | Tetikleyici |
|---|---|---|
| Purchase Orders | tamamen received PO listesi (filter/state) | "Tüm PO'lar tamamlandı" boş durumu |
| Kits | tamamen assembled kit listesi | "Tüm kit'ler hazır" |
| Transfers | tamamlanmış transfer listesi | "Bekleyen transfer yok" |
| Migrations | tamamlanmış migration listesi (admin/migrations route) | "Tüm migration'lar uygulandı" |
| Items | tüm yeniden-sipariş alarmları çözülmüş | "Reorder gerek yok" |
| Reports | tamamlanmış export job listesi | "Aktif export yok" |
| Integrations | senkronize edilmiş tüm webhook event'ler | "Pending event yok" |
| Putaway | tamamlanmış putaway list'i | "Putaway sırada bekleyen yok" |
| Audit log | tüm review tamamlandı durumu | "Tümü gözden geçirildi" |
| Two-factor | recovery code'lar henüz consume edilmemiş | "Tüm code'lar mevcut" (hatalı pattern, completed değil) |

**Filtre kriteri:** "Tamamlandı / kapatıldı / hepsi yapıldı" semantiği taşımalı, sadece "boş liste" değil. EmptyState `variant="default"` zaten generic boş liste için var; `completed` variant'ı **pozitif tamamlanma** sinyali için.

---

## Deep-scan stratejisi (Mac script)

`apply-sprint-33-deep-scan.command` Mac-side şunları yapar:

1. **Pack 1 surface listesi çıkar** (regex: `<EmptyState[^>]*variant="completed"`)
2. **Aday taraması:**
   - `grep -rln <EmptyState src/` → tüm EmptyState consumer'ları
   - Her consumer dosyada completion-themed kelimeler (`completed`, `tamamlandı`, `done`, `finished`, `sealed`, `kapatıldı`, `received`, `assembled`)
   - Pack 1 zaten kullananları ayıkla
   - Geriye kalan adaylar = pack 2 candidate set
3. **Decision:**
   - candidate count >= 2 → "aday var" raporu dump et, kullanıcı onayı bekler (Sprint 34a activation)
   - candidate count < 2 → otomatik **retire closure** doc + commit + tag `v1.44.0-emptystate-completed-track-retired`
4. **Audit closure manifest update** (Sprint 31'in manifest'ine "EmptyState completed track final closure" satırı eklenir)

---

## Decision criteria detay

### Senaryo A — Pack 2 activation (aday ≥ 2)

Sprint 34a olur:
- PR #1: 2-4 surface'i `variant="completed"`'a migrate et
- PR #2: pinned test (sprint-34-emptystate-completed-pack-2.test.ts)
- PR #3: closure doc + audit closure manifest update

Tag chain: v1.43.2 → v1.43.3 → v1.44.0-emptystate-pack-2-activation

### Senaryo B — Track retire (aday < 2)

Sprint 34b olur (tek PR):
- PR #1: closure doc — "Pack 1 sonrası aday yok, track resmen kapanır"
- Audit closure manifest'e ekleme: "EmptyState completed track: 1 pack (Sprint 23) sonrası exhausted, no further activation candidates."
- Cva variant kalır (Sprint 23'teki 4 surface aktif kullanıyor, retire değil — sadece **track** kapanır)

Tag: v1.44.0-emptystate-completed-track-final-closure

---

## Bu PR (Sprint 33) — sadece scoping + script

Bu doc + Mac script'i bir **PR olarak** commit'lenir, tag `v1.43.1-emptystate-pack-2-deep-scan-plan`. Sprint 33'ün kendi closure'u (Senaryo A veya B) Mac script'i çalıştıktan **sonra** atılır.

Bundle (bu PR):
```
<HASH>  docs(audit): Sprint 33 deep-scan plan + Mac script (EmptyState pack 2)  [v1.43.1]
```

İlişkili dosyalar:
- `docs/audits/SPRINT-33-EMPTYSTATE-PACK-2-DEEP-SCAN-PLAN-2026-04-26.md` (this doc)
- `apply-sprint-33-deep-scan.command` (Mac-side, root /Users/bluefire/Documents/Claude/Projects/OneAce/)

---

## Mac script'i nasıl çalışır

```bash
# Mac terminal'de:
~/Documents/Claude/Projects/OneAce/apply-sprint-33-deep-scan.command

# Script:
# 1. FUSE temizlik + prev-tag guard (= v1.43.1-emptystate-pack-2-deep-scan-plan)
# 2. Pack 1 surface'lerini bul + dump
# 3. Tüm EmptyState consumer'ları + completion keyword'leri grep
# 4. Aday set'i hesapla, ekrana raporla
# 5. Otomatik karar:
#    aday >= 2 → "Senaryo A: Sprint 34a aktivasyon yap" mesajı, manuel onay bekler
#    aday <  2 → otomatik closure doc oluştur, commit, tag v1.44.0, push
```

---

## Risk + rollback

- **Risk:** sıfır. Bu sprint sadece doc + Mac script ekler; hiçbir source/test değişmez.
- **Rollback:** doc + script silinir, tag yumuşak silme.
- **Mac script auto-commit riski (Senaryo B):** retire closure doc otomatik commit edilir. Eğer kullanıcı sonradan "aslında pack 2 yapmak isterim" derse, retire kararı revert edilir, Sprint 34b yerine Sprint 34a yürür. Auto-commit kararı **track kapanışı**, **cva retire değil** — yani revert kolay.

---

## Sprint 33 → 34 zincir görünümü

```
v1.43.0 (Sprint 32 closure)
   ↓
v1.43.1 (Sprint 33 — bu PR — scoping + Mac script)
   ↓
[Mac script çalıştırıldı]
   ↓
   ├─ Senaryo A: v1.43.2/3 → v1.44.0-emptystate-pack-2-activation
   └─ Senaryo B: v1.44.0-emptystate-completed-track-final-closure
   ↓
Sonra: v1.45.0+ TR coverage segment kickoff (Sprint 35+, council launch-blocking)
```
