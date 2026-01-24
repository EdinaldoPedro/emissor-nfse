import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

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

// PUT: Edição Inteligente (Acumular Dias e Troca de Plano)
export async function PUT(request: Request) {
  const userAuth = await getAuthenticatedUser(request);
  if (!userAuth) return unauthorized();

  // Apenas Admin/Master pode editar
  if (!['MASTER', 'ADMIN'].includes(userAuth.role)) return forbidden();

  try {
    const body = await request.json();

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

    // === 4. LÓGICA DE PLANOS (ACUMULATIVA) ===
    if (body.plano) {
        const novoPlano = await prisma.plan.findUnique({ where: { slug: body.plano } });
        if (!novoPlano) return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 });

        const ciclo = body.planoCiclo || 'MENSAL';
        
        // Verifica se o usuário já tem um histórico ATIVO
        const historicoAtivo = await prisma.planHistory.findFirst({
            where: { userId: body.id, status: 'ATIVO' },
            orderBy: { createdAt: 'desc' }
        });

        // --- DEFINIR A DURAÇÃO ---
        let diasParaAdicionar = 0;
        
        if (novoPlano.slug === 'PARCEIRO') {
            diasParaAdicionar = 0; // Vitalício (null)
        } else if (novoPlano.slug === 'TRIAL') {
            diasParaAdicionar = novoPlano.diasTeste || 7;
        } else {
            // Planos Pagos (Inicial, Intermediário, Livre)
            diasParaAdicionar = ciclo === 'ANUAL' ? 365 : 30;
        }

        let dataFimFinal: Date | null = null;

        // CENÁRIO A: É o MESMO plano => ESTENDER (Acumular)
        if (historicoAtivo && historicoAtivo.planId === novoPlano.id && novoPlano.slug !== 'PARCEIRO') {
            
            // Pega a maior data: (Vencimento Atual) ou (Hoje)
            const baseDate = historicoAtivo.dataFim && historicoAtivo.dataFim > new Date() 
                ? new Date(historicoAtivo.dataFim) 
                : new Date();
            
            // Soma os dias
            baseDate.setDate(baseDate.getDate() + diasParaAdicionar);
            dataFimFinal = baseDate;

            // Atualiza o histórico existente estendendo a data
            await prisma.planHistory.update({
                where: { id: historicoAtivo.id },
                data: { dataFim: dataFimFinal }
            });
        } 
        // CENÁRIO B: É um plano DIFERENTE (Upgrade/Downgrade) ou Novo => TROCAR
        else {
            // Fecha o anterior
            await prisma.planHistory.updateMany({
                where: { userId: body.id, status: 'ATIVO' },
                data: { status: 'FINALIZADO', dataFim: new Date() } 
            });

            // Define nova data fim
            if (novoPlano.slug !== 'PARCEIRO') {
                const d = new Date();
                d.setDate(d.getDate() + diasParaAdicionar);
                dataFimFinal = d;
            }

            // Cria novo histórico
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

        // Atualiza Cache do Usuário
        await prisma.user.update({
            where: { id: body.id },
            data: { 
                plano: novoPlano.slug, 
                planoStatus: 'active',
                planoExpiresAt: dataFimFinal,
                planoCiclo: ciclo
            }
        });

        return NextResponse.json({ success: true, message: "Plano atualizado/estendido com sucesso!" });
    }

    // --- 5. OUTROS DADOS ---
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