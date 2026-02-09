import { SignJWT, jwtVerify } from 'jose';

// Garante que o segredo venha do ambiente em produção
const secretKey = process.env.JWT_SECRET;
if (!secretKey && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET não definido no ambiente.');
}

const secret = new TextEncoder().encode(secretKey || 'dev_secret_fallback_do_not_use_in_prod');

export async function signJWT(payload: { sub: string; role: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    return null;
  }
}