import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Listar catálogo
export async function GET() {
  try {
    const itens = await prisma.ticketCatalog.findMany({
        orderBy: { titulo: 'asc' }
    });
    return NextResponse.json(itens);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar catálogo' }, { status: 500 });
  }
}

// POST: Criar item
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const novo = await prisma.ticketCatalog.create({
        data: {
            titulo: body.titulo,
            prioridade: body.prioridade,
            instrucoes: body.instrucoes,
            ativo: true
        }
    });
    return NextResponse.json(novo);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao criar' }, { status: 500 });
  }
}

// PUT: Atualizar item
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const atualizado = await prisma.ticketCatalog.update({
        where: { id: body.id },
        data: {
            titulo: body.titulo,
            prioridade: body.prioridade,
            instrucoes: body.instrucoes,
            ativo: body.ativo
        }
    });
    return NextResponse.json(atualizado);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

// DELETE: Remover item
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if(!id) return NextResponse.json({error: 'ID necessário'}, {status: 400});

    await prisma.ticketCatalog.delete({ where: { id } });
    return NextResponse.json({success: true});
}