# Sortly + inFlow — Şikayet ve Beklenti Analizi

**Tarih:** 2026-04-10
**Amaç:** Yeni bir envanter SaaS'ı tasarlamadan önce, pazardaki iki ana ürünün (Sortly ve inFlow Inventory) gerçek kullanıcı şikayetlerini ve taleplerini sentezleyip bir "fırsat haritası" çıkarmak.
**Kaynak karışımı:** Capterra, G2, Software Advice, GetApp, Trustpilot, Apple App Store, Google Play, Business.org, Research.com karşılaştırma yazıları ve iki mevcut rekabet teardown dosyası (`inflow-inventory-teardown.md`, `sortly-teardown.md`).
**Hedef kullanıcı profili:** Sortly'nin basitliğine, inFlow'un derinliğine ihtiyaç duyan; büyüdükçe kendini boğulmuş hissetmeyen mikro + KOBİ işletmeleri.

---

## 0. Yönetici özeti (TL;DR)

Pazardaki durum net: **Sortly çok basit ama çok pahalı ve yarı-bitmiş**; **inFlow derin ama kurmak/öğrenmek zor, mobilde zayıf, üçüncü parti entegrasyonları kırılgan**. Her iki ürünün kullanıcıları aynı beş ana ağrıdan şikayet ediyor:

1. **Fiyat şeffafsızlığı ve âni zamlar** — özellikle Sortly, ürün kilitli hale geldikten sonra fiyatı ikiye-üçe katlıyor.
2. **Gerçek-zamanlı olmayan envanter** — pick list'ler, eş zamanlı kullanıcılar, çoklu cihaz senkronu. Kullanıcılar "şu an elimde ne var" sorusuna anında cevap alamıyor.
3. **Mobil deneyim tam değil** — inFlow mobilde çok şey yapmıyor; Sortly'nin mobili iyi ama masaüstü paritesi yok.
4. **Muhasebe/e-ticaret entegrasyonları** — QuickBooks bağlantıları "umutsuz", Sortly'de neredeyse hiç yok.
5. **Bulk düzenleme, arama, raporlama ergonomisi** — "basit bir toplu düzenleme niye yok?" sorusu her iki üründe de tekrarlıyor.

Bu beş ağrı, yeni ürünün ilk beş stratejik kararını doğrudan belirliyor. **Fiyatı şeffaflaştır, gerçek-zamanlıyı mimariyle zorunlu tut, mobili birinci sınıf yap, entegrasyonu ilk günden düşün, bulk işlemleri çekirdek say.** Geri kalanı buna göre katmanlanır.

---

## 1. Sortly — Kullanıcı şikayetlerinin anatomisi

### 1.1 Fiyat politikası (şikayet hacmi: yüksek, şiddet: kritik)

Sortly'nin en çok konuşulan problemi ürün değil, **fiyat modeli**. Kullanıcılar Free plan ile başlıyor (100 item limiti), birkaç ay içinde envanterlerini buraya taşıdıktan sonra plana kilitleniyor; ardından gelen zamlara cevap veremiyor.

- Bir kullanıcı aylık aboneliğinin **%300'den fazla arttığını**, destek ekibinin "envanterinizi yarıya indirin ya da 4.000 item için ayda $180 daha ödeyin" cevabı verdiğini aktarıyor. (Capterra/Trustpilot)
- Başka kullanıcılar aboneliklerinin $299/ay noktasına tırmandığını, "büyük envanter kuranları bekleyip zorla üst plana iten" bir strateji algıladığını yazıyor. (Trustpilot)
- Fiyatın **envanter item sayısına göre** hesaplanması, ev envanteri veya koleksiyon kullanıcılarını (büyük envanter, az hareket) cezalandırıyor. (Business.org)
- 2025'te yapılan paket değişiklikleriyle bazı özellikler alt planlardan kaldırıldı; kullanıcılar alternatif aramaya başladı. (Capterra)

