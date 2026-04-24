import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { EmailService } from '@/app/services/EmailService';
import { checkRateLimit } from '@/app/utils/rate-limit';
import { prisma } from '@/app/utils/prisma';

export async function POST(request: Request) {
    try {
        const { email } = await request.json();
        if (!email) return NextResponse.json({ error: 'E-mail é obrigatório.' }, { status: 400 });

        // === ESCUDO: RATE LIMITING ===
        const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
        
        const ipAllowed = await checkRateLimit(`forgot_ip_${ip}`, 3, 30 * 60 * 1000); // 30 min
        const emailAllowed = await checkRateLimit(`forgot_email_${email}`, 3, 30 * 60 * 1000);

        if (!ipAllowed || !emailAllowed) {
            return NextResponse.json({ 
                error: 'Você atingiu o limite de solicitações de recuperação. Aguarde 30 minutos.' 
            }, { status: 429 });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return NextResponse.json({ message: 'Se o e-mail existir, um link será enviado.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        
        // CORREÇÃO AQUI: Mudamos o nome da variável para bater com o banco (resetExpires)
        const resetExpires = new Date(Date.now() + 3600000);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken: hashedToken, 
                resetExpires // <--- CORRIGIDO
            }
        });

        // Captura dinamicamente o domínio/IP que o utilizador está a usar no navegador
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

        const resetLink = `${baseUrl}/redefinir-senha?token=${resetToken}`;
        
        const emailService = new EmailService();
        const html = emailService.getTemplateRecuperacaoSenha(user.nome, resetLink);
        await emailService.sendEmail(user.email, 'Recuperação de Senha', html);

        return NextResponse.json({ message: 'Se o e-mail existir, um link será enviado.' });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
    }
}
