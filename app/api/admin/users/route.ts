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

// PUT
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    
    // --- 1. DESVINCULAR ---
    if (body.unlinkCompany) {
        await prisma.user.update({
            where: { id: body.id },
            data: { empresaId: null }
        });
        return NextResponse.json({ success: true, message: "Empresa desvinculada." });
    }

    // --- 2. GERENCIAR CNPJ ---
    if (body.newCnpj) {
        const cnpjLimpo = body.newCnpj.replace(/\D/g, '');
        if(cnpjLimpo.length !== 14) return NextResponse.json({ error: 'CNPJ Inválido' }, { status: 400 });

        // Busca empresa e seus donos
        let empresaAlvo = await prisma.empresa.findUnique({ 
            where: { documento: cnpjLimpo },
            // MUDANÇA AQUI: de 'donoUser' para 'donos'
            include: { donos: true } 
        });

        if (empresaAlvo) {
            // === REGRA DE NEGÓCIO ===
            const usuarioEditado = await prisma.user.findUnique({ where: { id: body.id } });
            const roleUsuario = usuarioEditado?.role || 'COMUM';

            // Conta quantos donos a empresa já tem (excluindo o usuário atual se ele já for um)
            const outrosDonos = await prisma.user.count({
                where: { 
                    empresaId: empresaAlvo.id,
                    id: { not: body.id }
                }
            });

            // Regra: Comum não pode compartilhar. Contador pode.
            if (roleUsuario === 'COMUM' && outrosDonos > 0) {
                return NextResponse.json({ 
                    error: `Este CNPJ já pertence a outro usuário Comum. Apenas Contadores podem compartilhar acesso.` 
                }, { status: 409 });
            }

            await prisma.user.update({
                where: { id: body.id },
                data: { empresaId: empresaAlvo.id }
            });

            return NextResponse.json({ 
                success: true, 
                message: roleUsuario === 'CONTADOR' 
                    ? "Vínculo de Contador realizado com sucesso." 
                    : "Usuário vinculado à empresa existente." 
            });

        } else {
            // CNPJ Novo - Atualiza cadastro existente
            if (body.empresaId) {
                await prisma.empresa.update({
                    where: { id: body.empresaId },
                    data: { documento: cnpjLimpo }
                });
                return NextResponse.json({ success: true, message: "CNPJ atualizado." });
            } else {
                return NextResponse.json({ error: "Empresa não encontrada. Crie uma nova." }, { status: 400 });
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
    if (e.code === 'P2002') return NextResponse.json({ error: "Conflito de dados." }, { status: 409 });
    return NextResponse.json({ error: e.message || 'Erro ao atualizar' }, { status: 500 });
  }
}