import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isVisaoAdmin = searchParams.get('visao') === 'admin';

  try {
    const whereClause = isVisaoAdmin ? {} : { privado: false, active: true };
    const plans = await prisma.plan.findMany({
      where: whereClause,
      orderBy: { priceMonthly: 'asc' }
    });

    return NextResponse.json(plans, {
        headers: { 'Cache-Control': 'no-store, no-cache', 'Pragma': 'no-cache' }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar planos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.slug) return NextResponse.json({ error: 'Nome e Slug são obrigatórios' }, { status: 400 });

    const novo = await prisma.plan.create({
      data: {
        name: body.name,
        slug: body.slug.toUpperCase().replace(/\s+/g, '_'),
        description: body.description,
        priceMonthly: parseFloat(body.priceMonthly) || 0,
        priceYearly: parseFloat(body.priceYearly) || 0,
        features: body.features || '[]',
        active: body.active !== undefined ? body.active : true,
        recommended: body.recommended || false,
        privado: body.privado || false,
        maxNotasMensal: parseInt(body.maxNotasMensal) || 0,
        diasTeste: parseInt(body.diasTeste) || 0,
        maxClientes: parseInt(body.maxClientes) || 0,
        tipo: body.tipo || 'PLANO' // <--- SALVA O TIPO
      }
    });
    return NextResponse.json(novo, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    const atualizado = await prisma.plan.update({
      where: { id: body.id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        priceMonthly: parseFloat(body.priceMonthly),
        priceYearly: parseFloat(body.priceYearly),
        features: body.features,
        active: body.active,
        recommended: body.recommended,
        privado: body.privado,
        maxNotasMensal: parseInt(body.maxNotasMensal),
        diasTeste: parseInt(body.diasTeste),
        maxClientes: parseInt(body.maxClientes) || 0,
        tipo: body.tipo || 'PLANO' // <--- ATUALIZA O TIPO
      }
    });
    return NextResponse.json(atualizado);
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro: ' + e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

  try {
    const uso = await prisma.planHistory.count({ where: { planId: id } });
    if (uso > 0) return NextResponse.json({ error: 'Plano em uso. Desative-o.' }, { status: 409 });
    
    await prisma.plan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao excluir' }, { status: 500 });
  }
}