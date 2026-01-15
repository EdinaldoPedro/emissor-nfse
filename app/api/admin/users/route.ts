import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

// GET: Lista usuários (Protegido)
export async function GET(request: Request) {
  // 1. Autenticação Robusta
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  // 2. Autorização (Apenas Staff)
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

// PUT: Edição (Protegido)
export async function PUT(request: Request) {
  const userAuth = await getAuthenticatedUser(request);
  if (!userAuth) return unauthorized();

  // Apenas Admin/Master pode editar outros usuários dessa forma
  if (!['MASTER', 'ADMIN'].includes(userAuth.role)) return forbidden();

  try {
    const body = await request.json();

    if (body.resetEmail) {
        // Gera um email temporário único para não quebrar a constraint @unique do banco
        const tempPlaceholder = `reset_${Date.now()}_${body.id.substring(0,5)}@sistema.temp`;
        
        await prisma.user.update({
            where: { id: body.id },
            data: { email: tempPlaceholder }
        });
        return NextResponse.json({ success: true, message: "E-mail resetado. O usuário deverá cadastrar um novo ao logar." });
    }
    
    // --- 1. DESVINCULAR EMPRESA ---
    if (body.unlinkCompany) {
        await prisma.user.update({
            where: { id: body.id },
            data: { empresaId: null }
        });
        return NextResponse.json({ success: true, message: "Empresa desvinculada." });
    }

    // --- 2. TROCAR/CORRIGIR CNPJ ---
    if (body.newCnpj) {
        const cnpjLimpo = body.newCnpj.replace(/\D/g, '');
        if(cnpjLimpo.length !== 14) return NextResponse.json({ error: 'CNPJ Inválido' }, { status: 400 });

        const empresaExistente = await prisma.empresa.findUnique({ 
            where: { documento: cnpjLimpo },
            include: { donoUser: true } 
        });

        if (empresaExistente) {
            if (empresaExistente.donoUser && empresaExistente.donoUser.id !== body.id) {
                return NextResponse.json({ 
                    error: `Este CNPJ já pertence ao cliente ${empresaExistente.donoUser.nome}.` 
                }, { status: 409 });
            }

            await prisma.user.update({
                where: { id: body.id },
                data: { empresaId: empresaExistente.id }
            });

            return NextResponse.json({ success: true, message: "Usuário vinculado." });
        } else {
            if (body.empresaId) {
                await prisma.empresa.update({
                    where: { id: body.empresaId },
                    data: { documento: cnpjLimpo }
                });
                return NextResponse.json({ success: true, message: "CNPJ atualizado." });
            } else {
                return NextResponse.json({ error: "Empresa não encontrada." }, { status: 400 });
            }
        }
    }

    // --- 3. ATUALIZAR DADOS GERAIS ---
    const dataToUpdate: any = {};
    if (body.role) dataToUpdate.role = body.role;
    if (body.plano) dataToUpdate.plano = body.plano;
    if (body.planoCiclo) dataToUpdate.planoCiclo = body.planoCiclo;

    const updated = await prisma.user.update({
        where: { id: body.id },
        data: dataToUpdate
    });
    
    return NextResponse.json(updated);

  } catch (e: any) {
    if (e.code === 'P2002') return NextResponse.json({ error: "Conflito de dados." }, { status: 409 });
    return NextResponse.json({ error: e.message || 'Erro ao atualizar' }, { status: 500 });
  }
}