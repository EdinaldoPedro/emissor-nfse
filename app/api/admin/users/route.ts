import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET
export async function GET() {
  const users = await prisma.user.findMany({
    include: { empresa: true },
    orderBy: { createdAt: 'desc' }
  });
  // @ts-ignore
  const safeUsers = users.map(u => { const { senha, ...rest } = u; return rest; });
  return NextResponse.json(safeUsers);
}

// PUT: Edição Simples e Segura
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    
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

        // Verifica se a empresa já existe no banco
        const empresaExistente = await prisma.empresa.findUnique({ 
            where: { documento: cnpjLimpo },
            include: { donoUser: true } // Volta a ser donoUser (singular)
        });

        if (empresaExistente) {
            // Se já tem dono e não é o usuário atual -> ERRO (Bloqueio Total)
            if (empresaExistente.donoUser && empresaExistente.donoUser.id !== body.id) {
                return NextResponse.json({ 
                    error: `Este CNPJ já pertence ao cliente ${empresaExistente.donoUser.nome}. Não é possível duplicar.` 
                }, { status: 409 });
            }

            // Se a empresa existe mas está órfã (sem dono), vincula a este usuário
            await prisma.user.update({
                where: { id: body.id },
                data: { empresaId: empresaExistente.id }
            });

            return NextResponse.json({ success: true, message: "Usuário vinculado à empresa existente." });

        } else {
            // CENÁRIO: CNPJ Novo (Não existe na base)
            // Se o usuário já tem uma empresa ID, atualizamos o número dela.
            if (body.empresaId) {
                await prisma.empresa.update({
                    where: { id: body.empresaId },
                    data: { documento: cnpjLimpo }
                });
                return NextResponse.json({ success: true, message: "CNPJ atualizado com sucesso." });
            } else {
                return NextResponse.json({ error: "Empresa não encontrada. O cliente precisa completar o cadastro." }, { status: 400 });
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
    console.error(e);
    // Tratamento para erro de duplicidade do Prisma
    if (e.code === 'P2002') {
        return NextResponse.json({ error: "Conflito: Este dado já está em uso (Email, CPF ou Empresa)." }, { status: 409 });
    }
    return NextResponse.json({ error: e.message || 'Erro ao atualizar' }, { status: 500 });
  }
}