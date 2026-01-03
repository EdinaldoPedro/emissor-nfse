import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ count: 0 });

  try {
    const count = await prisma.ticket.count({
      where: {
        solicitanteId: userId,
        clientUnread: true // Conta apenas os não lidos pelo cliente
      }
    });

    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json({ count: 0 });
  }
}