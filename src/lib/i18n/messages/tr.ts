/**
 * Türkçe (tr-TR) sözlüğü — P1-07 ilk iterasyon.
 *
 * GOD MODE roadmap 2026-04-23 P1-07 — turns the i18n scaffold from
 * "English-only, scaffolded-locale-honest" into "actual Turkish
 * surface for the high-traffic chrome". This file:
 *
 *   1. Re-exports the full English dictionary via a shallow + per-
 *      surface deep spread, so every string key defined in `en` is
 *      present here with a valid value. The locale-parity test
 *      (src/lib/i18n/locale-parity.test.ts) only checks that a
 *      matching file exists, but keeping the key set honest at the
 *      module level means TypeScript catches any drift when
 *      `Messages` is inferred.
 *
 *   2. Overrides the four most-visible surfaces with real Turkish
 *      copy:
 *        - `app.*`        — product name + tagline + description.
 *        - `common.*`     — universal CTAs + statuses.
 *        - `permissions.roles.*` + `permissions.roleDescriptions.*`
 *                         — ekip yönetimi ekranlarındaki roller.
 *        - A handful of `nav`/`auth`/`header` strings.
 *
 * Everything NOT overridden below falls through to English. That is
 * deliberate: shipping a half-translated surface with honest English
 * fallback is strictly better than shipping an enthusiastic
 * machine-translation that a TR user will laugh at. Subsequent rc's
 * widen the coverage surface-by-surface after a native review pass.
 *
 * Review bar: every string added here needs a native Turkish
 * proofread before claiming "Türkçe destekleniyor" in marketing.
 */

import { type Messages, en } from "./en";

export const tr: Messages = {
  ...en,

  app: {
    ...en.app,
    name: "OneAce",
    tagline: "Büyüyen işletmeler için envanter yönetimi",
    description:
      "Sortly'nin sadeliği, inFlow'un gücü. Çevrimdışı stok sayımı, hızlı barkod okuma ve çok depolu transferler tek uygulamada.",
  },

  common: {
    ...en.common,
    loading: "Yükleniyor…",
    save: "Kaydet",
    saveChanges: "Değişiklikleri kaydet",
    cancel: "Vazgeç",
    delete: "Sil",
    edit: "Düzenle",
    create: "Oluştur",
    search: "Ara",
    submit: "Gönder",
    back: "Geri",
    next: "İleri",
    remove: "Kaldır",
    organization: "Organizasyon",
    none: "Yok",
    optional: "İsteğe bağlı",
    required: "Zorunlu",
    unknown: "Bilinmiyor",
    active: "Etkin",
    archived: "Arşivlenmiş",
    draft: "Taslak",
    yes: "Evet",
    no: "Hayır",
    confirm: "Onayla",
    confirmDelete: "Bu işlem geri alınamaz. Emin misiniz?",
    exportCsv: "CSV olarak dışa aktar",
    exportExcel: "Excel olarak dışa aktar",
    downloadPdf: "PDF indir",
    exportPdf: "PDF olarak dışa aktar",
    rateLimited: "Çok hızlı işlem yapıyorsunuz. Biraz bekleyip tekrar deneyin.",
    loadMore: "Daha fazla yükle",
    validationFailed: "Doğrulama başarısız",
    operationFailed: "İşlem başarısız",
    notFound: "Bulunamadı",
  },

  permissions: {
    ...en.permissions,
    forbidden: "Bunu yapmaya yetkiniz yok.",
    readOnly: "Bu organizasyonda yalnızca okuma erişiminiz var.",
    roles: {
      ...en.permissions.roles,
      OWNER: "Sahip",
      ADMIN: "Yönetici",
      MANAGER: "Operatör",
      MEMBER: "Operatör",
      VIEWER: "İzleyici",
      APPROVER: "Onaylayıcı",
      COUNTER: "Sayım Operatörü",
    },
    roleDescriptions: {
      ...en.permissions.roleDescriptions,
      OWNER: "Organizasyon üzerinde tam kontrol — silme ve sahiplik devri dahil.",
      ADMIN: "Ekip, lokasyon ve operasyonel yapılandırmayı yönetir.",
      MEMBER:
        "Günlük envanter operasyonları: ürünler, hareketler, sayımlar ve satın alma siparişleri.",
      VIEWER: "Yalnızca okuma erişimi. Oluşturma, düzenleme veya silme yapılamaz.",
      APPROVER: "Stok sayımlarını ve envanter düzeltmelerini onaylar.",
      COUNTER: "Stok sayımı ve envanter sayımlarını yapar.",
    },
  },

  notifications: {
    ...en.notifications,
    heading: "Bildirimler",
    empty: "Her şey güncel.",
    markRead: "Okundu işaretle",
    markAllRead: "Tümünü okundu işaretle",
    dismiss: "Kapat",
    dismissAlert: "Uyarıyı kapat",
    viewAll: "Tümünü gör",
  },
};
