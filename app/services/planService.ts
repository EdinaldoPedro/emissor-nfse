import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function checkPlanLimits(userId: string) {
    // 1. Busca o plano ATIVO mais recente no histórico
    const historico = await prisma.planHistory.findFirst({
        where: { userId, status: 'ATIVO' },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
    });

    if (!historico) {
        return { allowed: false, reason: 'Nenhum plano ativo encontrado.' };
    }

    // 2. Verifica Validade (Data)
    if (historico.dataFim && new Date() > historico.dataFim) {
        // Atualiza para EXPIRADO
        await prisma.planHistory.update({ 
            where: { id: historico.id }, 
            data: { status: 'EXPIRADO' } 
        });
        return { allowed: false, reason: 'Seu período de teste expirou. Assine um plano para continuar.' };
    }

    // 3. Verifica Quantidade de Notas (Se houver limite)
    if (historico.plan.maxNotasMensal > 0) {
        if (historico.notasEmitidas >= historico.plan.maxNotasMensal) {
            return { allowed: false, reason: `Você atingiu o limite de ${historico.plan.maxNotasMensal} notas do seu plano.` };
        }
    }

    return { allowed: true, historyId: historico.id };
}

export async function incrementUsage(historyId: string) {
    await prisma.planHistory.update({
        where: { id: historyId },
        data: { notasEmitidas: { increment: 1 } }
    });
}