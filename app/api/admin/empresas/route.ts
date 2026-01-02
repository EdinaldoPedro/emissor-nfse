import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';

  const skip = (page - 1) * limit;

  const whereClause = search ? {
    OR: [
      { razaoSocial: { contains: search, mode: 'insensitive' } }, 
      { documento: { contains: search } }
    ]
  } : {};

  try {
    const [empresas, total] = await prisma.$transaction([
      prisma.empresa.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        include: { 
            // VOLTA AO ORIGINAL (Singular)
            donoUser: { 
                select: { nome: true, email: true }
            } 
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.empresa.count({ where: whereClause })
    ]);

    // Pequeno ajuste para o frontend ler como lista (compatibilidade)
    const dadosFormatados = empresas.map(emp => ({
        ...emp,
        donos: emp.donoUser ? [emp.donoUser] : [] // Envia como array de 1 item pro front não quebrar
    }));

    return NextResponse.json({
      data: dadosFormatados,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar empresas' }, { status: 500 });
  }
}

// PUT (Mantém igual)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, donos, donoUser, ...dadosParaAtualizar } = body; // Remove campos de relação

    const updated = await prisma.empresa.update({
      where: { id: id },
      data: dadosParaAtualizar
    });
    
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao atualizar empresa.' }, { status: 500 });
  }
}