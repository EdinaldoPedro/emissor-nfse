import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, email, senha } = body;

    // Validação básica
    if (!nome || !email || !senha) {
      return NextResponse.json({ message: 'Preencha todos os campos.' }, { status: 400 });
    }

    // Verifica se já existe
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email: email },
    });

    if (usuarioExistente) {
      return NextResponse.json({ message: 'Este email já está cadastrado.' }, { status: 400 });
    }

    // Criptografa senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Cria o usuário
    await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        tipo: 'CLIENTE',
      },
    });

    // O retorno de sucesso tem que estar DENTRO do bloco try
    return NextResponse.json({ message: 'Conta criada com sucesso!' }, { status: 201 });

  } catch (error) {
    console.error("Erro no cadastro:", error);
    return NextResponse.json({ message: 'Erro interno ao criar conta.' }, { status: 500 });
  }
}