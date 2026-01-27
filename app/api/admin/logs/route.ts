import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    // 1. Verificação de Segurança (NOVO)
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorized();

    // Apenas Staff pode ver logs
    if (!['MASTER', 'ADMIN', 'SUPORTE_TI'].includes(user.role)) return forbidden();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const level = searchParams.get('level'); // INFO, WARN, ERRO
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    const where: any = {};
    if (level && level !== 'ALL') where.level = level;
    if (search) {
        where.OR = [
            { message: { contains: search } }, // Removido mode: insensitive para compatibilidade geral
            { action: { contains: search } }
        ];
    }

    const [logs, total] = await prisma.$transaction([
        prisma.systemLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: skip,
            include: { empresa: { select: { razaoSocial: true } } }
        }),
        prisma.systemLog.count({ where })
    ]);

    return NextResponse.json({
        data: logs,
        meta: { total, page, totalPages: Math.ceil(total / limit) }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar logs.' }, { status: 500 });
  }
}