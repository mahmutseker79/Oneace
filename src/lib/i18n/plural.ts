// Sprint 9 PR #3 — EN plural fix-up helper
// (UX/UI audit Apr-25 §B-plural follow-up).
//
// Sprint 8 PR #2 in app/ ve src/ ağacında inline EN plural fork pattern'lerini
// (`count === 1 ? "" : "s"`) yakalayan bir guard test yazdı. 7 sayfa hit verdi.
// Bu helper TR-uyumlu, EN-correct çıktı üretir:
//
//   - Locale "en"  : `${count} ${plural ?? singular + "s"}`
//   - Locale "tr"  : `${count} ${singular}`  (TR plural agreement gerektirmez)
//
// Inline fork yerine çağrı:
//
//   pluralizeEn(items.length, "item")               -> "12 items" / "1 item"
//   pluralizeEn(boxes.length, "box", "boxes")       -> "3 boxes" / "1 box"
//   pluralizeEn(rows.length, "category", "categories")
//
// Locale-aware versiyon i18n hook'tan alınmış locale ile:
//
//   const tCount = useFormatCount();
//   tCount(items.length, "item")                    -> "12 ürün" (TR) / "12 items" (EN)
//
// Sprint 10 hedefi: app/ ağacında inline plural fork sıfır → no-en-plural-template
// guard hard fail moduna alınır.

export type SupportedLocale = "en" | "tr";

/** Plain-EN: count + singular/plural form. TR-uyumlu değil — locale-aware
 * versiyon için `formatCount` kullan. */
export function pluralizeEn(count: number, singular: string, plural?: string): string {
  if (count === 1) return `${count} ${singular}`;
  return `${count} ${plural ?? `${singular}s`}`;
}

/** Sadece kelime — sayı yok. "item" / "items" döner. */
export function pluralWordEn(count: number, singular: string, plural?: string): string {
  if (count === 1) return singular;
  return plural ?? `${singular}s`;
}

/** Locale-aware. TR'de tekil form, EN'de plural agreement uygulanır. */
export function formatCount(
  locale: SupportedLocale,
  count: number,
  options: {
    /** EN tekil form, örn. "item". */
    singular: string;
    /** EN plural form, default `singular + "s"`. */
    plural?: string;
    /** TR karşılığı. Default: EN singular kullanılır (en azından İngilizce kalır). */
    tr?: string;
  },
): string {
  if (locale === "tr") {
    return `${count} ${options.tr ?? options.singular}`;
  }
  return pluralizeEn(count, options.singular, options.plural);
}
