// pdf-lib StandardFont (WinAnsi) Türkçe ı/İ/ş/ğ gibi karakterleri kodlayamaz.
// PDF'e yazmadan önce güvenli (ASCII) hale getir. (Unicode font gömme: ileride.)
const MAP: Record<string, string> = {
  ş: 's', Ş: 'S', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I',
  ç: 'c', Ç: 'C', ö: 'o', Ö: 'O', ü: 'u', Ü: 'U',
  '²': '2', '•': '-', '–': '-', '—': '-', '₺': 'TL', '“': '"', '”': '"', '’': "'",
};

export function pdfSafe(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/[şŞğĞıİçÇöÖüÜ²•–—₺“”’]/g, (c) => MAP[c] ?? c)
    .replace(/[^\x20-\x7E]/g, '?'); // kalan ASCII-dışı → ?
}
