import { NextResponse } from 'next/server';
import { verifyJWT } from '@/app/utils/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getAuthenticatedUser(request: Request) {
  // 1. Busca o cabeçalho de autorização
  const authHeader = request.headers.get('Authorization');

  // 2. Se não tiver token, já retorna nulo (Bloqueia acesso)
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  // 3. Valida o Token
  const token = authHeader.split(' ')[1];
  try {
    const payload = await verifyJWT(token);
    
    // 4. Busca o usuário no banco para garantir que ele ainda existe/está ativo
    if (payload && payload.sub) {
        const user = await prisma.user.findUnique({
            where: { id: payload.sub }
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