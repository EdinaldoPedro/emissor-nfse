import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Busca usuários cadastrados para mostrar na lista
    const usuarios = await prisma.user.findMany({ // <--- MUDOU AQUI
      orderBy: { createdAt: 'desc' }
    });

    const listaFormatada = usuarios.map(usuario => ({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      documento: "Auto-Cadastro",
      origem: "Site (Login)"
    }));

    return NextResponse.json(listaFormatada);
  } catch (error) {
    return NextResponse.json({ error: "Erro ao buscar dados" }, { status: 500 });
  }
}