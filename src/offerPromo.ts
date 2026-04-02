import { clipString, OFFER_DISCOUNT_DEAL_TEXT_MAX, OFFER_DISCOUNT_MAX } from "./offerLimits";

export type PromoKind = "percent" | "price_pair" | "deal_text";

/** Só dígitos para % (1–100). */
export function clipPercentDigits(input: string): string {
  return input.replace(/\D/g, "").slice(0, 3);
}

/** Só dígitos para valores em reais inteiros (evita texto misturado). */
export function clipPriceReaisDigits(input: string): string {
  return input.replace(/\D/g, "").slice(0, 8);
}

function formatBRLReais(reais: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(reais);
}

/**
 * Exibição: legado só com número (ex.: "30") vira "30%"; demais textos mantidos.
 */
export function formatDiscountForDisplay(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  if (/^\d{1,3}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n >= 1 && n <= 100) return `${n}%`;
  }
  return s;
}

export type PromoInput = {
  percentDigits?: string;
  priceFrom?: string;
  priceTo?: string;
  dealText?: string;
};

/**
 * Monta o texto gravado em `offer.discount` (cupom + vitrine).
 * Retorna null se faltar dado válido.
 */
export function buildDiscountFromPromo(kind: PromoKind, input: PromoInput): string | null {
  if (kind === "percent") {
    const d = clipPercentDigits(input.percentDigits ?? "");
    if (!d) return null;
    const n = parseInt(d, 10);
    if (n < 1 || n > 100) return null;
    const out = `${n}%`;
    return clipString(out, OFFER_DISCOUNT_MAX);
  }
  if (kind === "price_pair") {
    const a = parseInt(clipPriceReaisDigits(input.priceFrom ?? ""), 10);
    const b = parseInt(clipPriceReaisDigits(input.priceTo ?? ""), 10);
    if (!Number.isFinite(a) || a <= 0) return null;
    if (!Number.isFinite(b) || b < 0) return null;
    const out = `De ${formatBRLReais(a)} por ${formatBRLReais(b)}`;
    return clipString(out, OFFER_DISCOUNT_MAX);
  }
  const t = (input.dealText ?? "").trim();
  if (!t) return null;
  return clipString(t, OFFER_DISCOUNT_DEAL_TEXT_MAX);
}
