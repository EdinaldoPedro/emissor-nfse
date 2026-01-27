import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { validarCPF } from '@/app/utils/cpf';
import { EmailService } from '@/app/services/EmailService';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, email, senha, cpf, telefone } = body;

    // 1. Validação de Nome (Mínimo 15 chars, apenas letras e acentos PT-BR)
    const nomeRegex = /^[a-zA-ZÀ-ÿ\s^~]+$/;
    if (!nome || nome.trim().length < 15) {
      return NextResponse.json({ error: 'O nome completo deve ter no mínimo 15 caracteres.' }, { status: 400 });
    }
    if (!nomeRegex.test(nome)) {
      return NextResponse.json({ error: 'O nome contém caracteres inválidos. Use apenas letras e acentos.' }, { status: 400 });
    }

    // 2. Validação de Senha (6-20 chars, letras e números)
    const senhaRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,20}$/;
    if (!senha || !senhaRegex.test(senha)) {
      return NextResponse.json({ error: 'A senha deve ter entre 6 e 20 caracteres, contendo letras e números.' }, { status: 400 });
    }

    // 3. Validação de CPF
    if (!cpf || !validarCPF(cpf)) {
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

    // 6. Criação do Usuário (Com código de verificação)
    await prisma.user.create({
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
               plan: { connect: { slug: 'TRIAL' } }, // Assume que o seed já rodou
               status: 'ATIVO',
               dataFim: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
               notasEmitidas: 0
           }
        }
      }
    });

    // 7. Envio do E-mail
    const emailService = new EmailService();
    const html = emailService.getTemplateVerificacaoEmail(nome, verificationCode);
    await emailService.sendEmail(email, 'Confirme seu cadastro', html);

    return NextResponse.json({ success: true, message: 'Código enviado.' }, { status: 201 });

  } catch (error: any) {
    console.error("Erro Cadastro:", error);
    // Tratamento para caso o plano TRIAL não exista no banco ainda
    if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Erro de configuração do sistema (Plano Base).' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Erro interno ao criar conta.' }, { status: 500 });
  }
}