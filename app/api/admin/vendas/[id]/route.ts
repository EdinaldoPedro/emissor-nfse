import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const venda = await prisma.venda.findUnique({
      where: { id: params.id },
      include: {
        empresa: true, // Prestador
        cliente: true, // Tomador
        notas: true,   // Se gerou nota
        logs: {        // Histórico completo
            orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!venda) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });

    // Tenta encontrar o JSON do DPS nos logs (geralmente salvo na ação 'DPS_GERADA')
    const logDps = venda.logs.find(l => l.action === 'DPS_GERADA');
    const payloadJson = logDps ? logDps.details : null;

    return NextResponse.json({ ...venda, payloadJson });

  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}