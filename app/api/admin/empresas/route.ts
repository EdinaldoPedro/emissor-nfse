import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';

  const skip = (page - 1) * limit;

  const whereClause = search ? {
    OR: [
      { razaoSocial: { contains: search, mode: 'insensitive' } }, 
      { documento: { contains: search } }
    ]
  } : {};

  try {
    const [empresas, total] = await prisma.$transaction([
      prisma.empresa.findMany({
        where: whereClause,
        skip: skip,
        take: limit,
        include: { 
            donoUser: { 
                select: { nome: true, email: true }
            } 
        },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.empresa.count({ where: whereClause })
    ]);

    const dadosFormatados = empresas.map(emp => ({
        ...emp,
        donos: emp.donoUser ? [emp.donoUser] : [] 
    }));

    return NextResponse.json({
      data: dadosFormatados,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar empresas' }, { status: 500 });
  }
}

// PUT
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, donos, donoUser, ...dadosParaAtualizar } = body; 

    const updated = await prisma.empresa.update({
      where: { id: id },
      data: dadosParaAtualizar
    });
    
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao atualizar empresa.' }, { status: 500 });
  }
}

// === DELETE (NOVO) ===
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID necessário' }, { status: 400 });

    try {
        // 1. Desvincular Usuários (Dono) para não apagar o usuário, apenas soltar a empresa
        await prisma.user.updateMany({
            where: { empresaId: id },
            data: { empresaId: null }
        });

        // 2. Limpar Tabelas Dependentes (Cascade Manual para garantir)
        // Remove vínculos de clientes e contadores
        await prisma.userCliente.deleteMany({ where: { empresaId: id } });
        await prisma.contadorVinculo.deleteMany({ where: { empresaId: id } });
        
        // Remove Logs
        await prisma.systemLog.deleteMany({ where: { empresaId: id } });
        
        // Remove CNAEs
        await prisma.cnae.deleteMany({ where: { empresaId: id } });

        // Remove Notas e Vendas onde a empresa é PRESTADOR
        await prisma.notaFiscal.deleteMany({ where: { empresaId: id } });
        await prisma.venda.deleteMany({ where: { empresaId: id } });
        
        // 3. Finalmente deleta a empresa
        await prisma.empresa.delete({ where: { id } });

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error("Erro ao deletar empresa:", e);
        // Se falhar (ex: empresa é TOMADOR em notas de outros), avisa
        if (e.code === 'P2003') {
            return NextResponse.json({ error: 'Não é possível excluir: Esta empresa está vinculada como Tomador em notas de terceiros.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Erro interno ao excluir.' }, { status: 500 });
    }
}