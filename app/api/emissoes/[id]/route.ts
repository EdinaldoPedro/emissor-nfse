import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const empresa = await prisma.empresa.findUnique({
      where: { id },
    });

    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

    // Busca Logs (Últimos 100)
    const logs = await prisma.systemLog.findMany({
        where: { empresaId: id },
        orderBy: { createdAt: 'desc' },
        take: 100
    });

    // Busca Notas (Últimas 50)
    const notas = await prisma.notaFiscal.findMany({
        where: { empresaId: id },
        include: { cliente: true }, // Inclui nome do tomador
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    return NextResponse.json({ empresa, logs, notas });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao carregar detalhes' }, { status: 500 });
  }
}