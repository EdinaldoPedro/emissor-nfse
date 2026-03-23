import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { getAuthenticatedUser, unauthorized } from '@/app/utils/api-middleware';
import { decrypt } from '@/app/utils/crypto'; // <--- IMPORT DA CRIPTOGRAFIA

const prisma = new PrismaClient();

export async function POST(request: Request) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) return unauthorized();

    const userFull = await prisma.user.findUnique({ where: { id: userAuth.id } });
    if (!userFull || !userFull.email) return NextResponse.json({ error: "Usuário sem e-mail." }, { status: 400 });

    try {
        const body = await request.json();

        let passToUse = body.smtpPass;
        
        // Se a senha vier vazia ou como a MÁSCARA '********', buscamos a real no banco
        if (!passToUse || passToUse === '********') {
            const configSalva = await prisma.configuracaoSistema.findUnique({ where: { id: 'config' } });
            // === SEGURANÇA: Descriptografa a senha para usar no teste ===
            passToUse = decrypt(configSalva?.smtpPass || '') || '';
        }

        if (!body.smtpHost || !body.smtpUser || !passToUse) {
            return NextResponse.json({ error: "Preencha Host, Usuário e Senha para testar." }, { status: 400 });
        }

        const transporter = nodemailer.createTransport({
            host: body.smtpHost,
            port: Number(body.smtpPort) || 587,
            secure: body.smtpSecure === true, 
            auth: {
                user: body.smtpUser,
                pass: passToUse, // Usando a senha descriptografada
            },
            tls: {
                // === SEGURANÇA: Valida certificados apenas em Produção ===
                rejectUnauthorized: process.env.NODE_ENV === 'production'
            }
        });

        await transporter.verify();

        const info = await transporter.sendMail({
            from: body.emailRemetente || body.smtpUser, 
            to: userFull.email, 
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
        }, { status: 400 }); 
    }
}