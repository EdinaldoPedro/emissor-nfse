import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

// GET: Detalhes
export async function GET(request: Request, { params }: { params: { id: string } }) {
  // SEGURANÇA
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
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

    // Regra de Acesso: Só o dono ou Staff pode ver
    const isStaff = ['ADMIN', 'MASTER', 'SUPORTE', 'SUPORTE_TI', 'CONTADOR'].includes(user.role);
    if (!isStaff && ticket.solicitanteId !== user.id) return forbidden();

    // Limpa notificação se for o dono
    if (ticket.solicitanteId === user.id && ticket.clientUnread) {
        await prisma.ticket.update({ where: { id: params.id }, data: { clientUnread: false } });
        ticket.clientUnread = false;
    }
    
    return NextResponse.json(ticket);
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// PUT: Atualizar
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  
  // Apenas Staff pode editar status/atendente
  if (!['ADMIN', 'MASTER', 'SUPORTE', 'SUPORTE_TI'].includes(user.role)) return forbidden();

  try {
      const body = await request.json();
      const dataUpdate: any = { ...body, updatedAt: new Date() };
      if (body.status) dataUpdate.clientUnread = true;

      const updated = await prisma.ticket.update({ where: { id: params.id }, data: dataUpdate });
      return NextResponse.json(updated);
  } catch (e) {
      return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}