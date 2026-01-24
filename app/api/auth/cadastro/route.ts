import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
// CORREÇÃO AQUI: Adicionei '/app'
import { validarCPF } from '@/app/utils/cpf'; 

const prisma = new PrismaClient();

// ... imports existentes ...

export async function POST(request: Request) {
  try {
    // ... validações existentes (nome, email, cpf) ...

    const senhaHash = await bcrypt.hash(senha, 10);
    const totalUsers = await prisma.user.count();
    const role = totalUsers === 0 ? 'ADMIN' : 'COMUM';

    // 1. Cria Usuário
    const newUser = await prisma.user.create({
      data: { nome, email, senha: senhaHash, role, cpf: cpfLimpo, tutorialStep: 0 }
    });

    // 2. Busca ou Cria Plano TRIAL (Segurança)
    let planoTrial = await prisma.plan.findUnique({ where: { slug: 'TRIAL' } });
    if (!planoTrial) {
        // Fallback caso o seed não tenha rodado
        planoTrial = await prisma.plan.create({
            data: { name: 'Teste', slug: 'TRIAL', priceMonthly: 0, priceYearly: 0, features: '', diasTeste: 7, maxNotasMensal: 3, privado: true }
        });
    }

    // 3. Cria Histórico (Inicia o período de teste)
    const dataFim = new Date();
    dataFim.setDate(dataFim.getDate() + (planoTrial.diasTeste || 7));

    await prisma.planHistory.create({
        data: {
            userId: newUser.id,
            planId: planoTrial.id,
            status: 'ATIVO',
            dataInicio: new Date(),
            dataFim: dataFim,
            notasEmitidas: 0
        }
    });
    
    // Atualiza referência rápida no User (opcional, mantemos compatibilidade)
    await prisma.user.update({
        where: { id: newUser.id },
        data: { plano: 'TRIAL', planoStatus: 'active', planoExpiresAt: dataFim }
    });

    return NextResponse.json({ message: 'Sucesso!' }, { status: 201 });

  } catch (error) {
    // ... tratamento erro ...
  }
}