**Altında yatan mesaj:** Kullanıcı ilk gün ne ödeyeceğini bilmek istiyor. "100 item ücretsiz, 101. item'dan sonra şok zam" modeli güven kırıyor. Yeni ürün bunu **öngörülebilir seat-bazlı fiyat + envanter hacmi kilidi olmayan plan** ile kırabilir.

### 1.2 Gerçek-zamanlı envanter eksikliği (yüksek şiddet)

- *"Sortly does not have real time inventory tracking, and when you place pick lists it does not show available inventory until it is actually 'Picked'."* — Capterra'dan direkt alıntı.
- Çoklu cihaz senkronu gecikmeli; "bir cihazda saydığım şey diğerinde görünmüyor" şikayetleri tekrarlıyor.
- Pick List aktifken "available" miktar doğru hesaplanmıyor, yani birden fazla çalışan aynı parçayı ayırabiliyor.

**Altında yatan mesaj:** Envanter yazılımından beklenen birinci söz "şu an şu kadar var" olmalı. Sortly bunu garanti edemiyor. Yeni ürün için bu, **append-only stok hareketi ledger'ı + türetilmiş "Available = Owned − Reserved − In-Pick" alan** ile baştan çözülmeli (bu zaten inFlow'un yaptığı şey, ama Sortly yapmıyor).

### 1.3 Toplu işlem ergonomisi (orta şiddet, yaygın)

- *"Manual process for updating counts, requiring opening each item, changing it, saving it, and confirming the save for each individual item."* — App Store yorumu.
- *"Cannot bulk edit items on the app and cannot choose a custom order to display stock."* — Capterra.
- Çöp kutusu (Trash) toplu eylemleri yok, 50 item'ı geri getirmek 50 tıklama.
- QR kod/etiket yazdırma akışında toplu yeniden basım zor.

**Altında yatan mesaj:** Hiç kimse tek tek 400 ürüne tıklamak istemiyor. Yeni ürün için bulk seçim + bulk eylem (düzenle, taşı, sil, yazdır, sayım başlat) **her liste ekranında varsayılan** olmalı.

### 1.4 Entegrasyon/ekosistem zayıflığı (yüksek şiddet, uzun süreli)

- Sortly, 2019'dan beri "entegrasyonlar üzerinde çalışıyoruz" diyor ama liste neredeyse değişmedi. (Business.org)
- Ekosistem: Slack, MS Teams (Ultra), QuickBooks Online (Premium). **Zapier yok, webhooks yok, public REST API sadece Enterprise'da.**
- E-ticaret (Shopify/WooCommerce/Etsy) hiç yok; online satış yapanlar için Sortly duvar.
- *"Cannot sync your books, sell online, or process payments through Sortly."* — Business.org.

**Altında yatan mesaj:** Modern SMB birden fazla sistem kullanıyor. Yeni ürün **ücretsiz tier'da bile çalışan bir webhook + REST API + Zapier/Make connector'ı** ile bu duvarı kırabilir. Bu, maliyeti düşük ama pazarlama hikâyesi çok güçlü bir karar.

### 1.5 Tutarlılık ve güvenlik hataları (düşük frekans, yüksek etki)

- *"After a recent update, all of their items except one were completely gone from the app."* — App Store, veri kaybı hikayesi.
- *"Users have reported losing the ability to secure their information with passcodes or Face ID after updates."* — güvenlik regresyonu.
- Bildirim ayarları ve QR kod reset'leri "aniden kendini sıfırlayan" tutarsız davranışlarla şikayet ediliyor.
- Customer support büyük oranda e-mail/chat; telefon desteği yok.

