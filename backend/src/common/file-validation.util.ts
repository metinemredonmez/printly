// Dosya tür doğrulama: uzantı↔MIME tutarlılığı + magic-byte imza tespiti.
// Yüklemeler presigned (sunucu byte'ları görmez); initiate'te beyan edilen MIME
// uzantıyla çapraz doğrulanır, mark-ready'de (R2'den ilk byte'lar) gerçek içerik kontrol edilebilir.

export const EXT_MIME: Record<string, string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  tif: ['image/tiff'],
  tiff: ['image/tiff'],
  ai: ['application/postscript', 'application/illustrator', 'application/pdf'],
  eps: ['application/postscript', 'application/eps', 'image/eps'],
};

// Beyan edilen MIME uzantıyla uyumlu mu? (MIME yoksa uzantıya güvenilir)
export function mimeMatchesExt(ext: string, mime?: string | null): boolean {
  if (!mime) return true;
  const allowed = EXT_MIME[ext];
  if (!allowed) return true; // bilinmeyen uzantı zaten ext-whitelist'te elenir
  return allowed.includes(mime.toLowerCase());
}

// Magic-byte imzaları (ilk byte'lar)
const SIGNATURES: { mime: string; bytes: number[] }[] = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] }, // \x89PNG
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] }, // JPEG
  { mime: 'image/tiff', bytes: [0x49, 0x49, 0x2a, 0x00] }, // TIFF little-endian (II*)
  { mime: 'image/tiff', bytes: [0x4d, 0x4d, 0x00, 0x2a] }, // TIFF big-endian (MM)
];

// İlk byte'lardan gerçek MIME'ı tespit eder (tanınmazsa null)
export function detectMime(head: Buffer | Uint8Array): string | null {
  for (const sig of SIGNATURES) {
    if (head.length < sig.bytes.length) continue;
    if (sig.bytes.every((b, i) => head[i] === b)) return sig.mime;
  }
  return null;
}
