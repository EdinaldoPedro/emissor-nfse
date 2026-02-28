import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateRequest } from '@/app/utils/api-security';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  // 1. Usa a validação padrão de segurança do sistema
  const { targetId, errorResponse } = await validateRequest(request);
  if (errorResponse) return errorResponse;

  const contextId = request.headers.get('x-empresa-id');

  try {
    const venda = await prisma.venda.findUnique({
      where: { id: params.id },
      include: { 
          cliente: true,
          notas: true,
          logs: {
              where: { action: 'DPS_GERADA' },
              orderBy: { createdAt: 'desc' },
              take: 1
          }
      }
    });

    if (!venda) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });

    // 2. Validação de Acesso Flexível (Admin, Dono ou Contador)
    const user = await prisma.user.findUnique({ where: { id: targetId }});
    const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user?.role || '');

    let hasAccess = false;
    if (isStaff) {
        hasAccess = true;
    } else if (contextId && venda.empresaId === contextId) {
        // Se for contador acessando a empresa do cliente
        const vinculo = await prisma.contadorVinculo.findUnique({
            where: { contadorId_empresaId: { contadorId: targetId, empresaId: contextId } }
        });
        if (vinculo && vinculo.status === 'APROVADO') hasAccess = true;
    } else if (venda.empresaId === user?.empresaId) {
        // Se for o próprio dono da empresa
        hasAccess = true;
    }

    if (!hasAccess) {
        return NextResponse.json({ error: 'Não autorizado a ver esta venda.' }, { status: 403 });
    }

    // --- LÓGICA DE RECUPERAÇÃO DE DADOS ---
    let cnaeRecuperado = null;
    
    // 1. Tenta pegar da Nota Fiscal (se existir)
    if (venda.notas.length > 0 && venda.notas[0].cnae) {
        cnaeRecuperado = venda.notas[0].cnae;
    } 
    // 2. Se falhou antes de criar nota, tenta pegar do LOG
    else if (venda.logs.length > 0 && venda.logs[0].details) {
        try {
            let details = venda.logs[0].details;
            if (typeof details === 'string') {
                try { 
                    const parsed = JSON.parse(details); 
                    details = (typeof parsed === 'string') ? JSON.parse(parsed) : parsed;
                } catch(e) {}
            }
            // @ts-ignore
            cnaeRecuperado = details?.servico?.codigoCnae || null;
        } catch (e) { console.error("Erro parse log", e); }
    }

    return NextResponse.json({ ...venda, cnaeRecuperado });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar venda' }, { status: 500 });
  }
}