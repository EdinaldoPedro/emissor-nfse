import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { validarCPF } from '@/app/utils/cpf';
import { EmailService } from '@/app/services/EmailService';
import { registrarEventoCrm } from '@/app/services/crmService';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nome, email, documento, telefone, senha } = body;

        if (!nome || !email || !documento || !senha) {
            return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
        }

        // 1. Validação do Nome
        const nomeRegex = /^[A-Za-záàâãéèêíïóôõöúçñÁÀÂÃÉÈÍÏÓÔÕÖÚÇÑ ]+$/;
        if (!nomeRegex.test(nome)) {
            return NextResponse.json({ error: 'O nome contém caracteres inválidos. Use apenas letras e acentos.' }, { status: 400 });
        }

        // === NOVA TRAVA: REGRA DE SENHA FORTE ===
        const isSenhaForte = senha.length >= 8 && /[A-Z]/.test(senha) && /[0-9]/.test(senha) && /[^A-Za-z0-9]/.test(senha);
        
        if (!isSenhaForte) {
            return NextResponse.json({ 
                error: 'Sua senha é muito fraca. Use pelo menos 8 caracteres, 1 letra maiúscula, 1 número e 1 caractere especial (Ex: @, !, #).' 
            }, { status: 400 });
        }

        // 3. Validação de CPF (o frontend manda como 'documento')
        const cpf = documento;
        if (!validarCPF(cpf)) {
            return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
        }
        const cpfLimpo = cpf.replace(/\D/g, '');

        // 4. Verificação de Duplicidade (Check Final)
        const usuarioExistente = await prisma.user.findFirst({
            where: { OR: [{ email }, { cpf: cpfLimpo }] }
        });

        if (usuarioExistente) {
            return NextResponse.json({ error: 'E-mail ou CPF já cadastrados.' }, { status: 409 });
        }

        // 5. Preparação dos Dados
        const senhaHash = await bcrypt.hash(senha, 10);
        const verificationCode = crypto.randomInt(100000, 999999).toString();
        const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

        // Define o cargo (Primeiro usuário vira ADMIN, resto COMUM)
        const totalUsers = await prisma.user.count();
        const role = totalUsers === 0 ? 'ADMIN' : 'COMUM';

        // 6. Criação do Usuário
        const newUser = await prisma.user.create({
            data: {
                nome,
                email,
                senha: senhaHash,
                cpf: cpfLimpo,
                telefone,
                role,
                verificationCode,
                verificationExpires,
                tutorialStep: 0,
                // Cria plano TRIAL automaticamente
                historicoPlanos: {
                    create: {
                        plan: { connect: { slug: 'TRIAL' } }, 
                        status: 'ATIVO',
                        dataFim: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
                        notasEmitidas: 0
                    }
                }
            }
        });

        // === GATILHO PARA O CRM ===
        await registrarEventoCrm(
            newUser.id, 
            'SISTEMA', 
            'Conta Criada', 
            'O cliente realizou o registo através do site e o plano TRIAL de 7 dias foi ativado.'
        );

        // 7. Envio do E-mail
        const emailService = new EmailService();
        const html = emailService.getTemplateVerificacaoEmail(nome, verificationCode);
        await emailService.sendEmail(email, 'Confirme seu cadastro', html);

        return NextResponse.json({ success: true, message: 'Código enviado.' }, { status: 201 });

    } catch (error: any) {
        console.error("Erro Cadastro:", error);
        if (error?.code === 'P2025') {
            return NextResponse.json({ error: 'Erro de configuração do sistema (Plano Base não encontrado no banco).' }, { status: 500 });
        }
        return NextResponse.json({ error: 'Erro interno ao criar conta.' }, { status: 500 });
    }
}