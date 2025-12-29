import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Lista paginada de TODAS as empresas
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';

  const skip = (page - 1) * limit;

  // Filtro de busca (Razão Social ou CNPJ)
  const whereClause = search ? {
    OR: [
      { razaoSocial: { contains: search, mode: 'insensitive' } }, // mode: insensitive (se usar Postgres)
      { documento: { contains: search } }
    ]
  } : {};

  try {
    // Transação para buscar dados + contagem total
    const [empresas, total] = await prisma.$transaction([
      prisma.empresa.findMany({
        where: whereClause, // <--- Aplica o filtro
        skip: skip,
        take: limit,
        include: { 
            donos: { 
                select: { nome: true, email: true },
                take: 1 
            } 
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.empresa.count({ where: whereClause })
    ]);

    return NextResponse.json({
      data: empresas,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    // console.error(error); // Bom para debug
    return NextResponse.json({ error: 'Erro ao buscar empresas' }, { status: 500 });
  }
}

// PUT: Atualiza cadastro (Mantido igual, serve para correção)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    // Removemos campos que não devem ser salvos diretamente na tabela empresa via edição simples
    const { id, donos, ...dadosParaAtualizar } = body;

    const updated = await prisma.empresa.update({
      where: { id: id },
      data: dadosParaAtualizar
    });
    
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao atualizar empresa.' }, { status: 500 });
  }
}