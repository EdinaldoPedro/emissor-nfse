import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorized();

    try {
        const isStaff = ['ADMIN', 'MASTER', 'SUPORTE', 'SUPORTE_TI', 'CONTADOR'].includes(user.role);
        
        // Se for staff, vê tudo (ou filtrado por atendente no futuro). Se cliente, só os dele.
        const whereClause = isStaff ? {} : { solicitanteId: user.id };
        
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
    } catch (e: any) { 
        return NextResponse.json({ error: 'Erro ao buscar tickets' }, { status: 500 }); 
    }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { assuntoId, tituloManual, descricao, anexoBase64, anexoNome, prioridade, checkDuplicity, vendaIdReferencia } = body; 

    // Verificação de Duplicidade
    if (checkDuplicity && vendaIdReferencia) {
        const duplicado = await prisma.ticket.findFirst({
            where: {
                solicitanteId: user.id,
                assunto: { contains: vendaIdReferencia.split('-')[0] }, 
                status: { notIn: ['RESOLVIDO', 'FECHADO'] }
            }
        });

        if (duplicado) {
            return NextResponse.json({ 
                warning: 'DUPLICATE_FOUND', 
                message: `Já existe o ticket #${duplicado.protocolo} aberto para esta venda.`,
                ticketId: duplicado.id
            }, { status: 409 });
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
        solicitanteId: user.id,
        anexoBase64: anexoBase64 || null,
        anexoNome: anexoNome || null
      }
    });

    await prisma.ticketMensagem.create({
        data: {
            ticketId: ticket.id,
            usuarioId: user.id,
            mensagem: descricao || 'Abertura de chamado'
        }
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro interno: ' + e.message }, { status: 500 });
  }
}