import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Busca os dados atuais
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id'); // Pega o ID do cabeçalho

  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  return NextResponse.json(user);
}

// PUT: Atualiza os dados
export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();

    const atualizado = await prisma.user.update({
      where: { id: userId },
      data: {
        documento: body.documento,
        razaoSocial: body.razaoSocial,
        nomeFantasia: body.nomeFantasia
      }
    });

    return NextResponse.json(atualizado);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}