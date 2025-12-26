import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 1. Busca empresas que TÊM certificado OU JÁ emitiram notas
    // Isso filtra empresas "fantasmas" ou inativas
    const emissores = await prisma.empresa.findMany({
      where: {
        OR: [
            { certificadoA1: { not: null } }, 
            { notasEmitidas: { some: {} } }
        ]
      },
      include: {
        _count: {
          select: { notasEmitidas: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // 2. Para cada emissor, conta quantos logs de ERRO teve nas últimas 24h
    // Usamos Promise.all para fazer isso rápido em paralelo
    const dataComErros = await Promise.all(emissores.map(async (emp) => {
        const erros = await prisma.systemLog.count({
            where: {
                empresaId: emp.id,
                level: 'ERRO',
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Filtro de 24h
            }
        });
        return { ...emp, errosRecentes: erros };
    }));

    return NextResponse.json(dataComErros);

  } catch (error) {
    console.error("Erro ao listar emissores:", error);
    return NextResponse.json({ error: 'Erro interno ao listar.' }, { status: 500 });
  }
}