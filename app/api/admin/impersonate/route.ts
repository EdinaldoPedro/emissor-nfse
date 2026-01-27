import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    // 1. Verificação de Segurança (NOVO)
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorized();

    // Apenas Staff pode acessar
    const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role);
    if (!isStaff) return forbidden();

    const { targetUserId } = await request.json();

    if (!targetUserId) {
      return NextResponse.json({ error: 'ID do usuário alvo não fornecido.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { empresa: true }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário alvo não encontrado.' }, { status: 404 });
    }

    // Retorna os dados da sessão "falsa" para o frontend usar
    return NextResponse.json({
      success: true,
      fakeSession: {
        id: targetUser.id,
        nome: targetUser.nome,
        email: targetUser.email,
        role: targetUser.role,
        empresaId: targetUser.empresaId
      }
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro interno ao tentar acessar conta.' }, { status: 500 });
  }
}