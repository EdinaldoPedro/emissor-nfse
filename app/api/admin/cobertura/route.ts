import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Público (Para a Landing Page e Admin)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Se não vier parametros (Landing Page), traz tudo. Se vier (Admin), pagina.
  const page = parseInt(searchParams.get('page') || '0');
  const limit = parseInt(searchParams.get('limit') || '0');

  try {
    if (page > 0 && limit > 0) {
        // MODO ADMIN (Paginado)
        const skip = (page - 1) * limit;
        const [lista, total] = await prisma.$transaction([
            prisma.municipioHomologado.findMany({
                skip,
                take: limit,
                orderBy: [{ uf: 'asc' }, { nome: 'asc' }]
            }),
            prisma.municipioHomologado.count()
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
        // MODO LANDING PAGE (Tudo de uma vez para filtrar no front)
        const lista = await prisma.municipioHomologado.findMany({
            orderBy: [{ uf: 'asc' }, { nome: 'asc' }]
        });
        return NextResponse.json(lista);
    }

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar cidades.' }, { status: 500 });
  }
}

// POST: Criar/Editar (Apenas Admin)
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
    return NextResponse.json({ error: 'Erro ao salvar.' }, { status: 500 });
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