import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function DELETE(request: Request) {
  try {
    // 1. Verificação de Segurança (NOVO)
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorized();
    
    // Apenas MASTER ou ADMIN podem limpar o banco
    if (!['MASTER', 'ADMIN'].includes(user.role)) {
        return forbidden();
    }

    // 2. Execução
    await prisma.cnae.deleteMany({});
    await prisma.tributacaoMunicipal.deleteMany({});
    await prisma.municipioHomologado.deleteMany({});
    await prisma.globalCnae.deleteMany({});

    return NextResponse.json({ success: true, message: 'Banco de dados limpo com sucesso (Tabelas de Apoio).' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}