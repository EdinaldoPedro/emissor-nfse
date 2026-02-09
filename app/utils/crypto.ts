import crypto from 'crypto';

// IMPORTANTE: Adicione ENCRYPTION_KEY no seu .env com exatamente 32 caracteres
// Ex: ENCRYPTION_KEY=12345678901234567890123456789012
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // Fallback só pra dev
const IV_LENGTH = 16;

export function encrypt(text: string | null): string | null {
  if (!text) return null;
  
  try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
      let encrypted = cipher.update(text);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (e) {
      console.error("Erro ao criptografar:", e);
      return text; // Em caso de erro grave, não perde o dado (mas não protege)
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
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
      let decrypted = decipher.update(encryptedText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString();
  } catch (error) {
      // Se a chave mudou ou o dado corrompeu, retorna o original para tentar salvar o dia
      return text;
  }
}