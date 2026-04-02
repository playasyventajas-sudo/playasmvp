/**
 * Limites de texto para ofertas e nome do estabelecimento.
 * Referência: títulos curtos em marketplaces (ex. Google Merchant ~150 no máximo;
 * Groupon/peixe urbano usam manchetes compactas); descrição curta ~400–800 caracteres
 * para não poluir cards; nome do comércio visível no card.
 */
export const OFFER_TITLE_MAX = 60;
export const OFFER_DESCRIPTION_MAX = 500;
/** Teto ao gravar `discount` (% formatado, “De R$ … por …”, texto livre truncado antes). */
export const OFFER_DISCOUNT_MAX = 80;
/** Modo “outros” / texto livre (ex.: dose dupla de chopp). */
export const OFFER_DISCOUNT_DEAL_TEXT_MAX = 25;
export const COMPANY_NAME_MAX = 80;

/** Recorta por pontos de código (emoji/conta como um caractere). */
export function clipString(s: string, max: number): string {
  if (!s || max <= 0) return "";
  const arr = [...s];
  if (arr.length <= max) return s;
  return arr.slice(0, max).join("");
}
