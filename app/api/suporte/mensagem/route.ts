import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  try {
    const { ticketId, mensagem, interno, anexoBase64, anexoNome } = await request.json();

    const novaMsg = await prisma.ticketMensagem.create({
        data: {
            ticketId,
            usuarioId: userId,
            mensagem: mensagem || (anexoBase64 ? 'Enviou um anexo.' : ''), // Texto opcional se tiver anexo
            interno: interno || false,
            anexoBase64: anexoBase64 || null,
            anexoNome: anexoNome || null
        }
    });

    await prisma.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() }
    });

    return NextResponse.json(novaMsg);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Erro ao enviar' }, { status: 500 });
  }
}