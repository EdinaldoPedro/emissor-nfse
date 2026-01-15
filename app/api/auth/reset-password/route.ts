import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { token, newPassword } = await request.json();

    // 1. Busca usuário pelo token e verifica validade
    const user = await prisma.user.findFirst({
        where: {
            resetToken: token,
            resetExpires: { gt: new Date() } // Deve ser maior que agora
        }
    });

    if (!user) {
        return NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 400 });
    }

    // 2. Hash da nova senha
    const senhaHash = await bcrypt.hash(newPassword, 10);

    // 3. Atualiza e limpa token
    await prisma.user.update({
        where: { id: user.id },
        data: {
            senha: senhaHash,
            resetToken: null,
            resetExpires: null
        }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}