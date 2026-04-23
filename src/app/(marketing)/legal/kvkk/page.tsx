// GOD MODE roadmap 2026-04-23 P1-07 — KVKK (Türk Kişisel Verileri
// Koruma Kanunu, 6698 sayılı) bilgilendirme sayfası.
//
// STATUS: DRAFT — AWAITING COUNSEL REVIEW.
//
// Bu içerik Türkiye'de faaliyet gösterecek bir SaaS için KVKK
// çerçevesinin sistematik bir iskeletidir. Canlıya çıkmadan önce:
//   (a) Veri Sorumlusu (data controller) olarak Anonim / Limited
//       unvan + Mersis numarası legal entity oluştuktan sonra
//       yerine konulacak.
//   (b) VERBIS sicil numarası / muafiyet durumu doldurulacak
//       (yıllık ciro + çalışan sayısı eşiklerine bakılacak).
//   (c) Avukat onayı alınmadan paid launch yapılmamalı; bu dosya
//       "KVKK kapsamı açıktır" sinyalinden öte bir taahhüt
//       içermez. Production footer'ındaki bağlantı bu sayfaya
//       gelmeye başladığında kapsam "legal-ready" olmalı.
//
// İç tutarlılık:
//   - "Veri kategorileri" bölümü OneAce'in gerçekten topladığı
//     alanlarla eşleşir (ad, e-posta, organizasyon, rol, oturum
//     log'ları, envanter faaliyetleri). QuickBooks / Shopify gibi
//     entegrasyonlar yoluyla alınan verilerin de o hizmetlerin
//     sorumluluğunda tutulduğu, OneAce'in yalnızca aktarıcı
//     konumunda olduğu açıklanır.
//   - KVKK 11. madde haklarının tamamı sayfada listelenir ve iletişim
//     kanalı (e-posta) verilir.
//
// Görsel: marketing/legal altındaki diğer iki sayfa (privacy, terms)
// ile aynı "prose" katmanını paylaşır. Dil seviyesi: düz, avukat-
// yardımsız okunabilir; fakat hukuki sıkılık bakımından Avukat
// imzasıyla son halini alacak.

export const metadata = {
  title: "KVKK Aydınlatma Metni — OneAce",
  description:
    "OneAce'in Türkiye'deki kullanıcıları için Kişisel Verileri Koruma Kanunu (6698) kapsamında hazırlanmış aydınlatma metni.",
};

