import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyJWT } from './auth';

const prisma = new PrismaClient();

export interface AuthenticatedUser {
  id: string;
  role: string;
  empresaId: string | null;
}

export async function getAuthenticatedUser(request: Request): Promise<AuthenticatedUser | null> {
  // 1. Busca o token no Header Authorization
  const authHeader = request.headers.get('Authorization');
  
  // Fallback temporário para não quebrar seu front antigo (remove isso depois de atualizar o front)
  const legacyId = request.headers.get('x-user-id');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Se não tem token, mas tem o ID legado, fazemos uma checagem "fraca" (melhor que nada, mas inseguro)
      // O ideal é remover esse bloco else if no futuro.
      if (legacyId) {
          const user = await prisma.user.findUnique({ where: { id: legacyId } });
          return user ? { id: user.id, role: user.role, empresaId: user.empresaId } : null;
      }
      return null;
  }

  const token = authHeader.split(' ')[1];

  // 2. Valida a assinatura do Token
  const payload = await verifyJWT(token);
  if (!payload || !payload.sub) return null;

  // 3. (Item 4) Consulta o banco para garantir que o usuário ainda existe e pegar dados frescos
  const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: { id: true, role: true, empresaId: true } // Seleciona apenas o necessário
  });

  return user as AuthenticatedUser;
}

export function unauthorized() {
    return NextResponse.json({ error: 'Acesso não autorizado. Faça login novamente.' }, { status: 401 });
}

export function forbidden() {
    return NextResponse.json({ error: 'Sem permissão para esta ação.' }, { status: 403 });
}