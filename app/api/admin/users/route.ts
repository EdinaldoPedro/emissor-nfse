import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';
import bcrypt from 'bcryptjs'; // <--- Necessário para validar a senha

const prisma = new PrismaClient();

// GET: Lista usuários (Mantido igual)
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
  const userAuth = await getAuthenticatedUser(request); // Usuário Logado (Admin)
  if (!userAuth) return unauthorized();

  // Apenas Admin/Master pode editar
  if (!['MASTER', 'ADMIN'].includes(userAuth.role)) return forbidden();

  try {
    const body = await request.json();

    // === 0. VALIDAÇÃO DE SEGURANÇA (Apenas se houver troca de plano) ===
    if (body.plano) {
        if (!body.adminPassword || !body.justification) {
            return NextResponse.json({ error: 'Senha de confirmação e justificativa são obrigatórios para alterar planos.' }, { status: 400 });
        }

        // Busca o ADMIN no banco para pegar o hash da senha dele
        const adminDb = await prisma.user.findUnique({ where: { id: userAuth.id } });
        if (!adminDb) return unauthorized();

        const senhaValida = await bcrypt.compare(body.adminPassword, adminDb.senha);
        if (!senhaValida) {
            return NextResponse.json({ error: 'Senha de confirmação incorreta.' }, { status: 403 });
        }
    }

    // 1. Resetar E-mail (Mantido)
    if (body.resetEmail) {
        const tempPlaceholder = `reset_${Date.now()}_${body.id.substring(0,5)}@sistema.temp`;
        await prisma.user.update({ where: { id: body.id }, data: { email: tempPlaceholder } });
        return NextResponse.json({ success: true, message: "E-mail resetado." });
    }
    
    // 2. Desvincular Empresa (Mantido)
    if (body.unlinkCompany) {
        await prisma.user.update({ where: { id: body.id }, data: { empresaId: null } });
        return NextResponse.json({ success: true, message: "Empresa desvinculada." });
    }

    // 3. Trocar CNPJ (Mantido)
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

    // === 4. LÓGICA DE PLANOS (COM AUDITORIA) ===
    if (body.plano) {
        // --- LOG DE AUDITORIA ---
        // Pegar dados antigos para o log
        const userAlvo = await prisma.user.findUnique({ where: { id: body.id } });
        
        await prisma.systemLog.create({
            data: {
                level: 'WARN',
                action: 'MANUAL_PLAN_CHANGE',
                message: `Alteração manual de plano para: ${userAlvo?.nome} (${userAlvo?.email})`,
                details: JSON.stringify({
                    adminId: userAuth.id,
                    oldPlan: userAlvo?.plano,
                    newPlan: body.plano,
                    justification: body.justification,
                    timestamp: new Date()
                })
            }
        });

        // --- CASO ESPECIAL: SUSPENDER ACESSO ---
        if (body.plano === 'SUSPENDED') {
            // Encerra qualquer histórico ativo
            await prisma.planHistory.updateMany({
                where: { userId: body.id, status: 'ATIVO' },
                data: { status: 'CANCELADO_ADM', dataFim: new Date() }
            });

            // Atualiza usuário para bloqueado
            await prisma.user.update({
                where: { id: body.id },
                data: { 
                    plano: 'SEM_PLANO', 
                    planoStatus: 'suspended',
                    planoExpiresAt: new Date() // Expira agora
                }
            });

            return NextResponse.json({ success: true, message: "Acesso suspenso com sucesso." });
        }

        // --- CASO NORMAL: ATIVAR PLANO ---
        const novoPlano = await prisma.plan.findUnique({ where: { slug: body.plano } });
        if (!novoPlano) return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 });

        const ciclo = body.planoCiclo || 'MENSAL';
        
        // Verifica histórico ativo
        const historicoAtivo = await prisma.planHistory.findFirst({
            where: { userId: body.id, status: 'ATIVO' },
            orderBy: { createdAt: 'desc' }
        });

        let diasParaAdicionar = 0;
        if (novoPlano.slug === 'PARCEIRO') diasParaAdicionar = 0;
        else if (novoPlano.slug === 'TRIAL') diasParaAdicionar = novoPlano.diasTeste || 7;
        else diasParaAdicionar = ciclo === 'ANUAL' ? 365 : 30;

        let dataFimFinal: Date | null = null;

        // ESTENDER (Mesmo plano)
        if (historicoAtivo && historicoAtivo.planId === novoPlano.id && novoPlano.slug !== 'PARCEIRO') {
            const baseDate = historicoAtivo.dataFim && historicoAtivo.dataFim > new Date() 
                ? new Date(historicoAtivo.dataFim) 
                : new Date();
            
            baseDate.setDate(baseDate.getDate() + diasParaAdicionar);
            dataFimFinal = baseDate;

            await prisma.planHistory.update({
                where: { id: historicoAtivo.id },
                data: { dataFim: dataFimFinal }
            });
        } 
        // TROCAR (Novo histórico)
        else {
            await prisma.planHistory.updateMany({
                where: { userId: body.id, status: 'ATIVO' },
                data: { status: 'FINALIZADO', dataFim: new Date() } 
            });

            if (novoPlano.slug !== 'PARCEIRO') {
                const d = new Date();
                d.setDate(d.getDate() + diasParaAdicionar);
                dataFimFinal = d;
            }

            await prisma.planHistory.create({
                data: {
                    userId: body.id,
                    planId: novoPlano.id,
                    status: 'ATIVO',
                    dataInicio: new Date(),
                    dataFim: dataFimFinal,
                    notasEmitidas: 0
                }
            });
        }

        await prisma.user.update({
            where: { id: body.id },
            data: { 
                plano: novoPlano.slug, 
                planoStatus: 'active',
                planoExpiresAt: dataFimFinal,
                planoCiclo: ciclo
            }
        });

        return NextResponse.json({ success: true, message: "Plano atualizado com sucesso!" });
    }

    // --- 5. OUTROS DADOS (Role, etc) ---
    const dataToUpdate: any = {};
    if (body.role) dataToUpdate.role = body.role;

    if (Object.keys(dataToUpdate).length > 0) {
        const updated = await prisma.user.update({ where: { id: body.id }, data: dataToUpdate });
        return NextResponse.json(updated);
    }
    
    return NextResponse.json({ success: true });

  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: "Dados duplicados." }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}