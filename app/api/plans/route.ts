import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Lista planos (Com filtro de privacidade)
export async function GET(request: Request) {
  // 1. Verifica se é o Admin pedindo (via parametro na URL)
  const { searchParams } = new URL(request.url);
  const isVisaoAdmin = searchParams.get('visao') === 'admin';

  try {
    const total = await prisma.plan.count();
    
    // Seed automático (Mantido)
    if (total === 0) {
      await prisma.plan.createMany({
        data: [
          { name: 'Período de Avaliação', slug: 'TRIAL', description: 'Teste grátis por 7 dias', priceMonthly: 0, priceYearly: 0, features: 'Validade de 7 dias,Máximo 3 Emissões', active: true, maxNotasMensal: 3, diasTeste: 7, privado: true },
          { name: 'Parceiro', slug: 'PARCEIRO', description: 'Acesso total irrestrito', priceMonthly: 0, priceYearly: 0, features: 'Emissões Ilimitadas,Prioridade Total', active: true, maxNotasMensal: 0, diasTeste: 0, privado: true },
          { name: 'Plano Inicial', slug: 'INICIAL', description: 'Para quem está começando', priceMonthly: 24.99, priceYearly: 249.90, features: 'Até 5 Emissões/mês,Suporte por Email', active: true, maxNotasMensal: 5, diasTeste: 0, privado: false },
          { name: 'Plano Intermediário', slug: 'INTERMEDIARIO', description: 'Para pequenos negócios', priceMonthly: 45.99, priceYearly: 459.90, features: 'Até 15 Emissões/mês,Suporte WhatsApp', active: true, maxNotasMensal: 15, diasTeste: 0, privado: false },
          { name: 'Plano Livre', slug: 'LIVRE', description: 'Liberdade total', priceMonthly: 89.90, priceYearly: 899.00, features: 'Emissões Ilimitadas,Suporte VIP', active: true, maxNotasMensal: 0, diasTeste: 0, privado: false },
        ]
      });
    }

    // === O FILTRO MÁGICO ===
    // Se for admin, where é vazio (traz tudo).
    // Se for cliente, filtra onde privado = false E active = true
    const whereClause = isVisaoAdmin ? {} : { privado: false, active: true };

    const plans = await prisma.plan.findMany({
      where: whereClause, // Aplica o filtro aqui
      orderBy: { priceMonthly: 'asc' }
    });

    // Adiciona header para evitar cache antigo
    return NextResponse.json(plans, {
        headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar planos' }, { status: 500 });
  }
}

// POST: Criar novo plano manualmente
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validação básica
    if (!body.name || !body.slug) {
        return NextResponse.json({ error: 'Nome e Slug são obrigatórios' }, { status: 400 });
    }

    const novo = await prisma.plan.create({
      data: {
        name: body.name,
        slug: body.slug.toUpperCase().replace(/\s+/g, '_'),
        description: body.description,
        priceMonthly: parseFloat(body.priceMonthly) || 0,
        priceYearly: parseFloat(body.priceYearly) || 0,
        features: body.features || '',
        active: body.active !== undefined ? body.active : true,
        recommended: body.recommended || false,
        privado: body.privado || false,
        maxNotasMensal: parseInt(body.maxNotasMensal) || 0,
        diasTeste: parseInt(body.diasTeste) || 0
      }
    });

    return NextResponse.json(novo, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao criar plano' }, { status: 500 });
  }
}

// PUT: Editar plano existente
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
        diasTeste: parseInt(body.diasTeste)
      }
    });

    return NextResponse.json(atualizado);
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao atualizar plano' }, { status: 500 });
  }
}

// DELETE: Excluir plano
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

  try {
    // Verifica se tem histórico usando esse plano
    const uso = await prisma.planHistory.count({ where: { planId: id } });
    
    if (uso > 0) {
        return NextResponse.json({ error: 'Não é possível excluir: Existem usuários com histórico neste plano. Desative-o em vez de excluir.' }, { status: 409 });
    }

    await prisma.plan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao excluir plano' }, { status: 500 });
  }
}