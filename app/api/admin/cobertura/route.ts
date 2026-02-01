import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Busca com Filtros e Paginação
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const page = parseInt(searchParams.get('page') || '0');
  const limit = parseInt(searchParams.get('limit') || '0');
  
  // Captura Filtros
  const search = searchParams.get('search') || '';
  const regime = searchParams.get('regime') || '';
  const uf = searchParams.get('uf') || '';
  const status = searchParams.get('status');

  try {
    // Monta cláusula WHERE dinâmica
    const where: any = {};
    
    if (search) {
        where.nome = { contains: search }; // SQLite é case-insensitive por padrão para strings simples, ou use mode: 'insensitive' se for Postgres
    }
    if (regime) where.regime = regime;
    if (uf) where.uf = uf;
    if (status && status !== '') where.status = parseInt(status);

    if (page > 0 && limit > 0) {
        // MODO ADMIN (Paginado + Filtrado)
        const skip = (page - 1) * limit;
        const [lista, total] = await prisma.$transaction([
            prisma.municipioHomologado.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ uf: 'asc' }, { nome: 'asc' }]
            }),
            prisma.municipioHomologado.count({ where })
        ]);

        return NextResponse.json({
            data: lista,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } else {
        // MODO LANDING PAGE (Sem paginação, apenas lista ativa ou tudo)
        const lista = await prisma.municipioHomologado.findMany({
            where,
            orderBy: [{ uf: 'asc' }, { nome: 'asc' }]
        });
        return NextResponse.json(lista);
    }

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao buscar cidades.' }, { status: 500 });
  }
}

// POST: Criar
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { uf, nome, status, regime } = body;

    const novo = await prisma.municipioHomologado.create({
        data: { 
            uf: uf.toUpperCase(), 
            nome, 
            status: parseInt(status), 
            regime 
        }
    });

    return NextResponse.json(novo, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar.' }, { status: 500 });
  }
}

// PUT: Atualizar (Novo!)
export async function PUT(request: Request) {
    try {
      const body = await request.json();
      const { id, uf, nome, status, regime } = body;
  
      if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 });
  
      const atualizado = await prisma.municipioHomologado.update({
          where: { id },
          data: { 
              uf: uf.toUpperCase(), 
              nome, 
              status: parseInt(status), 
              regime 
          }
      });
  
      return NextResponse.json(atualizado, { status: 200 });
    } catch (error) {
      return NextResponse.json({ error: 'Erro ao atualizar.' }, { status: 500 });
    }
  }

// DELETE: Remover
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if(!id) return NextResponse.json({error: 'ID necessario'}, {status:400});

    await prisma.municipioHomologado.delete({ where: { id }});
    return NextResponse.json({ success: true });
}