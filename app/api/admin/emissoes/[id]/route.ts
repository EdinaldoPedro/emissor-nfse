import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const empresa = await prisma.empresa.findUnique({ where: { id } });
    if (!empresa) return NextResponse.json({ error: '404' }, { status: 404 });

    // Busca Logs GERAIS (sem venda ou todos)
    const logs = await prisma.systemLog.findMany({
        where: { empresaId: id },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    // Busca VENDAS (que contêm as notas e os logs específicos)
    const vendas = await prisma.venda.findMany({
        where: { empresaId: id },
        include: { 
            cliente: { select: { razaoSocial: true, documento: true } }, // Nome do cliente
            notas: true,  // Notas geradas
            logs: { orderBy: { createdAt: 'desc' } }  // Logs dessa venda específica
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    return NextResponse.json({ empresa, logs, vendas });

  } catch (error) {
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}