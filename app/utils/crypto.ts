import crypto from 'crypto';

const ENCRYPTION_KEY: Buffer = (() => {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('FATAL: ENCRYPTION_KEY não definida no ambiente.');
  }
  if (Buffer.byteLength(rawKey, 'utf8') !== 32) {
    throw new Error('FATAL: ENCRYPTION_KEY deve ter exatamente 32 bytes.');
  }
  return Buffer.from(rawKey, 'utf8');
})();

const IV_LENGTH = 16;

export function encrypt(text: string | null): string | null {
  if (!text) return null;
  
  try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
      let encrypted = cipher.update(text);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (e) {
      console.error("Erro ao criptografar:", e);
      return null;
  }
}

export function decrypt(text: string | null): string | null {
  if (!text) return null;
  
  const textParts = text.split(':');
  
  // Se não tiver o formato iv:conteudo, assume que é dado legado (não criptografado) e retorna direto
  if (textParts.length !== 2) return text; 

  try {
      const iv = Buffer.from(textParts[0], 'hex');
      const encryptedText = Buffer.from(textParts[1], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
  } catch (error) {
      return null;
  }
}