**Altında yatan mesaj:** Bu noktalar yeni ürün için **ürünleştirilmiş regresyon testi, cihaz-seviyesi kilitleme, ve sync-çatışma çözümleme** disiplinini ima ediyor. (SC'de 754 testlik bir kültür vardı; bu yeni projeye aynen taşınmalı.)

### 1.6 Küçük ama yaygın UX gıcıkları

Bunlar tek başlarına kullanıcıyı ürkütmez ama toplandığında "basit ürün değil" hissi verir:

- Nested klasörlerde **tam yolu (breadcrumb) göremiyorsun** — App Store yorumunda öne çıkan sıkıntı.
- Stokun **özel bir sıralamada** gösterilmesi mümkün değil.
- Tag objeleri sadece isim; renk/ikon/açıklama yok (`sortly-teardown.md` §20.5).
- *"Add Tag"* modal'ı açılır açılmaz "Name is required" hatası gösteriyor — kullanıcı daha yazmadı bile.
- Ayarlar sekmelerine direkt URL ile gidilemiyor (tab state'i URL'de yok).
- Sayım akışı tek-sayım (single count); çift-kör (double-blind) yok.
- Çok dilli UI yok; sadece İngilizce. (Türkiye/MENA/AB için kayıp.)

---

## 2. inFlow Inventory — Kullanıcı şikayetlerinin anatomisi

### 2.1 Öğrenme eğrisi ve arayüz yoğunluğu (orta şiddet, görüş karışık)

inFlow şikayetleri daha az "bozuk" ve daha çok "çok fazla var" çerçevesinde. Değerlendirmeler ikiye bölünüyor:

- Bir grup: *"A somewhat steep learning curve"* — 14 sidebar modülü, 9 ayarlar sekmesi, 7 doküman prefix'i çok fazla.
- Diğer grup: *"Flat learning curve, easy to use"* — özellikle masaüstü web için "mantıklı, temiz" diyorlar.

**Fark nereden çıkıyor?** Tecrübeli KOBİ operatörleri inFlow'u hızla kavrıyor; ilk defa envanter yazılımı kullanan küçük işletmeler bloke oluyor. (Capterra review'ları bu bölünmeyi net gösteriyor.)

**Altında yatan mesaj:** Yeni ürün için **"progressive disclosure"** mimarisi zorunlu: ilk gün 4-5 modül (items, count, move, report), iki hafta sonra PO/SO açılıyor, iki ay sonra variants/manufacturing. Kullanıcı hazır olmadan menüde görmemeli.

### 2.2 Mobil parite (yüksek şiddet)

- *"Wish it has easy access to a tablet or mobile device... when you away from the computer and want to do like a quick inventory count or something. Even look up something up for a customer to see if we have it in stock/more detail info without running back to a desktop everytime."* — Capterra, direkt alıntı.
- *"Limited ability to view attachments on mobile."* — yaygın yorum.
- Ayrıca **Stockroom** adlı scanner-odaklı mobil uygulaması **ayrı SKU** olarak satılıyor ($99-129/ay ek). Yani "tam mobil deneyim" demek = ek lisans almak.

**Altında yatan mesaj:** Mobil ayrı ürün olmamalı. Yeni ürün için mobil = ana ürünün eş parçası. Scan-first operator UX ücretsiz tier'da bile olmalı, çünkü Sortly bunu da güçlü yapıyor ve inFlow yapamıyor.

### 2.3 Entegrasyon kırıklıkları (yüksek şiddet, spesifik)

- *"The integration between inFlow and QuickBooks has been described as hopeless, with users reporting it ends up causing more headaches than it's worth."* — Capterra/Software Advice sentezi.
- *"Users also cite concerns about integration complexity, particularly with accounting software."*
- Cloud ile app (masaüstü) versiyonları arası geçişlerde **özellik tutarsızlığı** iş akışını yavaşlatıyor.

**Altında yatan mesaj:** Muhasebe entegrasyonu "varlık" değil "işlerlik" meselesi. Yeni ürün QBO/Xero entegrasyonunu sadece bağlamak değil, **çatışma çözümleme ve geriye dönük düzeltme** ile kurmalı. QuickBooks'ta halledilemeyen duplicate entry senaryoları için ürün içinde görünür bir "senkron sağlık" ekranı olmalı.

