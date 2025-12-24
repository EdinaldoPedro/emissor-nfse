import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
// CORREÇÃO AQUI: Adicionei '/app'
import { validarCPF } from '@/app/utils/cpf'; 

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, email, senha, cpf } = body;

    // 1. Validação de campos vazios
    if (!nome || !email || !senha || !cpf) {
        return NextResponse.json({ message: 'Preencha todos os campos.' }, { status: 400 });
    }

    // 2. VALIDAÇÃO REAL DE CPF
    if (!validarCPF(cpf)) {
        return NextResponse.json({ message: 'CPF inválido. Verifique os números.' }, { status: 400 });
    }

    const cpfLimpo = cpf.replace(/\D/g, '');

    // 3. Verifica duplicidade
    const existe = await prisma.user.findFirst({
        where: {
            OR: [
                { email: email },
                { cpf: cpfLimpo }
            ]
        }
    });

    if (existe) {
        if (existe.email === email) return NextResponse.json({ message: 'Email já cadastrado.' }, { status: 400 });
        if (existe.cpf === cpfLimpo) return NextResponse.json({ message: 'CPF já cadastrado.' }, { status: 400 });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const total = await prisma.user.count();
    const role = total === 0 ? 'ADMIN' : 'COMUM';

    await prisma.user.create({
      data: { nome, email, senha: senhaHash, role, cpf: cpfLimpo }
    });

    return NextResponse.json({ message: 'Sucesso!' }, { status: 201 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Erro interno.' }, { status: 500 });
  }
}