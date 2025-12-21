import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, senha } = body;

    // 1. Busca o usuário na tabela correta (User)
    const usuario = await prisma.user.findUnique({
      where: { email: email }
    });

    // Se não achar o email
    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 401 });
    }

    // 2. Verifica a senha (campo 'senha' do banco)
    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
    }

    // 3. Sucesso!
    return NextResponse.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 });
  }
}