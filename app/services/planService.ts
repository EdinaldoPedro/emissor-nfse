import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function checkPlanLimits(userId: string) {
    // 0. Verifica se é ADMIN/STAFF (Acesso total)
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
    });

    if (user && ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role)) {
        return { allowed: true, historyId: 'ADMIN_BYPASS' }; // Bypass total
    }

    // 1. Busca o histórico ATIVO mais recente (Lógica normal de cliente)
    const historico = await prisma.planHistory.findFirst({
        where: { userId, status: 'ATIVO' },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
    });

    if (!historico) {
        return { allowed: false, reason: 'Nenhum plano ativo. Por favor, assine um plano.' };
    }

    // 2. Verifica Validade de Data
    if (historico.dataFim && new Date() > historico.dataFim) {
        await prisma.planHistory.update({ 
            where: { id: historico.id }, 
            data: { status: 'EXPIRADO' } 
        });
        await prisma.user.update({
            where: { id: userId },
            data: { planoStatus: 'expired' }
        });
        return { allowed: false, reason: 'Seu plano expirou. Renove sua assinatura.' };
    }

    // 3. Verifica Limite de Emissões
    if (historico.plan.maxNotasMensal > 0) {
        if (historico.notasEmitidas >= historico.plan.maxNotasMensal) {
            return { 
                allowed: false, 
                reason: `Você atingiu o limite de ${historico.plan.maxNotasMensal} emissões do seu plano atual.` 
            };
        }
    }

    return { allowed: true, historyId: historico.id };
}

// Incrementa o contador (Só incrementa se não for Admin)
export async function incrementUsage(historyId: string) {
    if (historyId === 'ADMIN_BYPASS') return;

    await prisma.planHistory.update({
        where: { id: historyId },
        data: { notasEmitidas: { increment: 1 } }
    });
}