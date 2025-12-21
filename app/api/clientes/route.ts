import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Buscar APENAS os clientes do usuário logado
export async function GET(request: Request) {
  try {
    // 1. Pega o ID de quem está logado (enviado pelo frontend)
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json([], { status: 200 }); // Retorna lista vazia se não tiver logado
    }

    // 2. Busca na tabela CLIENTE (Tomadores), filtrando pelo dono (userId)
    const clientesDoUsuario = await prisma.cliente.findMany({
      where: { 
        userId: userId // <--- O FILTRO MÁGICO É ESSE
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(clientesDoUsuario);

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao buscar dados" }, { status: 500 });
  }
}

// POST: Criar um novo cliente (Tomador)
export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json();

    if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

    const novoCliente = await prisma.cliente.create({
      data: {
        nome: body.nome,
        email: body.email,
        documento: body.documento, // CPF ou CNPJ
        userId: userId // Vincula a você
      }
    });

    return NextResponse.json(novoCliente, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao criar cliente" }, { status: 500 });
  }
}