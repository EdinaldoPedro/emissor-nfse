import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, email, senha } = body;

    if (!nome || !email || !senha) return NextResponse.json({ message: 'Dados incompletos.' }, { status: 400 });

    const existe = await prisma.user.findUnique({ where: { email } });
    if (existe) return NextResponse.json({ message: 'Email já cadastrado.' }, { status: 400 });

    const senhaHash = await bcrypt.hash(senha, 10);
    
    // Define role
    const total = await prisma.user.count();
    const role = total === 0 ? 'ADMIN' : 'COMUM';

    await prisma.user.create({
      data: { nome, email, senha: senhaHash, role }
    });

    return NextResponse.json({ message: 'Sucesso!' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}