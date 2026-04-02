/** Permite apenas URLs http(s) para uso em <img src> — reduz risco de esquemas inesperados. */
export function safeImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    return url.trim();
  } catch {
    return '';
  }
}
