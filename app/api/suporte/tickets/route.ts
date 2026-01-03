import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Listar Tickets
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    // Verifica se é Staff (Admin/Suporte) ou Cliente
    const isStaff = ['ADMIN', 'MASTER', 'SUPORTE', 'SUPORTE_TI', 'CONTADOR'].includes(user?.role || '');
    
    // Se for Staff, vê todos. Se for cliente, vê só os dele.
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
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao buscar tickets' }, { status: 500 });
  }
}

// POST: Criar Novo Ticket (ESSA FUNÇÃO É OBRIGATÓRIA AQUI)
export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { assuntoId, descricao, anexoBase64, anexoNome } = body; 

    // 1. Validação simples
    if (!assuntoId) {
        return NextResponse.json({ error: "Assunto é obrigatório." }, { status: 400 });
    }

    // 2. Busca os detalhes do assunto no catálogo
    const itemCatalogo = await prisma.ticketCatalog.findUnique({
        where: { id: assuntoId }
    });

    if (!itemCatalogo) {
        return NextResponse.json({ error: "Assunto inválido (não encontrado no catálogo)." }, { status: 400 });
    }

    // 3. Cria o ticket usando dados do catálogo
    const ticket = await prisma.ticket.create({
      data: {
        assunto: itemCatalogo.titulo,       // Usa o título oficial do catálogo
        catalogId: itemCatalogo.id,         // Link para o catálogo
        prioridade: itemCatalogo.prioridade,// Prioridade automática
        categoria: 'Suporte',
        descricao: descricao || 'Sem descrição',
        status: 'ABERTO',
        solicitanteId: userId,
        anexoBase64: anexoBase64 || null,
        anexoNome: anexoNome || null
      }
    });

    // 4. Cria a primeira mensagem (corpo do ticket)
    await prisma.ticketMensagem.create({
        data: {
            ticketId: ticket.id,
            usuarioId: userId,
            mensagem: descricao || 'Abertura de chamado'
        }
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (e: any) {
    console.error("Erro ao criar ticket:", e);
    return NextResponse.json({ error: 'Erro interno ao criar ticket: ' + e.message }, { status: 500 });
  }
}