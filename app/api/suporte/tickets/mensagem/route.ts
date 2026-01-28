import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  try {
    const { ticketId, mensagem, interno, anexoBase64, anexoNome } = await request.json();

    const isStaff = ['ADMIN', 'MASTER', 'SUPORTE', 'SUPORTE_TI', 'CONTADOR'].includes(user.role);

    // Salva msg
    const novaMsg = await prisma.ticketMensagem.create({
        data: {
            ticketId,
            usuarioId: user.id,
            mensagem: mensagem || (anexoBase64 ? 'Enviou um anexo.' : ''),
            interno: interno || false,
            anexoBase64: anexoBase64 || null,
            anexoNome: anexoNome || null
        }
    });

    const updateData: any = { updatedAt: new Date() };
    if (isStaff && !interno) updateData.clientUnread = true; 

    await prisma.ticket.update({ where: { id: ticketId }, data: updateData });

    return NextResponse.json(novaMsg);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao enviar' }, { status: 500 });
  }
}