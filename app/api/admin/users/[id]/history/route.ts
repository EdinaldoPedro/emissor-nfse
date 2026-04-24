import { NextResponse } from 'next/server';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';
import { isSupportRole } from '@/app/utils/access-control';
import { prisma } from '@/app/utils/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const userAuth = await getAuthenticatedUser(request);
  if (!userAuth) return unauthorized();
  if (!isSupportRole(userAuth.role)) return forbidden();

  try {
    const userId = params.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'UsuÃ¡rio nÃ£o encontrado' }, { status: 404 });

    const historico = await prisma.planHistory.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const logs = await prisma.systemLog.findMany({
      where: {
        action: 'MANUAL_PLAN_CHANGE',
        message: { contains: user.email },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (historico.length === 0) {
      return NextResponse.json([
        {
          id: 'legacy',
          plano: user.plano || 'GRATUITO',
          status: user.planoStatus === 'active' ? 'ATIVO' : 'INATIVO',
          dataInicio: user.createdAt,
          dataFim: user.planoExpiresAt,
          origem: 'SISTEMA',
          justificativa: 'Cadastro inicial / Legado (Sem histÃ³rico detalhado)',
          adminNome: '',
        },
      ]);
    }

    const historyWithDetails = await Promise.all(
      historico.map(async (item) => {
        const logCorrespondente = logs.find((l) => {
          const timeDiff = Math.abs(new Date(l.createdAt).getTime() - new Date(item.createdAt).getTime());
          return timeDiff < 60000;
        });

        let origem = 'SISTEMA';
        let justificativa = 'ContrataÃ§Ã£o/RenovaÃ§Ã£o AutomÃ¡tica';
        let adminNome = '';

        if (logCorrespondente) {
          origem = 'MANUAL_ADMIN';
          try {
            const details =
              typeof logCorrespondente.details === 'string'
                ? JSON.parse(logCorrespondente.details)
                : logCorrespondente.details;

            justificativa = details?.justification || logCorrespondente.message;

            if (details?.adminId) {
              const admin = await prisma.user.findUnique({ where: { id: details.adminId } });
              adminNome = admin?.nome || 'Admin';
            }
          } catch {
            justificativa = logCorrespondente.message;
          }
        } else if (item.plan.slug === 'TRIAL') {
          justificativa = 'PerÃ­odo de Teste GrÃ¡tis (Cadastro)';
        }

        return {
          id: item.id,
          plano: item.plan.name,
          status: item.status,
          dataInicio: item.dataInicio,
          dataFim: item.dataFim,
          origem,
          justificativa,
          adminNome,
        };
      }),
    );

    return NextResponse.json(historyWithDetails);
  } catch (error) {
    console.error('Erro History:', error);
    return NextResponse.json({ error: 'Erro ao buscar histÃ³rico' }, { status: 500 });
  }
}
