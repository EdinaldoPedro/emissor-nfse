import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Busca apenas planos ATIVOS para exibir na vitrine
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { priceMonthly: 'asc' }
    });

    return NextResponse.json(plans);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar planos' }, { status: 500 });
  }
}