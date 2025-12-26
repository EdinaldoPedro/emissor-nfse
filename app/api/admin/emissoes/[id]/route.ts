import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Busca empresas que são candidatas a emissão (Tem certificado OU já emitiram nota)
    const emissores = await prisma.empresa.findMany({
      where: {
        OR: [
            { certificadoA1: { not: null } }, // Tem certificado
            { notasEmitidas: { some: {} } }   // Ou já emitiu alguma nota
        ]
      },
      include: {
        _count: {
          select: { notasEmitidas: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Calcula erros recentes de forma otimizada
    const dataComErros = await Promise.all(emissores.map(async (emp) => {
        const erros = await prisma.systemLog.count({
            where: {
                empresaId: emp.id,
                level: 'ERRO',
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24h
            }
        });
        return { ...emp, errosRecentes: erros };
    }));

    return NextResponse.json(dataComErros);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao listar emissores' }, { status: 500 });
  }
}