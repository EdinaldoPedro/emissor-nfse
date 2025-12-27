import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const empresa = await prisma.empresa.findUnique({ where: { id } });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

    // Busca VENDAS (que contêm as notas e os logs daquela transação)
    const vendas = await prisma.venda.findMany({
        where: { empresaId: id },
        include: { 
            cliente: { select: { razaoSocial: true, documento: true } }, 
            notas: true,  
            logs: { orderBy: { createdAt: 'desc' } }  
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    return NextResponse.json({ empresa, vendas });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao buscar detalhes' }, { status: 500 });
  }
}