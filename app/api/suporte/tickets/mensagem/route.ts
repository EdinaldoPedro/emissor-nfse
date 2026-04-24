import { NextResponse } from 'next/server';
import { forbidden, getAuthenticatedUser, unauthorized } from '@/app/utils/api-middleware';
import { isSupportTicketRole } from '@/app/utils/access-control';
import { prisma } from '@/app/utils/prisma';

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  try {
    const { ticketId, mensagem, interno, anexoBase64, anexoNome } = await request.json();

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, solicitanteId: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket nÃ£o encontrado.' }, { status: 404 });
    }

    const isStaff = isSupportTicketRole(user.role);

    if (!isStaff && ticket.solicitanteId !== user.id) {
      return forbidden();
    }

    if (interno && !isStaff) {
      return forbidden();
    }

    const novaMsg = await prisma.ticketMensagem.create({
      data: {
        ticketId: ticket.id,
        usuarioId: user.id,
        mensagem: mensagem || (anexoBase64 ? 'Enviou um anexo.' : ''),
        interno: interno || false,
        anexoBase64: anexoBase64 || null,
        anexoNome: anexoNome || null,
      },
    });

    const updateData: any = { updatedAt: new Date() };
    if (isStaff && !interno) updateData.clientUnread = true;

    await prisma.ticket.update({ where: { id: ticket.id }, data: updateData });

    return NextResponse.json(novaMsg);
  } catch {
    return NextResponse.json({ error: 'Erro ao enviar' }, { status: 500 });
  }
}
