import { SignJWT, jwtVerify } from 'jose';

// Em produção, use uma variável de ambiente forte: process.env.JWT_SECRET
const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'segredo-padrao-trocar-no-env-urgente');

export async function signJWT(payload: { sub: string; role: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h') // Token expira em 8 horas
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