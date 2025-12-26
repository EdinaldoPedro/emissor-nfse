import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get('empresaId');

  const where = empresaId ? { empresaId } : {};

  const logs = await prisma.systemLog.findMany({
    where,
    include: { empresa: { select: { razaoSocial: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100 // Últimos 100 eventos
  });

  return NextResponse.json(logs);
}