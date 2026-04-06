import type { Offer } from "../types";
import type { Language } from "./translations";
import { clipString, OFFER_DESCRIPTION_MAX, OFFER_DISCOUNT_MAX, OFFER_TITLE_MAX } from "./offerLimits";

/** Título da oferta conforme idioma da UI (fallback: PT). */
export function offerTitle(offer: Offer, lang: Language): string {
  if (lang === "en" && offer.titleEn?.trim()) return offer.titleEn.trim();
  if (lang === "es" && offer.titleEs?.trim()) return offer.titleEs.trim();
  return offer.title;
}

/** Descrição conforme idioma (fallback: PT). */
export function offerDescription(offer: Offer, lang: Language): string {
  if (lang === "en" && offer.descriptionEn?.trim()) return offer.descriptionEn.trim();
  if (lang === "es" && offer.descriptionEs?.trim()) return offer.descriptionEs.trim();
  return offer.description;
}

/** Texto de desconto/promoção conforme idioma (fallback: PT). */
export function offerDiscount(offer: Offer, lang: Language): string {
  if (lang === "en" && offer.discountEn?.trim()) return offer.discountEn.trim();
  if (lang === "es" && offer.discountEs?.trim()) return offer.discountEs.trim();
  return offer.discount;
}

/** Campos i18n recortados para gravar no Firestore. */
export function clipOfferI18nFields(o: Partial<Offer>): Pick<
  Offer,
  "titleEn" | "titleEs" | "descriptionEn" | "descriptionEs" | "discountEn" | "discountEs"
> {
  const s = (v: unknown, max: number) =>
    v != null && String(v).trim() ? clipString(String(v).trim(), max) : "";
  return {
    titleEn: s(o.titleEn, OFFER_TITLE_MAX),
    titleEs: s(o.titleEs, OFFER_TITLE_MAX),
    descriptionEn: s(o.descriptionEn, OFFER_DESCRIPTION_MAX),
    descriptionEs: s(o.descriptionEs, OFFER_DESCRIPTION_MAX),
    discountEn: s(o.discountEn, OFFER_DISCOUNT_MAX),
    discountEs: s(o.discountEs, OFFER_DISCOUNT_MAX)
  };
}
