import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Usuário não identificado' }, { status: 401 });

    const body = await request.json();
    const { clienteId, valor, descricao } = body;

    if (!clienteId || !valor || !descricao) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Cria a nota no banco vinculada ao Prestador (User) e Tomador (Cliente)
    const novaNota = await prisma.notaFiscal.create({
      data: {
        valor: parseFloat(valor), // Garante que é número
        descricao: descricao,
        status: 'EMITIDA', // Simulando emissão imediata
        userId: userId,
        clienteId: clienteId
      }
    });

    return NextResponse.json({ success: true, nota: novaNota }, { status: 201 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao emitir nota' }, { status: 500 });
  }
}