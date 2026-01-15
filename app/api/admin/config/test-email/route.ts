import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { getAuthenticatedUser, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    // 1. Segurança e Identificação do Usuário
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) return unauthorized();

    // Precisamos do email do usuário logado para enviar o teste para ele mesmo
    const userFull = await prisma.user.findUnique({ where: { id: userAuth.id } });
    if (!userFull || !userFull.email) return NextResponse.json({ error: "Usuário sem e-mail." }, { status: 400 });

    try {
        const body = await request.json();

        // 2. Monta o transport com os dados que vieram do FRONT (para testar o que está digitado)
        // Se a senha vier vazia, busca a do banco
        let passToUse = body.smtpPass;
        if (!passToUse) {
            const configSalva = await prisma.configuracaoSistema.findUnique({ where: { id: 'config' } });
            passToUse = configSalva?.smtpPass || '';
        }

        if (!body.smtpHost || !body.smtpUser || !passToUse) {
            return NextResponse.json({ error: "Preencha Host, Usuário e Senha para testar." }, { status: 400 });
        }

        const transporter = nodemailer.createTransport({
            host: body.smtpHost,
            port: Number(body.smtpPort) || 587,
            secure: body.smtpSecure === true, // true para 465, false para outras
            auth: {
                user: body.smtpUser,
                pass: passToUse,
            },
            tls: {
                rejectUnauthorized: false // Ajuda em ambientes de dev, cuidado em prod
            }
        });

        // 3. Tenta Verificar Conexão
        await transporter.verify();

        // 4. Tenta Enviar E-mail Real
        const info = await transporter.sendMail({
            from: body.emailRemetente || body.smtpUser, // Quem envia
            to: userFull.email, // Quem recebe (o próprio admin logado)
            subject: 'Teste de Configuração - Emissor NFSe',
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
                    <h2 style="color: #16a34a;">✅ Sucesso!</h2>
                    <p>Olá, <strong>${userFull.nome}</strong>.</p>
                    <p>Se você recebeu este e-mail, as configurações SMTP do seu sistema SaaS estão funcionando corretamente.</p>
                    <hr/>
                    <p style="font-size: 12px; color: #666;">
                        <strong>Host:</strong> ${body.smtpHost}<br/>
                        <strong>Porta:</strong> ${body.smtpPort}<br/>
                        <strong>Seguro:</strong> ${body.smtpSecure ? 'Sim' : 'Não'}
                    </p>
                </div>
            `
        });

        return NextResponse.json({ 
            success: true, 
            message: `E-mail enviado com sucesso para ${userFull.email}!` 
        });

    } catch (error: any) {
        console.error("Erro SMTP:", error);
        return NextResponse.json({ 
            error: "Falha na conexão SMTP.", 
            details: error.message 
        }, { status: 400 }); // Retorna erro 400 para o front pegar a mensagem
    }
}