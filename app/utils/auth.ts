import { SignJWT, jwtVerify } from 'jose';

// Em produção, use uma variável de ambiente forte: process.env.JWT_SECRET
const secret = new TextEncoder().encode(process.env.JWT_SECRET || '9c2f4a6d8e0b1f3a7d5c9e2b6a4f8d0c1e7a5b3f9d2c6e8a4b0');

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