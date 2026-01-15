import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signJWT } from '@/app/utils/auth';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { login, senha } = await request.json();

    if (!login || !senha) {
        return NextResponse.json({ error: 'Preencha login e senha.' }, { status: 400 });
    }

    const loginLimpo = login.replace(/\D/g, ''); 

    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { email: login },
                { cpf: loginLimpo }
            ]
        },
        include: { empresa: true } // Trazemos empresa para facilitar o front
    });

    if (!user || !(await bcrypt.compare(senha, user.senha))) {
      return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 401 });
    }

    // === GERAÇÃO DO TOKEN JWT (Item 3) ===
    const token = await signJWT({ sub: user.id, role: user.role });

    // Retorna dados + token
    return NextResponse.json({
      success: true,
      token, // O frontend deve salvar isso
      user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role,
          empresaId: user.empresaId
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}