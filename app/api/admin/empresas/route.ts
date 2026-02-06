import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

// GET: Lista Empresas (Emissores) ou Clientes (Tomadores Globais)
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  if (!['MASTER', 'ADMIN'].includes(user.role)) return forbidden();

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const type = searchParams.get('type') || 'PRESTADOR'; // 'PRESTADOR' | 'TOMADOR'

  const skip = (page - 1) * limit;

  try {
    let data = [];
    let total = 0;

    if (type === 'TOMADOR') {
        // === MODO TOMADOR: Busca Global na Tabela CLIENTE ===
        // Agora buscamos DIRETO na tabela Cliente, pois ela é global
        const whereClause: any = search ? {
            OR: [
                { nome: { contains: search, mode: 'insensitive' } },
                { documento: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } }
            ]
        } : {};

        const [clientes, count] = await prisma.$transaction([
            prisma.cliente.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: { 
                    // Mostra quantos vínculos este cliente tem (Quantas empresas o atendem)
                    _count: { select: { vinculos: true } },
                    // Opcional: Traz o primeiro vínculo para exibir "Ex: Vinculado a X"
                    vinculos: {
                        take: 1,
                        include: { empresa: { select: { razaoSocial: true, documento: true } } }
                    }
                },
                orderBy: { nome: 'asc' }
            }),
            prisma.cliente.count({ where: whereClause })
        ]);

        data = clientes.map(c => ({
            ...c,
            id: c.id,
            razaoSocial: c.nome, // Padroniza nome para a tabela visual
            documento: c.documento,
            origem: 'TOMADOR',
            // Mostra a primeira empresa vinculada como referência visual
            vinculo: c.vinculos[0]?.empresa || null,
            totalVinculos: c._count.vinculos
        }));
        total = count;

    } else {
        // === MODO PRESTADOR: Busca na tabela EMPRESA (Seus Assinantes) ===
        const whereClause: any = search ? {
            OR: [
                { razaoSocial: { contains: search, mode: 'insensitive' } }, 
                { documento: { contains: search } },
                { donoUser: { nome: { contains: search, mode: 'insensitive' } } },
                { donoUser: { email: { contains: search, mode: 'insensitive' } } }
            ]
        } : {};

        const [empresas, count] = await prisma.$transaction([
            prisma.empresa.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: { 
                    donoUser: { select: { nome: true, email: true } }
                },
                orderBy: { updatedAt: 'desc' }
            }),
            prisma.empresa.count({ where: whereClause })
        ]);

        data = empresas.map(emp => ({
            ...emp,
            origem: 'PRESTADOR',
            donos: emp.donoUser ? [emp.donoUser] : [] 
        }));
        total = count;
    }

    return NextResponse.json({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Erro API Admin Empresas:", error);
    return NextResponse.json({ error: 'Erro ao buscar dados.' }, { status: 500 });
  }
}

// PUT: Edita cadastro (Unificado)
export async function PUT(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) return forbidden();

  try {
    const body = await request.json();
    const { id, origem, ...dados } = body; 

    // Limpeza de campos relacionais/virtuais
    const cleanData = { ...dados };
    delete cleanData.vinculo;
    delete cleanData.vinculos;
    delete cleanData.totalVinculos;
    delete cleanData.donos;
    delete cleanData.donoUser;
    delete cleanData._count;
    delete cleanData.qtdNotas;

    if (origem === 'TOMADOR') {
        if (cleanData.razaoSocial) {
            cleanData.nome = cleanData.razaoSocial;
            delete cleanData.razaoSocial;
        }
        delete cleanData.nomeFantasia; 
        
        const updated = await prisma.cliente.update({
            where: { id },
            data: cleanData
        });
        return NextResponse.json(updated);
    } else {
        const updated = await prisma.empresa.update({
            where: { id },
            data: cleanData
        });
        return NextResponse.json(updated);
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao atualizar: ' + e.message }, { status: 500 });
  }
}

// DELETE: Excluir (Unificado)
export async function DELETE(request: Request) {
    const user = await getAuthenticatedUser(request);
    if (!user || !['MASTER', 'ADMIN'].includes(user.role)) return forbidden();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'PRESTADOR'; 

    if (!id) return NextResponse.json({ error: 'ID necessário' }, { status: 400 });

    try {
        if (type === 'TOMADOR') {
            // Apaga Cliente Global e seus Vínculos
            // Atenção: Apagar cliente apaga notas vinculadas se o banco não tiver cascade.
            await prisma.notaFiscal.deleteMany({ where: { clienteId: id } });
            await prisma.venda.deleteMany({ where: { clienteId: id } });
            
            // Apaga vínculos da carteira primeiro (embora o cascade do banco deva cuidar disso)
            await prisma.vinculoCarteira.deleteMany({ where: { clienteId: id } });
            
            await prisma.cliente.delete({ where: { id } });
        } else {
            // Apaga Prestador (Empresa Assinante)
            await prisma.user.updateMany({ where: { empresaId: id }, data: { empresaId: null } });
            await prisma.userCliente.deleteMany({ where: { empresaId: id } });
            await prisma.contadorVinculo.deleteMany({ where: { empresaId: id } });
            await prisma.systemLog.deleteMany({ where: { empresaId: id } });
            await prisma.cnae.deleteMany({ where: { empresaId: id } });
            await prisma.notaFiscal.deleteMany({ where: { empresaId: id } });
            await prisma.venda.deleteMany({ where: { empresaId: id } });
            await prisma.vinculoCarteira.deleteMany({ where: { empresaId: id } }); // Limpa carteira dele
            
            await prisma.empresa.delete({ where: { id } });
        }
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: 'Erro ao excluir.' }, { status: 500 });
    }
}