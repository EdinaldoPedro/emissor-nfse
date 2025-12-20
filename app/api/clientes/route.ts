import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Buscar todos os clientes
export async function GET() {
  try {
    // Como ainda não temos login, vamos pegar TUDO (simulando)
    const clientes = await prisma.cliente.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(clientes);
  } catch (error) {
    return NextResponse.json({ error: "Erro ao buscar clientes" }, { status: 500 });
  }
}

// POST: Criar novo cliente
export async function POST(request: Request) {
  try {
    const dados = await request.json();

    // Primeiro, precisamos de um usuário "dono". 
    // Como não temos login ainda, vamos criar ou pegar um usuário padrão 'Admin'.
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: "admin@nfse.com",
          nome: "Admin Local",
          senhaHash: "123456" // Temporário
        }
      });
    }

    // Criar o cliente no banco vinculado a esse usuário
    const novoCliente = await prisma.cliente.create({
      data: {
        nome: dados.nome,
        documento: dados.documento,
        email: dados.email,
        userId: user.id
      }
    });

    return NextResponse.json(novoCliente, { status: 201 });
  } catch (error) {
    console.error(error); // Para ver o erro no terminal se houver
    return NextResponse.json({ error: "Erro ao criar cliente" }, { status: 500 });
  }
}