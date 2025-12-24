import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { email, senha } = await request.json();

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 });
    }

    // Retorna 'role' (ADMIN ou COMUM) para o frontend decidir
    return NextResponse.json({
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role, 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}