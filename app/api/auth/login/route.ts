import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, senha } = body;

    // 1. Busca o usuário pelo email
    const usuario = await prisma.usuario.findUnique({
      where: { email: email }
    });

    // Se não achar o email
    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 401 });
    }

    // 2. Verifica se a senha bate com a criptografia
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
    }

    // 3. Sucesso! Retorna os dados (incluindo o TIPO)
    return NextResponse.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo, // <--- O PULO DO GATO ESTÁ AQUI (ADMIN ou CLIENTE)
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}