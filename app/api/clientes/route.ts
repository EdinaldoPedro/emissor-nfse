import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Buscar clientes do usuário
export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json([], { status: 200 });

    const clientes = await prisma.cliente.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(clientes);
  } catch (error) {
    return NextResponse.json({ error: "Erro ao buscar dados" }, { status: 500 });
  }
}

// POST: Criar novo cliente
export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json();

    if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

    const novo = await prisma.cliente.create({
      data: {
        nome: body.nome,
        email: body.email,
        documento: body.documento,
        cep: body.cep,
        logradouro: body.logradouro,
        numero: body.numero,
        bairro: body.bairro,
        cidade: body.cidade,
        uf: body.uf,
        codigoIbge: body.codigoIbge,
        userId: userId
      }
    });

    return NextResponse.json(novo, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao criar" }, { status: 500 });
  }
}

// PUT: Atualizar cliente existente
export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json();

    if (!userId || !body.id) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });

    const atualizado = await prisma.cliente.update({
      where: { id: body.id },
      data: {
        nome: body.nome,
        email: body.email,
        documento: body.documento,
        // Você pode adicionar os campos de endereço aqui se quiser permitir editar endereço
      }
    });

    return NextResponse.json(atualizado);
  } catch (error) {
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

// DELETE: Apagar cliente
export async function DELETE(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!userId || !id) return NextResponse.json({ error: 'ID necessário' }, { status: 400 });

    await prisma.cliente.delete({
      where: { id: id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao excluir" }, { status: 500 });
  }
}