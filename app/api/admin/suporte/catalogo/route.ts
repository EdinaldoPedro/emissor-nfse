import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Listar itens
export async function GET() {
  try {
    const itens = await prisma.ticketCatalog.findMany({
        orderBy: { titulo: 'asc' }
    });
    return NextResponse.json(itens);
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao buscar: ' + e.message }, { status: 500 });
  }
}

// POST: Criar novo item
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.titulo) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 });

    const novo = await prisma.ticketCatalog.create({
        data: {
            titulo: body.titulo,
            prioridade: body.prioridade || 'MEDIA',
            instrucoes: body.instrucoes,
            ativo: body.ativo !== undefined ? body.ativo : true
        }
    });
    return NextResponse.json(novo, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao criar: ' + e.message }, { status: 500 });
  }
}

// PUT: Atualizar
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
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

// DELETE: Remover
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if(!id) return NextResponse.json({error: 'ID necessário'}, {status: 400});

    try {
        await prisma.ticketCatalog.delete({ where: { id } });
        return NextResponse.json({success: true});
    } catch (e) {
        return NextResponse.json({ error: 'Item em uso.' }, { status: 500 });
    }
}