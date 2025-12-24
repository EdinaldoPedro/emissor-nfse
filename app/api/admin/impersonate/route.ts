import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { targetUserId } = await request.json();
    
    // 1. Busca o usuário alvo
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // 2. Retorna os dados necessários para o Frontend "fingir" ser ele
    // Nota: Em um sistema com JWT, aqui você geraria um token novo.
    // Como estamos usando localStorage, vamos retornar os IDs.
    return NextResponse.json({
      success: true,
      fakeSession: {
        id: targetUser.id,
        nome: targetUser.nome,
        role: targetUser.role,
        // Adicionamos uma flag para o front saber que é modo suporte (opcional visual)
        isImpersonating: true 
      }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao gerar acesso.' }, { status: 500 });
  }
}