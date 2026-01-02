import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Listar Tickets
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    // Verifica permissão
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = ['ADMIN', 'MASTER', 'SUPORTE'].includes(user?.role || '');

    // Se for admin vê tudo, se não, vê só os seus
    const whereClause = isAdmin ? {} : { solicitanteId: userId };

    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      include: {
        solicitante: { select: { nome: true, email: true } },
        atendente: { select: { nome: true } },
        _count: { 
            select: { mensagens: true } // <--- AQUI ESTAVA O ERRO (mensages -> mensagens)
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json(tickets);
  } catch (e: any) {
    console.error("Erro ao listar tickets:", e); // Isso vai mostrar o erro real no seu terminal
    return NextResponse.json({ error: 'Erro ao buscar tickets: ' + e.message }, { status: 500 });
  }
}

// POST: Criar Ticket (Mantido igual, mas garantindo robustez)
export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { assunto, categoria, descricao, prioridade } = body;

    const ticket = await prisma.ticket.create({
      data: {
        assunto,
        categoria,
        prioridade: prioridade || 'MEDIA',
        descricao,
        status: 'ABERTO', // Status inicial padrão
        solicitanteId: userId
      }
    });

    // Cria a primeira mensagem (descrição)
    if (descricao) {
        await prisma.ticketMensagem.create({
            data: {
                ticketId: ticket.id,
                usuarioId: userId,
                mensagem: descricao
            }
        });
    }

    return NextResponse.json(ticket, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Erro ao criar ticket' }, { status: 500 });
  }
}