import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// At-rest şifreleme (AES-256-GCM). TOTP secret, ileride apiKey/PII için.
// Anahtar: ENCRYPTION_KEY (32 byte = 64 hex). Yoksa dev türetilmiş anahtar (UYARI).
function getKey(): Buffer {
  const k = process.env.ENCRYPTION_KEY;
  if (k && /^[0-9a-fA-F]{64}$/.test(k)) return Buffer.from(k, 'hex');
  // Dev fallback — prod'da ENCRYPTION_KEY zorunlu olmalı
  return scryptSync(k || 'dev-insecure-key', 'printy-salt', 32);
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const [ivh, tagh, ench] = payload.split(':');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivh, 'hex'));
  decipher.setAuthTag(Buffer.from(tagh, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ench, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
