import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { signJWT } from '@/app/utils/auth';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    
    if (user.verificationCode !== code) {
        return NextResponse.json({ error: 'Código incorreto.' }, { status: 400 });
    }
    
    // Limpa o código após uso
    await prisma.user.update({
        where: { id: user.id },
        data: { verificationCode: null, verificationExpires: null }
    });

    // Gera Token de Acesso
    const token = await signJWT({ sub: user.id, role: user.role });

    return NextResponse.json({
        success: true,
        token,
        user: { id: user.id, nome: user.nome, role: user.role }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao confirmar.' }, { status: 500 });
  }
}