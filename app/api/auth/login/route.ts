import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { login, senha } = await request.json(); // Recebemos 'login' em vez de 'email'

    if (!login || !senha) {
        return NextResponse.json({ error: 'Preencha login e senha.' }, { status: 400 });
    }

    // Limpa caracteres não numéricos para tentar comparar com CPF
    // (Caso o usuário digite CPF com pontos e traços)
    const loginLimpo = login.replace(/\D/g, ''); 

    // Busca usuário onde o login bate com Email OU CPF
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { email: login }, // Tenta achar pelo email exato
                { cpf: loginLimpo } // Tenta achar pelo CPF limpo (só números)
            ]
        }
    });

    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 });
    }

    // Retorna dados para o frontend
    return NextResponse.json({
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role, 
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}