export default function KvkkPage() {
  const LAST_UPDATED = "2026-04-23";

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-base leading-relaxed">
      <div className="mb-8 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
        <strong>Taslak.</strong> Bu metin canlı bir hukuki belge
        değildir. Avukat incelemesi ve şirket tüzel kişilik bilgileri
        eklenmeden paid launch yapılmayacaktır.
      </div>

      <h1 className="text-3xl font-bold tracking-tight">
        KVKK Aydınlatma Metni
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Son güncelleme: {LAST_UPDATED}
      </p>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">1. Veri sorumlusu</h2>
        <p>
          OneAce hizmetini sunan ticari tüzel kişilik, 6698 sayılı
          Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında
          <em> veri sorumlusu</em> sıfatıyla hareket eder. Tüzel
          kişilik unvanı, Mersis numarası ve VERBIS sicil bilgileri
          ticari kuruluşun tamamlanmasının ardından bu bölüme
          eklenecektir. İletişim için: <a href="mailto:kvkk@oneace.app" className="underline">kvkk@oneace.app</a>.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">2. İşlenen kişisel veri kategorileri</h2>
        <p>OneAce'i kullanırken aşağıdaki kişisel veri kategorileri işlenebilir:</p>
        <ul className="ml-6 list-disc space-y-2">
          <li>
            <strong>Kimlik bilgileri.</strong> Ad, soyad — üyelik
            sırasında verilen.
          </li>
          <li>
            <strong>İletişim bilgileri.</strong> E-posta adresi.
            Hesap doğrulama, parola sıfırlama ve ürün bildirimleri
            için kullanılır.
          </li>
          <li>
            <strong>Organizasyon bilgileri.</strong> Davet edildiğiniz
            veya kurduğunuz organizasyonun adı, rolünüz, ekip
            üyelikleri.
          </li>
          <li>
            <strong>Oturum ve güvenlik log'ları.</strong> Giriş zamanı,
            IP adresi, tarayıcı-ajan bilgisi, iki faktörlü doğrulama
            (2FA) etkinlik kayıtları. Bu veriler yalnızca hesap
            güvenliği ve kötüye kullanım tespiti amacıyla tutulur.
          </li>
          <li>
            <strong>Envanter operasyon verisi.</strong> Sayım, transfer,
            satın alma-satış siparişi gibi işlem kayıtları. Bu veriler
            organizasyonunuza aittir; OneAce bunları yalnızca
            hizmetin çalışması için işler.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">3. İşleme amaçları</h2>
        <ul className="ml-6 list-disc space-y-2">
          <li>Hesap oluşturma, kimlik doğrulama ve erişim kontrolü.</li>
          <li>
            Hizmet sunumu — envanter yönetim özelliklerinin
            çalıştırılması.
          </li>
          <li>
            Güvenlik — saldırı tespiti, hız sınırlaması, 2FA,
            olay yanıtı.
          </li>
          <li>
            Yasal yükümlülüklerin yerine getirilmesi — talep halinde
            yetkili mercilere bilgi sağlanması.
          </li>
          <li>
            Faturalama — Stripe aracılığıyla abonelik yönetimi
            (Stripe kendi aydınlatma metnine tabidir).
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">4. Aktarım</h2>
        <p>
          Kişisel verileriniz yalnızca hizmetin işlemesi için gerekli
          üçüncü taraf hizmet sağlayıcılara aktarılabilir: barındırma
          (Netlify / Vercel), veritabanı (Neon, AB bölgesi), e-posta
          gönderimi (Resend), faturalama (Stripe), hata izleme
          (Sentry), opsiyonel ürün analitiği (PostHog). Bu
          sağlayıcıların her biri kendi gizlilik politikasına tabidir
          ve OneAce, makul düzeyde standart sözleşmeleri olan
          sağlayıcıları seçer.
        </p>
        <p>
          QuickBooks, Shopify ve benzeri entegrasyonlar
          <em> kullanıcı inisiyatifiyle</em> bağlanır. Bu
          entegrasyonlar üzerinden alınan verilerin sorumluluğu ilgili
          hizmetin kendisindedir; OneAce sadece senkronizasyon
          kanalıdır.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">5. Saklama süresi</h2>
        <p>
          Hesap silme talebinden sonra kişisel verileriniz cascade
          kuralı ile silinir (OneAce'in ürün kodunda
          <code className="mx-1 rounded bg-muted px-1 text-xs">onDelete: Cascade</code>
          FK'leri); log kayıtları 30 günü aşmamak üzere kısa vadede
          tutulur. Yasal saklama yükümlülüğü bulunan kayıtlar (ör.
          fatura verisi) ilgili mevzuat süresince saklanır.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">6. KVKK 11. madde hakları</h2>
        <p>Veri sahibi olarak sahip olduğunuz haklar:</p>
        <ul className="ml-6 list-disc space-y-2">
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme.</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme.</li>
          <li>İşleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme.</li>
          <li>
            Yurt içinde veya yurt dışında kişisel verilerinizin
            aktarıldığı üçüncü tarafları bilme.
          </li>
          <li>
            Eksik veya yanlış işlenmişse düzeltilmesini isteme.
          </li>
          <li>KVKK'da öngörülen şartlar çerçevesinde silinmesini / yok edilmesini isteme.</li>
          <li>
            Yapılan işlemlerin, aktarıldığı üçüncü kişilere
            bildirilmesini isteme.
          </li>
          <li>
            Otomatik sistemler vasıtasıyla analiz edilmesi sonucunda
            aleyhinize bir sonuç çıkmasına itiraz etme.
          </li>
          <li>
            Kanuna aykırı işlenmesi sebebiyle zarara uğramanız halinde
            zararın giderilmesini talep etme.
          </li>
        </ul>
        <p>
          Haklarınızı kullanmak için{" "}
          <a href="mailto:kvkk@oneace.app" className="underline">
            kvkk@oneace.app
          </a>{" "}
          adresine yazılı başvurunuzu iletebilirsiniz. 30 gün içinde
          ücretsiz olarak dönüş yapılacaktır.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">7. Çerezler</h2>
        <p>
          OneAce yalnızca zorunlu çerezleri kullanır: oturum çerezi
          (<code className="rounded bg-muted px-1 text-xs">oneace-session</code>),
          dil tercihi (<code className="rounded bg-muted px-1 text-xs">oneace-locale</code>),
          bölge tercihi (<code className="rounded bg-muted px-1 text-xs">oneace-region</code>).
          Pazarlama veya üçüncü taraf izleme çerezi kullanılmaz.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">8. Değişiklikler</h2>
        <p>
          Bu metinde yapılan değişiklikler sürüm tarihi güncellenerek
          bu sayfada yayınlanır. Büyük değişiklikler ek olarak
          e-posta veya uygulama içi bildirim ile iletilir.
        </p>
      </section>
    </main>
  );
}