### 2.4 Raporlama esnekliği (orta şiddet, teknik)

- *"Some users struggle with creating inventory reports that exclude items with zero inventory on hand."* — basit bir filtre bile zor.
- *"The basic plan has pretty limited reporting options with users wishing there were more built-in reports without needing an upgrade."*
- inFlow'un 49 raporu var ama **kolon seçici + saklama (saved report)** özellikleri üst planda kilitli.

**Altında yatan mesaj:** Yeni ürün için **rapor filtreleri, saved view ve schedule** ücretsiz/mid-tier'da olmalı. Kullanıcıları "raporum var ama istediğim sütunu göremiyorum" durumuna düşürmek Sortly/inFlow'un ortak hatası.

### 2.5 Üretim/BOM katmanı (düşük frekans, yüksek şiddet)

- *"The software does not automatically update costing on BOMs when you alter the cost of a raw part, so there is more touch time than really should be required."* — üretim modülü eleştirisi.
- Inflow Manufacturing ayrı SKU ve ayrı fiyat merdiveni. Başlangıç fiyatı yüksek.

**Altında yatan mesaj:** Üretim tarafı v1'de **olmamalı**, ama ürün mimarisi buna izin verecek şekilde tasarlanmalı. (BOM'un cost hesabı reaktif olacak; inFlow'un açığı buradan başlıyor.)

### 2.6 Fiyat ve paket şikayetleri

- *"InFlow was originally great for smaller companies but is now too expensive and only for big guys."* — Capterra.
- Entry plan **$129/ay**, ama 2 kullanıcı / 1 lokasyon / sublocation yok / 100 SO/ay limiti — yani gerçekten kullanılabilir ilk tier $349/ay.
- Onboarding package ($499 tek seferlik) Enterprise'da zorunlu, SMB'de opsiyonel ama baskılı satılıyor.
- Serial/lot tracking, API access, Showroom gibi şeyler hep **add-on**. Kullanıcılar "toplam maliyet" hesabı yapınca şaşırıyor.

**Altında yatan mesaj:** Paket karmaşıklığı satışta kayba yol açıyor. Yeni ürün için **< 3 plan**, **add-on yok**, **her şey planın içinde**. (Bu, inFlow'un zayıflığı + Sortly'nin zaafının birleşiminden çıkan tek en güçlü GTM kararı.)

### 2.7 Sample-mode vs prod-mode kafa karışıklığı

- Sample workspace'te DELETE/DEACTIVATE engellenmiş ama ADD/EDIT açık; iyi bir trial mekanizması.
- Ancak prod'a geçince sample data'nın ne olacağı, nereye gittiği belirsiz.
- Bazı kullanıcılar "test datasını prod'a kopyaladım, geri alamıyorum" diyor.

---

## 3. Ortak beklentiler — kullanıcıların "bir tek bu olsa" dediği şeyler

Her iki ürünün kullanıcılarının tekrar eden talepleri:

