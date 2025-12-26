import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET (Listar)
export async function GET() {
  try {
    const total = await prisma.plan.count();
    // Seed automático (mantido do passo anterior...)
    if (total === 0) {
      await prisma.plan.createMany({
        data: [
          { name: 'Gratuito', slug: 'GRATUITO', description: 'Inicial', priceMonthly: 0, priceYearly: 0, features: 'Básico', active: true },
          { name: 'Profissional', slug: 'PRO', description: 'MEI', priceMonthly: 49.90, priceYearly: 499.00, features: 'Completo', recommended: true, active: true },
        ]
      });
    }
    const plans = await prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
    return NextResponse.json(plans);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar planos' }, { status: 500 });
  }
}

// POST (CRIAR NOVO PLANO) - ADICIONADO
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Gera um slug simples se não vier (Ex: "Super Plano" -> "SUPER_PLANO")
    const slugGerado = body.slug || body.name.toUpperCase().replace(/\s+/g, '_');

    const novo = await prisma.plan.create({
      data: {
        name: body.name,
        slug: slugGerado,
        description: body.description,
        priceMonthly: body.priceMonthly,
        priceYearly: body.priceYearly,
        features: body.features,
        active: body.active !== undefined ? body.active : true,
        recommended: body.recommended || false
      }
    });
    return NextResponse.json(novo, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao criar plano. Verifique se o Slug é único.' }, { status: 500 });
  }
}

// PUT (Atualizar)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    const updated = await prisma.plan.update({
      where: { id },
      data: data
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

// DELETE (Opcional: Excluir plano)
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if(id) {
        await prisma.plan.delete({ where: { id }});
        return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'ID necessário' }, { status: 400 });
}