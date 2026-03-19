import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    const admin = await getAuthenticatedUser(request);
    if (!admin || !['MASTER', 'ADMIN'].includes(admin.role)) return forbidden();

    try {
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

        // 1. Clientes Ativos Totais (Pagas e Trial)
        const totalClientes = await prisma.user.count({
            where: { role: { notIn: ['MASTER', 'ADMIN', 'SUPORTE'] } }
        });

        // 2. Históricos de Planos Ativos (Para calcular o MRR)
        const planosAtivos = await prisma.planHistory.findMany({
            where: { status: 'ATIVO' },
            include: { plan: true, user: true }
        });

        let mrrTotal = 0;
        let clientesPagantes = 0;
        let clientesTrial = 0;

        planosAtivos.forEach(hist => {
            // Ignora a equipa interna
            if (['MASTER', 'ADMIN', 'SUPORTE'].includes(hist.user.role)) return;

            // O Prisma retorna 'Decimal', então convertemos para Number do JavaScript
            const valorMensal = Number(hist.plan.priceMonthly || 0);

            if (hist.plan.slug === 'TRIAL' || valorMensal === 0) {
                clientesTrial++;
            } else {
                clientesPagantes++;
                mrrTotal += valorMensal;
            }
        });

        const arrTotal = mrrTotal * 12; // Receita Anual Recorrente

        // 3. Novos Clientes (Últimos 30 dias)
        const novosClientes = await prisma.user.count({
            where: {
                role: { notIn: ['MASTER', 'ADMIN', 'SUPORTE'] },
                createdAt: { gte: trintaDiasAtras }
            }
        });

        // 4. Churn (Cancelamentos nos últimos 30 dias)
        const cancelamentos = await prisma.planHistory.count({
            where: {
                status: { in: ['CANCELADO', 'CANCELADO_ADM'] },
                dataFim: { gte: trintaDiasAtras } // <--- Substituído updatedAt por dataFim
            }
        });

        return NextResponse.json({
            mrrTotal,
            arrTotal,
            totalClientes,
            clientesPagantes,
            clientesTrial,
            novosClientes30d: novosClientes,
            cancelamentos30d: cancelamentos,
            // Cálculo básico de Taxa de Churn (Cancelamentos / (Pagantes + Cancelamentos) * 100)
            churnRate: clientesPagantes > 0 ? ((cancelamentos / (clientesPagantes + cancelamentos)) * 100).toFixed(1) : 0
        });

    } catch (error) {
        console.error("Erro ao calcular métricas do CRM:", error);
        return NextResponse.json({ error: 'Erro ao calcular métricas' }, { status: 500 });
    }
}