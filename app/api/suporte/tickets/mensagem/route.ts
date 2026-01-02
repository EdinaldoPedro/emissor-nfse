import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  try {
    const { ticketId, mensagem, interno } = await request.json();

    const novaMsg = await prisma.ticketMensagem.create({
        data: {
            ticketId,
            usuarioId: userId,
            mensagem,
            interno: interno || false
        }
    });

    // Atualiza data do ticket para subir na lista
    await prisma.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() }
    });

    return NextResponse.json(novaMsg);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao enviar' }, { status: 500 });
  }
}