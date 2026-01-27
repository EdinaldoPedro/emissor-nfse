import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const userId = params.id;

    // 1. Busca o Usuário para pegar o email (chave de busca nos logs)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

    // 2. Busca o Histórico de Planos Oficial
    const historico = await prisma.planHistory.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Busca Logs de Alteração Manual (Com busca insensível a maiúsculas/minúsculas)
    const logs = await prisma.systemLog.findMany({
      where: {
        action: 'MANUAL_PLAN_CHANGE',
        message: { contains: user.email, mode: 'insensitive' } // <--- Correção importante
      },
      orderBy: { createdAt: 'desc' }
    });

    // 4. Se não tiver histórico oficial (Usuário antigo/legado), monta um baseado no perfil atual
    if (historico.length === 0) {
        return NextResponse.json([{
            id: 'legacy',
            plano: user.plano || 'GRATUITO',
            status: user.planoStatus === 'active' ? 'ATIVO' : 'INATIVO',
            dataInicio: user.createdAt,
            dataFim: user.planoExpiresAt,
            origem: 'SISTEMA',
            justificativa: 'Cadastro inicial / Legado (Sem histórico detalhado)',
            adminNome: ''
        }]);
    }

    // 5. Cruza os dados para montar a resposta detalhada
    const historyWithDetails = await Promise.all(historico.map(async (item) => {
        // Tenta encontrar um log criado no intervalo de 1 minuto do histórico
        const logCorrespondente = logs.find(l => {
            const timeDiff = Math.abs(new Date(l.createdAt).getTime() - new Date(item.createdAt).getTime());
            return timeDiff < 60000; // Aumentei para 60s para garantir
        });

        let origem = 'SISTEMA';
        let justificativa = 'Contratação/Renovação Automática';
        let adminNome = '';

        if (logCorrespondente) {
            origem = 'MANUAL_ADMIN';
            try {
                const details = typeof logCorrespondente.details === 'string' 
                    ? JSON.parse(logCorrespondente.details) 
                    : logCorrespondente.details;
                
                justificativa = details.justification || logCorrespondente.message;
                
                // Busca nome do admin se tiver ID
                if (details.adminId) {
                    const admin = await prisma.user.findUnique({ where: { id: details.adminId } });
                    adminNome = admin?.nome || 'Admin';
                }
            } catch (e) {
                justificativa = logCorrespondente.message;
            }
        } else if (item.plan.slug === 'TRIAL') {
            justificativa = 'Período de Teste Grátis (Cadastro)';
        }

        return {
            id: item.id,
            plano: item.plan.name,
            status: item.status,
            dataInicio: item.dataInicio,
            dataFim: item.dataFim,
            origem,
            justificativa,
            adminNome
        };
    }));

    return NextResponse.json(historyWithDetails);

  } catch (error) {
    console.error("Erro History:", error);
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 });
  }
}