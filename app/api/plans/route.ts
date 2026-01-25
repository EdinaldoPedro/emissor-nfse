import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Força o Next.js a não cachear estaticamente esta rota
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const prisma = new PrismaClient();

// GET: Lista planos
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isVisaoAdmin = searchParams.get('visao') === 'admin';

  try {
    const total = await prisma.plan.count();
    
    // Seed Seguro: Só roda se o banco estiver VAZIO
    if (total === 0) {
      await prisma.plan.createMany({
        data: [
          { name: 'Período de Avaliação', slug: 'TRIAL', description: 'Teste grátis por 7 dias', priceMonthly: 0, priceYearly: 0, features: 'Validade de 7 dias,Máximo 3 Emissões,Suporte Básico', active: true, maxNotasMensal: 3, diasTeste: 7, privado: true },
          { name: 'Parceiro', slug: 'PARCEIRO', description: 'Acesso total irrestrito', priceMonthly: 0, priceYearly: 0, features: 'Emissões Ilimitadas,Prioridade Total,API Liberada', active: true, maxNotasMensal: 0, diasTeste: 0, privado: true },
          { name: 'Plano Inicial', slug: 'INICIAL', description: 'Para quem está começando', priceMonthly: 24.99, priceYearly: 249.90, features: 'Até 5 Emissões/mês,Suporte por Email', active: true, maxNotasMensal: 5, diasTeste: 0, privado: false },
          { name: 'Plano Intermediário', slug: 'INTERMEDIARIO', description: 'Para pequenos negócios', priceMonthly: 45.99, priceYearly: 459.90, features: 'Até 15 Emissões/mês,Suporte WhatsApp', active: true, maxNotasMensal: 15, diasTeste: 0, privado: false },
          { name: 'Plano Livre', slug: 'LIVRE', description: 'Liberdade total', priceMonthly: 89.90, priceYearly: 899.00, features: 'Emissões Ilimitadas,Suporte VIP', active: true, maxNotasMensal: 0, diasTeste: 0, privado: false },
        ]
      });
    }

    const whereClause = isVisaoAdmin ? {} : { privado: false, active: true };

    const plans = await prisma.plan.findMany({
      where: whereClause,
      orderBy: { priceMonthly: 'asc' }
    });

    // === A CORREÇÃO ESTÁ AQUI ===
    // Adiciona cabeçalhos HTTP que proíbem o navegador de guardar cópia
    return NextResponse.json(plans, {
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
        }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar planos' }, { status: 500 });
  }
}

// POST: Criar
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
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
    return NextResponse.json({ error: e.message || 'Erro ao criar' }, { status: 500 });
  }
}

// PUT: Editar
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
    return NextResponse.json({ error: 'Erro ao atualizar plano: ' + e.message }, { status: 500 });
  }
}

// DELETE: Excluir
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

  try {
    // Verifica se o plano já foi usado por algum cliente (Histórico)
    const uso = await prisma.planHistory.count({ where: { planId: id } });
    
    if (uso > 0) {
        // Se já foi usado, não podemos deletar pois quebraria o histórico dos clientes.
        // A solução é desativar o plano em vez de excluir.
        return NextResponse.json({ 
            error: 'Este plano possui histórico de uso e não pode ser excluído. Edite o plano e desmarque a opção "Ativo" para escondê-lo.' 
        }, { status: 409 });
    }

    await prisma.plan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao excluir plano' }, { status: 500 });
  }
}