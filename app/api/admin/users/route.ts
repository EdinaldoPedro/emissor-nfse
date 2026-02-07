import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';
import bcrypt from 'bcryptjs'; 

const prisma = new PrismaClient();

// GET: Lista usuários
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role);
  if (!isStaff) return forbidden();

  const users = await prisma.user.findMany({
    include: { empresa: true },
    orderBy: { createdAt: 'desc' }
  });
  
  // @ts-ignore
  const safeUsers = users.map(u => { const { senha, ...rest } = u; return rest; });
  return NextResponse.json(safeUsers);
}

// PUT: Edição Inteligente com Auditoria e Segurança
export async function PUT(request: Request) {
  const userAuth = await getAuthenticatedUser(request);
  if (!userAuth) return unauthorized();

  if (!['MASTER', 'ADMIN'].includes(userAuth.role)) return forbidden();

  try {
    const body = await request.json();

    // === 0. VALIDAÇÃO DE SEGURANÇA (Apenas se houver troca de plano MANUAL) ===
    if (body.plano) {
        if (!body.adminPassword || !body.justification) {
            return NextResponse.json({ error: 'Senha de confirmação e justificativa são obrigatórios para alterar planos.' }, { status: 400 });
        }

        const adminDb = await prisma.user.findUnique({ where: { id: userAuth.id } });
        if (!adminDb) return unauthorized();

        const senhaValida = await bcrypt.compare(body.adminPassword, adminDb.senha);
        if (!senhaValida) {
            return NextResponse.json({ error: 'Senha de confirmação incorreta.' }, { status: 403 });
        }
    }

    // 1. Resetar E-mail
    if (body.resetEmail) {
        const tempPlaceholder = `reset_${Date.now()}_${body.id.substring(0,5)}@sistema.temp`;
        await prisma.user.update({ where: { id: body.id }, data: { email: tempPlaceholder } });
        return NextResponse.json({ success: true, message: "E-mail resetado." });
    }
    
    // 2. Desvincular Empresa
    if (body.unlinkCompany) {
        await prisma.user.update({ where: { id: body.id }, data: { empresaId: null } });
        return NextResponse.json({ success: true, message: "Empresa desvinculada." });
    }

    // 3. Trocar CNPJ
    if (body.newCnpj) {
        const cnpjLimpo = body.newCnpj.replace(/\D/g, '');
        if(cnpjLimpo.length !== 14) return NextResponse.json({ error: 'CNPJ Inválido' }, { status: 400 });

        const empresaExistente = await prisma.empresa.findUnique({ where: { documento: cnpjLimpo }, include: { donoUser: true } });

        if (empresaExistente) {
            if (empresaExistente.donoUser && empresaExistente.donoUser.id !== body.id) {
                return NextResponse.json({ error: `CNPJ pertence a ${empresaExistente.donoUser.nome}.` }, { status: 409 });
            }
            await prisma.user.update({ where: { id: body.id }, data: { empresaId: empresaExistente.id } });
            return NextResponse.json({ success: true, message: "Usuário vinculado." });
        } else {
            if (body.empresaId) {
                await prisma.empresa.update({ where: { id: body.empresaId }, data: { documento: cnpjLimpo } });
                return NextResponse.json({ success: true, message: "CNPJ atualizado." });
            } else {
                return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 });
            }
        }
    }

    // === 4. LÓGICA DE PLANOS (MANUAL) ===
    if (body.plano) {
        // ... (Mantendo sua lógica de log e update de plano existente) ...
        const userAlvo = await prisma.user.findUnique({ where: { id: body.id } });
        await prisma.systemLog.create({
            data: {
                level: 'WARN', action: 'MANUAL_PLAN_CHANGE',
                message: `Alteração manual de plano para: ${userAlvo?.nome}`,
                details: JSON.stringify({ adminId: userAuth.id, newPlan: body.plano, justification: body.justification })
            }
        });

        if (body.plano === 'SUSPENDED') {
            await prisma.planHistory.updateMany({ where: { userId: body.id, status: 'ATIVO' }, data: { status: 'CANCELADO_ADM', dataFim: new Date() } });
            await prisma.user.update({ where: { id: body.id }, data: { plano: 'SEM_PLANO', planoStatus: 'suspended', planoExpiresAt: new Date() } });
            return NextResponse.json({ success: true, message: "Acesso suspenso." });
        }

        const novoPlano = await prisma.plan.findUnique({ where: { slug: body.plano } });
        if (!novoPlano) return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 });

        // Lógica de expiração e histórico...
        const dataFimFinal = body.planoCiclo === 'ANUAL' ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)) : new Date(new Date().setDate(new Date().getDate() + 30));
        
        await prisma.planHistory.updateMany({ where: { userId: body.id, status: 'ATIVO' }, data: { status: 'FINALIZADO', dataFim: new Date() } });
        await prisma.planHistory.create({
            data: { userId: body.id, planId: novoPlano.id, status: 'ATIVO', dataInicio: new Date(), dataFim: dataFimFinal }
        });
        await prisma.user.update({
            where: { id: body.id },
            data: { plano: novoPlano.slug, planoStatus: 'active', planoExpiresAt: dataFimFinal, planoCiclo: body.planoCiclo || 'MENSAL' }
        });

        return NextResponse.json({ success: true, message: "Plano atualizado." });
    }

    // === 5. PROMOÇÃO DE CARGO (Lógica Nova) ===
    const dataToUpdate: any = {};
    if (body.role) {
        dataToUpdate.role = body.role;

        // SE VIROU CONTADOR -> ATIVA PLANO PARCEIRO AUTOMATICAMENTE
        if (body.role === 'CONTADOR') {
            const planoParceiro = await prisma.plan.findUnique({ where: { slug: 'PARCEIRO' } });
            if (planoParceiro) {
                // Encerra planos anteriores
                await prisma.planHistory.updateMany({ where: { userId: body.id, status: 'ATIVO' }, data: { status: 'FINALIZADO', dataFim: new Date() } });
                
                // Cria histórico vitalício
                await prisma.planHistory.create({
                    data: { userId: body.id, planId: planoParceiro.id, status: 'ATIVO', dataInicio: new Date(), dataFim: null }
                });

                dataToUpdate.plano = 'PARCEIRO';
                dataToUpdate.planoStatus = 'active';
                dataToUpdate.planoCiclo = 'ANUAL';
            }
        }
    }

    if (Object.keys(dataToUpdate).length > 0) {
        await prisma.user.update({ where: { id: body.id }, data: dataToUpdate });
        return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ success: true });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}