import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { EmailService } from '@/app/services/EmailService';
import { getAuthenticatedUser, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) return unauthorized();

    try {
        const { newEmail, password } = await request.json();

        // 1. Verifica Senha Atual (Segurança)
        const user = await prisma.user.findUnique({ where: { id: userAuth.id } });
        if (!user || !user.senha) return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });

        const senhaValida = await bcrypt.compare(password, user.senha);
        if (!senhaValida) return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });

        // 2. Verifica se e-mail já existe em outra conta
        const emailExiste = await prisma.user.findFirst({ where: { email: newEmail } });
        if (emailExiste) return NextResponse.json({ error: "Este e-mail já está em uso." }, { status: 400 });

        // 3. Gera Código
        const codigo = crypto.randomInt(100000, 999999).toString();
        const validade = new Date(Date.now() + 15 * 60 * 1000); // 15 min

        // 4. Salva Temporariamente
        await prisma.user.update({
            where: { id: user.id },
            data: {
                tempEmail: newEmail,
                verificationCode: codigo,
                verificationExpires: validade
            }
        });

        // 5. Envia E-mail
        const emailService = new EmailService();
        const html = emailService.getTemplateVerificacaoEmail(user.nome, codigo);
        await emailService.sendEmail(newEmail, "Código de Verificação", html);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}