import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';
import { isAdminRole } from '@/app/utils/access-control';
import { decrypt } from '@/app/utils/crypto';
import { prisma } from '@/app/utils/prisma';

export async function POST(request: Request) {
  const userAuth = await getAuthenticatedUser(request);
  if (!userAuth) return unauthorized();
  if (!isAdminRole(userAuth.role)) return forbidden();

  const userFull = await prisma.user.findUnique({ where: { id: userAuth.id } });
  if (!userFull || !userFull.email) {
    return NextResponse.json({ error: 'UsuÃ¡rio sem e-mail.' }, { status: 400 });
  }

  try {
    const body = await request.json();

    let passToUse = body.smtpPass;

    if (!passToUse || passToUse === '********') {
      const configSalva = await prisma.configuracaoSistema.findUnique({ where: { id: 'config' } });
      passToUse = decrypt(configSalva?.smtpPass || '') || '';
    }

    if (!body.smtpHost || !body.smtpUser || !passToUse) {
      return NextResponse.json({ error: 'Preencha Host, UsuÃ¡rio e Senha para testar.' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host: body.smtpHost,
      port: Number(body.smtpPort) || 587,
      secure: body.smtpSecure === true,
      auth: {
        user: body.smtpUser,
        pass: passToUse,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });

    await transporter.verify();

    await transporter.sendMail({
      from: body.emailRemetente || body.smtpUser,
      to: userFull.email,
      subject: 'Teste de ConfiguraÃ§Ã£o - Emissor NFSe',
      html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ccc; border-radius: 8px;">
                    <h2 style="color: #16a34a;">âœ… Sucesso!</h2>
                    <p>OlÃ¡, <strong>${userFull.nome}</strong>.</p>
                    <p>Se vocÃª recebeu este e-mail, as configuraÃ§Ãµes SMTP do seu sistema SaaS estÃ£o funcionando corretamente.</p>
                    <hr/>
                    <p style="font-size: 12px; color: #666;">
                        <strong>Host:</strong> ${body.smtpHost}<br/>
                        <strong>Porta:</strong> ${body.smtpPort}<br/>
                        <strong>Seguro:</strong> ${body.smtpSecure ? 'Sim' : 'NÃ£o'}
                    </p>
                </div>
            `,
    });

    return NextResponse.json({
      success: true,
      message: `E-mail enviado com sucesso para ${userFull.email}!`,
    });
  } catch (error: any) {
    console.error('Erro SMTP:', error);
    return NextResponse.json(
      {
        error: 'Falha na conexÃ£o SMTP.',
        details: error.message,
      },
      { status: 400 },
    );
  }
}
