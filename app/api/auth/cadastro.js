import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Instância do Prisma
const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    // 1. Ler os dados enviados pelo formulário
    const body = await request.json();
    const { nome, email, senha } = body;

    // 2. Validação simples
    if (!nome || !email || !senha) {
      return NextResponse.json({ message: 'Preencha todos os campos.' }, { status: 400 });
    }

    // 3. Verificar se o usuário já existe no banco
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email: email },
    });

    if (usuarioExistente) {
      return NextResponse.json({ message: 'Este email já está cadastrado.' }, { status: 400 });
    }

    // 4. Criptografar a senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // 5. Criar o usuário
    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        tipo: 'CLIENTE', // Define como cliente
      },
    });

    return NextResponse.json({ message: 'Conta criada com sucesso!' }, { status: 201 });

  } catch (error) {
    console.error("Erro no cadastro:", error);
    return NextResponse.json({ message: 'Erro interno ao criar conta.' }, { status: 500 });
  }
}