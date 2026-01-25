import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function checkPlanLimits(userId: string) {
    // 0. Verifica se é ADMIN/STAFF (Acesso total)
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
    });

    if (user && ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role)) {
        return { allowed: true, historyId: 'ADMIN_BYPASS', status: 'ATIVO' };
    }

    // 1. Busca o histórico ATIVO mais recente
    const historico = await prisma.planHistory.findFirst({
        where: { userId, status: 'ATIVO' },
        include: { plan: true },
        orderBy: { createdAt: 'desc' }
    });

    // Se não tem plano ativo, verifica se tem um expirado recente para dar mensagem correta
    if (!historico) {
        const expirado = await prisma.planHistory.findFirst({
            where: { userId, status: 'EXPIRADO' },
            orderBy: { createdAt: 'desc' }
        });
        if (expirado) return { allowed: false, reason: 'Seu plano expirou. Renove para continuar usando.', status: 'EXPIRADO' };
        return { allowed: false, reason: 'Nenhum plano ativo. Assine um plano para começar.', status: 'INATIVO' };
    }

    // 2. Verifica Validade de Data (AUTO-EXPIRAÇÃO)
    // Se hoje for maior que a data fim, expira AGORA.
    if (historico.dataFim && new Date() > historico.dataFim) {
        console.log(`[PLAN] Plano do usuário ${userId} venceu em ${historico.dataFim}. Expirando...`);
        
        await prisma.planHistory.update({ 
            where: { id: historico.id }, 
            data: { status: 'EXPIRADO' } 
        });
        
        await prisma.user.update({
            where: { id: userId },
            data: { planoStatus: 'expired' }
        });

        return { allowed: false, reason: 'Seu plano acabou de expirar. Renove para continuar.', status: 'EXPIRADO' };
    }

    // 3. Verifica Limite de Emissões (Apenas se não for ilimitado)
    if (historico.plan.maxNotasMensal > 0) {
        if (historico.notasEmitidas >= historico.plan.maxNotasMensal) {
            return { 
                allowed: false, 
                reason: `Você atingiu o limite de ${historico.plan.maxNotasMensal} emissões do seu plano.`,
                status: 'LIMITE_ATINGIDO'
            };
        }
    }

    return { allowed: true, historyId: historico.id, status: 'ATIVO' };
}

export async function incrementUsage(historyId: string) {
    if (historyId === 'ADMIN_BYPASS') return;
    await prisma.planHistory.update({
        where: { id: historyId },
        data: { notasEmitidas: { increment: 1 } }
    });
}