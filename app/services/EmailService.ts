import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { createLog } from './logger';

const prisma = new PrismaClient();

export class EmailService {
    
    private async getTransporter() {
        // 1. Tenta buscar configuração do banco (Prioridade Máxima)
        const config = await prisma.configuracaoSistema.findUnique({ where: { id: 'config' } });

        // Se tem config no banco e o host está preenchido, usa ela
        if (config && config.smtpHost) {
            return {
                transporter: nodemailer.createTransport({
                    host: config.smtpHost,
                    port: config.smtpPort || 587,
                    secure: config.smtpSecure, // true para 465, false para outras
                    auth: {
                        user: config.smtpUser || '',
                        pass: config.smtpPass || '',
                    },
                    tls: { rejectUnauthorized: false } // Evita erro de certificado auto-assinado
                }),
                remetente: config.emailRemetente || config.smtpUser || 'nao-responda@seusistema.com.br'
            };
        }

        // 2. Fallback: Variáveis de Ambiente (Se banco estiver vazio)
        // Isso é útil se você quiser configurar via .env inicialmente
        if (process.env.SMTP_HOST) {
            return {
                transporter: nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: Number(process.env.SMTP_PORT) || 587,
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS,
                    }
                }),
                remetente: process.env.SMTP_FROM || process.env.SMTP_USER || 'nao-responda@seusistema.com.br'
            };
        }

        throw new Error("SMTP não configurado. Configure no Painel Admin ou .env");
    }

    async sendEmail(to: string, subject: string, html: string, attachments: any[] = []) {
        try {
            const { transporter, remetente } = await this.getTransporter();

            const info = await transporter.sendMail({
                from: `"Emissor NFSe" <${remetente}>`,
                to,
                subject,
                html,
                attachments
            });

            console.log(`[EMAIL] Enviado para ${to} | ID: ${info.messageId}`);
            
            return { success: true, messageId: info.messageId };

        } catch (error: any) {
            console.error("[EMAIL ERROR]", error);
            
            // Grava log de erro no sistema para o Admin ver
            await createLog({
                level: 'ERRO',
                action: 'FALHA_ENVIO_EMAIL',
                message: `Falha ao enviar para ${to}: ${error.message}`,
                details: { stack: error.stack }
            });

            return { success: false, error: error.message };
        }
    }

    // === TEMPLATES ===

    getTemplateRecuperacaoSenha(nome: string, link: string) {
        return `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #2563eb;">Recuperação de Senha</h2>
                <p>Olá, <strong>${nome}</strong>.</p>
                <p>Recebemos uma solicitação para redefinir sua senha no sistema <strong>NFSe Fácil</strong>.</p>
                <p>Se foi você, clique no botão abaixo para criar uma nova senha:</p>
                <br/>
                <a href="${link}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Redefinir Minha Senha</a>
                <br/><br/>
                <p style="font-size: 12px; color: #666;">Este link expira em 1 hora.</p>
                <p style="font-size: 12px; color: #666;">Se não foi você, apenas ignore este e-mail.</p>
            </div>
        `;
    }
}