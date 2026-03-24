import { NextResponse } from 'next/server';
import { verifyJWT } from '@/app/utils/auth';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function getAuthenticatedUser(request: Request) {
  // 1. Busca o token no Cookie HttpOnly
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token')?.value;

  // 2. Se não tiver token, já retorna nulo (Bloqueia acesso)
  if (!token) {
    return null;
  }

  // 3. Valida o Token
  try {
    const payload = await verifyJWT(token);
    
    // 4. Busca o usuário no banco para garantir que ele ainda existe/está ativo
    if (payload && payload.sub) {
        // Garantir que payload.sub é tratado como string
        const userId = typeof payload.sub === 'string' ? payload.sub : String(payload.sub);
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        return user; // Retorna o usuário autenticado de verdade
    }
    return null;

  } catch (error) {
    return null;
  }
}

// Helpers de resposta (Mantenha-os no final do arquivo)
export function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: 'Acesso proibido' }, { status: 403 });
}