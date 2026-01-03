import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Buscar Detalhes e MARCAR COMO LIDO
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    // Precisamos saber quem está lendo para limpar a notificação
    const userId = request.headers.get('x-user-id'); 

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        solicitante: { select: { id: true, nome: true, email: true, empresa: { select: { razaoSocial: true, documento: true } } } },
        atendente: { select: { nome: true, id: true } },
        catalogItem: true,
        mensagens: {
            include: { usuario: { select: { nome: true, role: true } } },
            orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });

    // LÓGICA DE LIMPEZA DE NOTIFICAÇÃO
    // Se o usuário logado é o dono do ticket e ele estava "não lido", marca como lido agora.
    if (userId && ticket.solicitanteId === userId && ticket.clientUnread) {
        await prisma.ticket.update({
            where: { id },
            data: { clientUnread: false } // Apaga o balão
        });
        ticket.clientUnread = false; // Atualiza retorno local
    }
    
    return NextResponse.json(ticket);

  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao buscar detalhes.' }, { status: 500 });
  }
}

// PUT: Atualizar Status (NOTIFICA CLIENTE)
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
      const body = await request.json();
      const { id } = params;

      const dataUpdate: any = { 
          ...body, 
          updatedAt: new Date() 
      };

      // Se mudou o status, ACENDE O BALÃO para o cliente ver que algo aconteceu
      if (body.status) {
          dataUpdate.clientUnread = true;
      }

      const updated = await prisma.ticket.update({
          where: { id },
          data: dataUpdate
      });
      return NextResponse.json(updated);
  } catch (e: any) {
      return NextResponse.json({ error: 'Erro ao atualizar ticket' }, { status: 500 });
  }
}