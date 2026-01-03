import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  try {
    const { ticketId, mensagem, interno, anexoBase64, anexoNome } = await request.json();

    // 1. Identifica quem está mandando (Staff ou Cliente?)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isStaff = ['ADMIN', 'MASTER', 'SUPORTE', 'SUPORTE_TI', 'CONTADOR'].includes(user?.role || '');

    // 2. Salva a mensagem
    const novaMsg = await prisma.ticketMensagem.create({
        data: {
            ticketId,
            usuarioId: userId,
            mensagem: mensagem || (anexoBase64 ? 'Enviou um anexo.' : ''),
            interno: interno || false,
            anexoBase64: anexoBase64 || null,
            anexoNome: anexoNome || null
        }
    });

    // 3. Atualiza o Ticket e define a NOTIFICAÇÃO
    const updateData: any = { updatedAt: new Date() };
    
    // Se quem mandou foi Staff e NÃO é msg interna -> O cliente tem algo novo para ler
    if (isStaff && !interno) {
        updateData.clientUnread = true; 
    }

    await prisma.ticket.update({
        where: { id: ticketId },
        data: updateData
    });

    return NextResponse.json(novaMsg);
  } catch (e) {
    console.error("Erro ao enviar msg:", e);
    return NextResponse.json({ error: 'Erro ao enviar' }, { status: 500 });
  }
}