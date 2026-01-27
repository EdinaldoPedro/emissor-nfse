import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    // 1. Verificação de Segurança (NOVO)
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorized();

    // Apenas Gestores
    if (!['MASTER', 'ADMIN'].includes(user.role)) return forbidden();

    // 2. Coleta de Dados (Mantido)
    const totalClientes = await prisma.user.count({ 
        where: { role: { notIn: ['MASTER', 'ADMIN', 'SUPORTE'] } } 
    });
    
    const empresasAtivas = await prisma.empresa.count({
        where: { cadastroCompleto: true }
    });

    const notasEmitidas = await prisma.notaFiscal.count({
        where: { status: 'AUTORIZADA' }
    });

    const faturamentoEstimado = await prisma.planHistory.count({
        where: { status: 'ATIVO', plan: { priceMonthly: { gt: 0 } } }
    });

    return NextResponse.json({
        clientes: totalClientes,
        empresas: empresasAtivas,
        notas: notasEmitidas,
        assinaturasAtivas: faturamentoEstimado
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao carregar estatísticas.' }, { status: 500 });
  }
}