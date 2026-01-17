import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  const contextId = request.headers.get('x-empresa-id');
  
  if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  
  // Filtros
  const search = searchParams.get('search') || '';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const incluirCanceladas = searchParams.get('incluirCanceladas') === 'true';

  try {
    // 1. Determina a Empresa
    const user = await prisma.user.findUnique({ where: { id: userId } });
    let empresaId = user?.empresaId;

    if (contextId && contextId !== 'null') {
       // Lógica simplificada de contexto (assumindo que o middleware/front já validou acesso)
       empresaId = contextId;
    }

    if (!empresaId) return NextResponse.json({ data: [], summary: {} });

    // 2. Monta Cláusula Where
    const whereClause: any = {
      empresaId,
      // Filtro de Status
      status: incluirCanceladas 
        ? { in: ['AUTORIZADA', 'CANCELADA'] } 
        : 'AUTORIZADA',
      
      // Filtro de Busca (Tomador ou Número)
      AND: [
        search ? {
            OR: [
                { tomadorCnpj: { contains: search } },
                { cliente: { razaoSocial: { contains: search, mode: 'insensitive' } } },
                // Se for número, tenta converter
                ...( !isNaN(Number(search)) ? [{ numero: Number(search) }] : [])
            ]
        } : {}
      ]
    };

    // Filtro de Data
    if (startDate && endDate) {
        const start = new Date(startDate); start.setHours(0,0,0,0);
        const end = new Date(endDate); end.setHours(23,59,59,999);
        whereClause.dataEmissao = { gte: start, lte: end };
    }

    // 3. Busca Paginada
    const skip = (page - 1) * limit;
    
    const [notas, total] = await prisma.$transaction([
        prisma.notaFiscal.findMany({
            where: whereClause,
            include: { cliente: { select: { razaoSocial: true } } },
            orderBy: { dataEmissao: 'desc' },
            skip,
            take: limit
        }),
        prisma.notaFiscal.count({ where: whereClause })
    ]);

    // 4. Calcula Resumo (Agregação)
    // Para o resumo, queremos saber o total das AUTORIZADAS no período, independente se o filtro mostra canceladas na tabela
    const whereClauseSummary = { ...whereClause };
    whereClauseSummary.status = 'AUTORIZADA'; // Resumo financeiro considera apenas o real faturado
    
    const summary = await prisma.notaFiscal.aggregate({
        where: whereClauseSummary,
        _sum: { valor: true },
        _count: { id: true }
    });

    const totalCanceladas = await prisma.notaFiscal.count({
        where: { ...whereClause, status: 'CANCELADA' }
    });

    return NextResponse.json({
        data: notas,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        },
        summary: {
            totalValor: summary._sum.valor || 0,
            qtdAutorizadas: summary._count.id || 0,
            qtdCanceladas: totalCanceladas,
            periodo: { start: startDate, end: endDate }
        }
    });

  } catch (e: any) {
      console.error(e);
      return NextResponse.json({ error: e.message }, { status: 500 });
  }
}