import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Busca empresas que TÊM atividade (Certificado, Notas OU Logs de Erro)
    const emissores = await prisma.empresa.findMany({
      where: {
        OR: [
            { certificadoA1: { not: null } }, 
            { notasEmitidas: { some: {} } },
            { logs: { some: {} } } 
        ]
      },
      include: {
        _count: {
          select: { notasEmitidas: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Conta erros das últimas 24h
    const dataComErros = await Promise.all(emissores.map(async (emp) => {
        const erros = await prisma.systemLog.count({
            where: {
                empresaId: emp.id,
                level: 'ERRO',
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
        });
        return { ...emp, errosRecentes: erros };
    }));

    return NextResponse.json(dataComErros);

  } catch (error) {
    return NextResponse.json({ error: 'Erro interno ao listar.' }, { status: 500 });
  }
}