1. **Gerçek-zamanlı, herkesin aynı şeyi gördüğü envanter** (non-negotiable).
2. **Gerçekten çalışan mobil/tablet deneyimi** — özellikle sahada (fieldwork, van, depot).
3. **QuickBooks ve Xero ile sorunsuz çift yönlü senkron** (hata olduğunda görünen bir panel).
4. **Kolay toplu işlem** (seç → tümünü güncelle / taşı / sil / yazdır).
5. **Açık, öngörülebilir fiyat** (item sayısına göre değil, seat/plan bazlı).
6. **Basit ama güçlü rapor filtreleri** (sütun seçici, kayıtlı görünüm, "sıfır stoğu hariç tut" gibi temel filtreler).
7. **Çok dilli UI** (Sortly'nin açığı, inFlow'un kısmi çözümü).
8. **Doğru entegrasyon ekosistemi** (Shopify, WooCommerce, Zapier, Make, webhooks, API).
9. **Güvenilir sync + conflict resolution** (birden fazla kullanıcı aynı anda çalışırken çakışmaları göster).
10. **"Önce sade görün, sonra güçlen"** mimarisi (progressive disclosure).
11. **Barkod/QR yazdırma ve okutma** her katmanda (özellikle sayım ve pick list'lerde).
12. **Sayım akışında gerçek disiplin** (snapshot, variance, re-count, denetlenebilir geçmiş).

---

## 4. Fırsat haritası — nerede kazanırız, nerede durmalıyız

Aşağıdaki matris, şikayet ve beklentileri dört kategoriye ayırıyor:

### Kategori A — "Ücretsiz kazanç" (düşük maliyet, yüksek şikayet hacmi)

Yeni ürün bu başlıkları **MVP'de** çözmeli. Hiçbirinin teknik maliyeti yüksek değil ama hepsi rakiplerin açık yarası.

| # | Fırsat | Şikayet kaynağı | Çözüm şekli |
|---|---|---|---|
| A1 | Şeffaf, seat-bazlı fiyat | Sortly (kritik) | 3 plan, item limiti yok, her plan tüm core özelliklerle gelir |
| A2 | Bulk seçim + bulk eylem | Sortly + inFlow | Her liste ekranında checkbox sütunu + aksiyon barı |
| A3 | Real-time "Available" alanı | Sortly (kritik), inFlow (iyi) | Append-only ledger + türetilmiş Owned/Reserved/In-Pick/Available |
| A4 | Çöp kutusunda "Delete forever" + bulk restore | Sortly | Trash ekranında multi-select + iki yönlü aksiyon |
| A5 | Nested klasör breadcrumb + yol gösterimi | Sortly | Item kartının başında tam path |
| A6 | Çok dilli UI (TR, EN, DE, ES, FR, AR) | Sortly (açık), inFlow (sınırlı) | i18n first-class |
| A7 | Validation-on-blur, validation-on-submit | Sortly (angry empty form) | Form disiplini |
| A8 | Tab state yerine URL route'ları | Sortly | Her settings sekmesi deeplinkable |
| A9 | Rapor sütun seçici + saved view + "zero stock hariç tut" filtresi | inFlow | Her rapor ekranında |
| A10 | Tag zenginliği (renk + ikon + açıklama) | Sortly | Tag objesi |

### Kategori B — "Moat kurucu" (orta-yüksek maliyet, yüksek değer, rakipler burada zayıf)

| # | Fırsat | Neden moat? |
|---|---|---|
| B1 | Stok sayım motoru (6 tip: cycle, full, spot, blind, double-blind, directed) | Sortly bunu Ultra'da ($74/ay) **single-count** olarak satıyor. inFlow snapshot-at-creation ile güçlü ama 6 tip yok. Yeni ürün her ikisini de aşabilir. |
| B2 | Mobil-first scan-first ana ürün (ek SKU değil) | inFlow Stockroom $99-129/ay ek. Sortly mobil iyi ama masaüstü paritesi sınırlı. Tek ürün + tam parite → kazanç. |
| B3 | Insights motoru (anlatısal / trend / anomali tespiti) | Sortly sadece tablo raporları veriyor. inFlow 49 rapor verse de hepsi tablo. "Bu ay shrinkage %15 arttı, nedeni X deposu" diyen bir sistem yok. |
| B4 | Ücretsiz webhook + REST API + Zapier/Make connector | Sortly API/webhooks Enterprise-only. inFlow'da add-on. Ücretsizde verirsek geliştirici/orta SMB segmenti için farkındalık yakalarız. |
| B5 | QuickBooks & Xero senkronu + "senkron sağlık" ekranı | inFlow entegrasyonu "umutsuz". Ürün içinde görünür bir sync-status dashboard'u tek başına hikâye. |
| B6 | Operatif AI ajanı (FAQ değil) | Sortly Sage bir FAQ botu; aksiyonu yok. Gerçekten "yeni bir sayım aç", "PO gönder", "geçen ay en çok kaybımız nerede" diyen bir ajan farklılaşma yaratır. |
| B7 | Append-only inventory movement ledger | inFlow yapıyor, Sortly yapmıyor. Bu olmadan güvenilir rapor imkansız. Mimari zorunluluk + anlatım. |
| B8 | Sample-mode + safe playground (hiçbir veriyi kaybetmeden denemek) | inFlow'un trial paterni iyi ama geçiş muğlak. Yeni ürün "sample → prod'a tek tıkla temizlik" sunarsa trial-to-paid dönüşümü yükselir. |

### Kategori C — "Yapılmalı ama şimdi değil" (v1 sonrası)

| # | Fırsat | Neden ertelenir? |
|---|---|---|
| C1 | Variants (renk, beden, matris) | Yüksek mimari yük; müşteri sinyaline kadar bekle. |
| C2 | BOM / üretim / work orders | Ayrı bir pazar. Mimari izin versin ama v1'de gelmesin. |
| C3 | B2B wholesale/showroom portalı | Ayrı ürün yüzeyi, v2+. |
| C4 | FIFO/LIFO/manual cost yöntemleri | Önce moving average; cost engine interface'i şimdi, 4 yöntemi sonra. |
| C5 | Dual tax (US state + GST) | Yalnızca çift vergi pazarı için; v1'de tek vergi yeterli. |
| C6 | Serial/lot tracking (her seri numarası ayrı) | v1.5 veya v2; gıda/pharma pazarına yönelirsek önceliklenir. |
| C7 | Manufacturing module, work orders | C2 ile aynı. |
| C8 | Advanced sublocation (bin/aisle tree) | Sublocation global toggle yerine "büyük depo paketi" olarak gelebilir. |

### Kategori D — "Yapma" (ayrıştırılacak veya hiç çıkmayacak)

| # | Yapmama | Gerekçe |
|---|---|---|
| D1 | 10 hardcoded custom field slot | inFlow'un zayıflığı. Biz schema-less key/value ile geliriz; ceiling yok. |
| D2 | "Rename fields" white-label i18n sistemi | Rabbit hole; çoklu müşteri için teknik borç. |
| D3 | Item sayısına göre fiyatlama | Sortly'nin yarasına tam basmak; seat-bazlı. |
| D4 | Ayrı mobil SKU | inFlow hatasını tekrar etmek. Tek ürün. |
| D5 | Webhook/API'yi Enterprise'a kilitlemek | Sortly hatası; biz ücretsiz/mid-tier'da veririz. |
| D6 | Sadece İngilizce UI | i18n gün bir'den. |
| D7 | Nested modal (inFlow'un Custom Fields → Rename sub-modal gibi) | UX smell; tek seviyede çöz. |
| D8 | Sayım motoru tek-count only (Sortly gibi) | Rakibin zayıflığı — biz 6 tipi veririz. |

---

## 5. Strateji — bu bulgulardan çıkan beş komut

Bu başlıklar yeni ürünün kuruluş anayasasının maddeleri gibi düşünülebilir. Hepsi kullanıcı şikayetlerinden doğdu.

1. **"Basit görün, güçlen"** — Progressive disclosure zorunlu. Yeni kullanıcı ilk gün 4-5 modül görür; hazırlandıkça menü açılır. (inFlow yarasına cevap.)
2. **"Hacme değil, koltuğa fiyat"** — Item sayısı hiçbir planda limit değil; koltuk sayısı ve özellik derinliği plan farkı. (Sortly yarasına cevap.)
3. **"Gerçek-zamanlı ya da hiç"** — Tüm stok miktarları append-only ledger'dan türetilir; "Available" her ekran açıldığında anlık hesaplanır. (Sortly + inFlow yarasına cevap.)
4. **"Mobil ek değil, eş"** — Mobil uygulama ayrı SKU olmaz, ana ürünün bir yüzüdür. Scan-first, offline-first; sync conflict resolution görünür. (inFlow yarasına cevap.)
5. **"Entegrasyon demek çalışmak demek"** — Webhooks + REST API + Zapier/Make ücretsiz tier'da; QBO/Xero senkron sağlık ekranı ürün içinde. (Her iki ürünün en kötü tarafı.)

---

## 6. Kısa özet tablosu

| Ağrı noktası | Sortly | inFlow | Yeni ürünün yaklaşımı |
|---|---|---|---|
| Âni fiyat artışı | Kritik | Orta | Sabit seat-bazlı fiyat, item limitsiz |
| Gerçek-zamanlı envanter | Kritik | Sağlam | Append-only ledger + derived fields |
| Mobil parite | İyi ama sınırlı | Zayıf | Eş-parça mobil, offline-first |
| QuickBooks senkronu | Yok | "Umutsuz" | Senkron sağlık ekranı + çatışma çözümü |
| Bulk edit / bulk action | Yok | Sınırlı | Her liste ekranında default |
| Nested klasör yolu | Yok | Var | Breadcrumb + yol |
| Çok dilli UI | Yok | Sınırlı | 6 dil ilk gün |
| Sayım motoru | Tek-count (Ultra'da) | Snapshot ile sağlam | 6 sayım tipi, çift-kör dahil, tüm planlarda |
| Tag zenginliği | İsim only | Orta | Renk + ikon + açıklama |
| Trash'tan kalıcı silme | Yok | Var | Var |
| Rapor sütun seçici | Paid | Paid | Ücretsiz + saved view |
| AI ajan | FAQ bot | Yok | Operatif ajan (sayım aç, PO gönder, nedenini anlat) |
| REST API + webhooks | Enterprise | Add-on | Ücretsiz / mid-tier |
| Onboarding yükü | Düşük (ürün zayıf) | Yüksek | Progressive disclosure |
| Variants | Yok | Var ama ağır | v1+ (mimari hazır, UI sonra) |
| Manufacturing | Yok | Ayrı SKU | v2+ |

---

## 7. Kaynaklar

Bu analiz aşağıdaki kaynaklara dayanıyor:

- [Sortly — Capterra reviews](https://www.capterra.com/p/169199/Sortly-Pro/reviews/)
- [Sortly — Trustpilot](https://www.trustpilot.com/review/sortly.com)
- [Sortly — App Store reviews](https://apps.apple.com/us/app/sortly-inventory-simplified/id529353551)
- [Sortly — Software Advice](https://www.softwareadvice.com/inventory-management/sortly-pro-profile/reviews/)
- [Sortly — GetApp](https://www.getapp.com/operations-management-software/a/sortly-pro/reviews/)
- [Sortly — Business.org incelemesi](https://www.business.org/finance/inventory-management/sortly-review/)
- [Sortly — Research.com incelemesi](https://research.com/software/reviews/sortly)
- [inFlow Inventory — Capterra reviews](https://www.capterra.com/p/78431/inFlow-Inventory/reviews/)
- [inFlow Inventory — G2 reviews](https://www.g2.com/products/inflow-inventory/reviews)
- [inFlow Inventory — Software Advice](https://www.softwareadvice.com/scm/inflow-inventory-profile/reviews/)
- [inFlow Inventory — GetApp](https://www.getapp.com/operations-management-software/a/inflow-inventory/reviews/)
- [inFlow Inventory — Software Connect](https://softwareconnect.com/reviews/inflow-inventory/)
- [inFlow vs Sortly — Capterra comparison](https://www.capterra.com/compare/78431-169199/inFlow-Inventory-vs-Sortly-Pro)
- [inFlow vs Sortly — G2 comparison](https://www.g2.com/compare/sortly-vs-inflow-inventory)
- Dahili: `docs/competitor-analysis/sortly-teardown.md` (607 satırlık canlı teardown)
- Dahili: `docs/competitor-analysis/inflow-inventory-teardown.md` (463 satırlık canlı teardown)
