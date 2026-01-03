import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET (Mantido igual)
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = ['ADMIN', 'MASTER', 'SUPORTE', 'SUPORTE_TI'].includes(user?.role || '');
    const whereClause = isAdmin ? {} : { solicitanteId: userId };

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

// POST: Criar Ticket COM ANEXO
export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { assuntoId, descricao, anexoBase64, anexoNome } = body; 

    // Busca dados do catálogo para pegar o título e a prioridade
    const itemCatalogo = await prisma.ticketCatalog.findUnique({
        where: { id: assuntoId }
    });

    if (!itemCatalogo) throw new Error("Assunto inválido.");

    const ticket = await prisma.ticket.create({
      data: {
        assunto: itemCatalogo.titulo, // Usa o título oficial
        catalogId: itemCatalogo.id,   // Vincula ao catálogo
        prioridade: itemCatalogo.prioridade, // Define prioridade auto
        categoria: 'Suporte', // Simplificado
        descricao,
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
            mensagem: descricao
        }
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao criar ticket' }, { status: 500 });
  }
}