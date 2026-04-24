import nodemailer from 'nodemailer';
import { createLog } from './logger';
import { decrypt } from '@/app/utils/crypto';
import { prisma } from '@/app/utils/prisma';

export class EmailService {
  private async getTransporter() {
    const config = await prisma.configuracaoSistema.findUnique({ where: { id: 'config' } });

    if (config && config.smtpHost) {
      const smtpPass = decrypt(config.smtpPass) || config.smtpPass || '';

      return {
        transporter: nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort || 587,
          secure: config.smtpSecure,
          auth: {
            user: config.smtpUser || '',
            pass: smtpPass,
          },
          tls: { rejectUnauthorized: false },
        }),
        remetente: config.emailRemetente || config.smtpUser || 'nao-responda@seusistema.com.br',
      };
    }

    if (process.env.SMTP_HOST) {
      return {
        transporter: nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        }),
        remetente: process.env.SMTP_FROM || process.env.SMTP_USER || 'nao-responda@seusistema.com.br',
      };
    }

    throw new Error('SMTP nÃ£o configurado. Configure no Painel Admin ou .env');
  }

  async sendEmail(to: string, subject: string, html: string, attachments: any[] = []) {
    try {
      const { transporter, remetente } = await this.getTransporter();

      const info = await transporter.sendMail({
        from: `"Emissor NFSe" <${remetente}>`,
        to,
        subject,
        html,
        attachments,
      });

      console.log(`[EMAIL] Enviado para ${to} | ID: ${info.messageId}`);

      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error('[EMAIL ERROR]', error);

      await createLog({
        level: 'ERRO',
        action: 'FALHA_ENVIO_EMAIL',
        message: `Falha ao enviar para ${to}: ${error.message}`,
        details: { stack: error.stack },
      });

      return { success: false, error: error.message };
    }
  }

  getTemplateRecuperacaoSenha(nome: string, link: string) {
    return `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <h2 style="color: #2563eb; margin-bottom: 10px;">NFSeGoo</h2>
                <h3 style="color: #1e293b; margin-top: 0;">RecuperaÃ§Ã£o de Palavra-passe</h3>
                <p>OlÃ¡, <strong>${nome}</strong>.</p>
                <p>Recebemos um pedido para redefinir a palavra-passe da sua conta no sistema <strong>NFSeGoo</strong>.</p>
                <p>Se foi vocÃª que fez este pedido, clique no botÃ£o abaixo para criar uma nova palavra-passe segura:</p>
                <br/>
                <div style="text-align: center;">
                    <a href="${link}" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">Redefinir Minha Senha</a>
                </div>
                <br/><br/>
                <hr style="border: none; border-top: 1px solid #e2e8f0;" />
                <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
                    ðŸ”’ <strong>SeguranÃ§a:</strong> Este link Ã© de uso Ãºnico e <strong>expira em 1 hora</strong>. Nunca partilhe este link ou a sua senha com ninguÃ©m.
                </p>
                <p style="font-size: 12px; color: #64748b;">
                    Se nÃ£o solicitou esta alteraÃ§Ã£o, por favor ignore este e-mail. A sua conta permanece segura.
                </p>
            </div>
        `;
  }

  getTemplateVerificacaoEmail(nome: string, codigo: string) {
    return `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #2563eb;">ConfirmaÃ§Ã£o de E-mail</h2>
                <p>OlÃ¡, <strong>${nome}</strong>.</p>
                <p>Recebemos uma solicitaÃ§Ã£o para atualizar seu e-mail de acesso.</p>
                <p>Seu cÃ³digo de verificaÃ§Ã£o Ã©:</p>
                <div style="background-color: #f3f4f6; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px; margin: 20px 0; border-radius: 5px;">
                    ${codigo}
                </div>
                <p style="font-size: 12px; color: #666;">Este cÃ³digo expira em 15 minutos.</p>
                <p style="font-size: 12px; color: #666;">Se nÃ£o foi vocÃª, altere sua senha imediatamente.</p>
            </div>
        `;
  }
}
