import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { EmailService } from '@/app/services/EmailService';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    const user = await prisma.user.findFirst({
        where: { email } // Busca por email
    });

    if (!user) {
        // Retornamos sucesso mesmo se não achar, para segurança (evitar enumeração de emails)
        return NextResponse.json({ success: true });
    }

    // 1. Gera Token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hora a partir de agora

    // 2. Salva no Banco
    await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetExpires }
    });

    // 3. Monta Link
    // Se estiver em produção, usar variável de ambiente. Em dev, usa localhost.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';
    const link = `${baseUrl}/redefinir-senha?token=${resetToken}`;

    // 4. Envia Email
    const emailService = new EmailService();
    const html = emailService.getTemplateRecuperacaoSenha(user.nome, link);
    
    await emailService.sendEmail(user.email, 'Redefinição de Senha - NFSe Fácil', html);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}