import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Acesso negado' }, { status: 401 });

  try {
    const venda = await prisma.venda.findUnique({
      where: { id: params.id },
      include: { 
          cliente: true,
          notas: true,
          // ADICIONADO: Busca logs para recuperar dados perdidos em caso de erro
          logs: {
              where: { action: 'DPS_GERADA' },
              orderBy: { createdAt: 'desc' },
              take: 1
          }
      }
    });

    if (!venda) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { empresa: true }});
    if (venda.empresaId !== user?.empresa?.id) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
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
            // Tratamento para JSON salvo como string dupla
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