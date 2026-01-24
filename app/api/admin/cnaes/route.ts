import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Lista paginada e com busca
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';

  const skip = (page - 1) * limit;

  const whereClause = search ? {
    OR: [
      { codigo: { contains: search } },
      { descricao: { contains: search } } 
    ]
  } : {};

  try {
    const [cnaes, total] = await prisma.$transaction([
      prisma.globalCnae.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        orderBy: { codigo: 'asc' }
      }),
      prisma.globalCnae.count({ where: whereClause })
    ]);

    return NextResponse.json({
      data: cnaes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar dados.' }, { status: 500 });
  }
}

// PUT: Atualiza dados tributários
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    // ATUALIZADO: Agora recebemos os novos campos
    const { id, itemLc, codigoTributacaoNacional, codigoNbs, temRetencaoInss } = body;

    const atualizado = await prisma.globalCnae.update({
      where: { id },
      data: {
        itemLc,
        codigoTributacaoNacional,
        codigoNbs,           // Novo
        temRetencaoInss      // Novo
      }
    });

    return NextResponse.json(atualizado);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}