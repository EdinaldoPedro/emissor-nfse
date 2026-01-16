import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET (Mantido igual)
export async function GET(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const isStaff = ['ADMIN', 'MASTER', 'SUPORTE', 'SUPORTE_TI', 'CONTADOR'].includes(user?.role || '');
        const whereClause = isStaff ? {} : { solicitanteId: userId };
        const tickets = await prisma.ticket.findMany({
            where: whereClause,
            include: {
                solicitante: { select: { nome: true, email: true } },
                atendente: { select: { nome: true } },
                _count: { select: { mensagens: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });
        return NextResponse.json(tickets);
    } catch (e: any) { return NextResponse.json({ error: 'Erro ao buscar tickets' }, { status: 500 }); }
}

// POST: Criar Novo Ticket (COM VERIFICAÇÃO)
export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { assuntoId, tituloManual, descricao, anexoBase64, anexoNome, prioridade, checkDuplicity, vendaIdReferencia } = body; 

    // === VERIFICAÇÃO DE DUPLICIDADE (NOVA LÓGICA) ===
    if (checkDuplicity && vendaIdReferencia) {
        // Procura tickets abertos que contenham o ID da venda no título
        const duplicado = await prisma.ticket.findFirst({
            where: {
                solicitanteId: userId,
                assunto: { contains: vendaIdReferencia.split('-')[0] }, // Busca pelo ID curto
                status: { notIn: ['RESOLVIDO', 'FECHADO'] } // Apenas abertos
            }
        });

        if (duplicado) {
            return NextResponse.json({ 
                warning: 'DUPLICATE_FOUND', 
                message: `Já existe o ticket #${duplicado.protocolo} aberto para esta venda.`,
                ticketId: duplicado.id
            }, { status: 409 }); // 409 Conflict
        }
    }

    let tituloFinal = '';
    let prioridadeFinal = 'MEDIA';
    let catalogId = null;

    if (assuntoId === 'AUTO_ERROR_REPORT') {
        tituloFinal = tituloManual || 'Erro reportado pelo sistema';
        prioridadeFinal = prioridade || 'ALTA';
    } else if (assuntoId) {
        const itemCatalogo = await prisma.ticketCatalog.findUnique({ where: { id: assuntoId } });
        if (!itemCatalogo) return NextResponse.json({ error: "Assunto inválido." }, { status: 400 });
        tituloFinal = itemCatalogo.titulo;
        prioridadeFinal = itemCatalogo.prioridade;
        catalogId = itemCatalogo.id;
    } else {
        return NextResponse.json({ error: "Assunto é obrigatório." }, { status: 400 });
    }

    const ticket = await prisma.ticket.create({
      data: {
        assunto: tituloFinal,
        catalogId: catalogId,
        prioridade: prioridadeFinal,
        categoria: 'Suporte Técnico',
        descricao: descricao || 'Sem descrição',
        status: 'ABERTO',
        solicitanteId: userId,
        anexoBase64: anexoBase64 || null,
        anexoNome: anexoNome || null
      }
    });

    await prisma.ticketMensagem.create({
        data: {
            ticketId: ticket.id,
            usuarioId: userId,
            mensagem: descricao || 'Abertura de chamado'
        }
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro interno: ' + e.message }, { status: 500 });
  }
}