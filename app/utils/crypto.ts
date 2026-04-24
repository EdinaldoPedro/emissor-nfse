import crypto from 'crypto';

const STATIC_LEGACY_KEY = '12345678901234567890123456789012';
const IV_LENGTH = 16;

function parseKey(rawKey: string | undefined, label: string) {
  if (!rawKey) {
    throw new Error(`FATAL: ${label} nÃ£o definida no ambiente.`);
  }
  if (Buffer.byteLength(rawKey, 'utf8') !== 32) {
    throw new Error(`FATAL: ${label} deve ter exatamente 32 bytes.`);
  }
  return Buffer.from(rawKey, 'utf8');
}

const ENCRYPTION_KEY = parseKey(process.env.ENCRYPTION_KEY, 'ENCRYPTION_KEY');

const LEGACY_KEYS: Buffer[] = [];

if (process.env.LEGACY_ENCRYPTION_KEY) {
  LEGACY_KEYS.push(parseKey(process.env.LEGACY_ENCRYPTION_KEY, 'LEGACY_ENCRYPTION_KEY'));
}

if (process.env.ALLOW_STATIC_LEGACY_KEY === 'true' || process.env.NODE_ENV !== 'production') {
  LEGACY_KEYS.push(Buffer.from(STATIC_LEGACY_KEY, 'utf8'));
}

export function encrypt(text: string | null): string | null {
  if (!text) return null;

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (e) {
    console.error('Erro ao criptografar:', e);
    return null;
  }
}

export function decrypt(text: string | null): string | null {
  if (!text) return null;

  const textParts = text.split(':');

  if (textParts.length !== 2) return text;

  const iv = Buffer.from(textParts[0], 'hex');
  const encryptedText = Buffer.from(textParts[1], 'hex');

  for (const key of [ENCRYPTION_KEY, ...LEGACY_KEYS]) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
    } catch {
      // tenta a prÃ³xima chave
    }
  }

  return null;
}
