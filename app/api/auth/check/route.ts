import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { email, cpf } = await request.json();
    const errors: any = {};

    if (email) {
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) errors.email = "Este e-mail já está em uso.";
    }

    if (cpf) {
      const cpfLimpo = cpf.replace(/\D/g, '');
      const exists = await prisma.user.findUnique({ where: { cpf: cpfLimpo } });
      if (exists) errors.cpf = "Este CPF já possui cadastro.";
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao verificar dados.' }, { status: 500 });
  }
}