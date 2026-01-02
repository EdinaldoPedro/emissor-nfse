import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Lista vínculos
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode'); // 'contador' ou 'cliente'

  try {
    const user = await prisma.user.findUnique({ 
        where: { id: userId },
        include: { empresa: true }
    });

    // MODO CONTADOR: Lista empresas que eu atendo (ou pedi acesso)
    if (mode === 'contador') {
        const vinculos = await prisma.contadorVinculo.findMany({
            where: { contadorId: userId },
            include: { empresa: true },
            orderBy: { updatedAt: 'desc' }
        });
        return NextResponse.json(vinculos);
    }

    // MODO CLIENTE: Lista solicitações pendentes para MINHA empresa
    if (mode === 'cliente') {
        if (!user?.empresaId) return NextResponse.json([]);
        
        const solicitacoes = await prisma.contadorVinculo.findMany({
            where: { 
                empresaId: user.empresaId,
                status: 'PENDENTE' 
            },
            include: { contador: { select: { nome: true, email: true } } }
        });
        return NextResponse.json(solicitacoes);
    }

    return NextResponse.json([]);

  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar vínculos' }, { status: 500 });
  }
}

// POST: Contador solicita vínculo
export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  try {
    const { cnpj } = await request.json();
    const cnpjLimpo = cnpj.replace(/\D/g, '');

    // 1. Busca empresa
    const empresaAlvo = await prisma.empresa.findUnique({
        where: { documento: cnpjLimpo }
    });

    if (!empresaAlvo) {
        return NextResponse.json({ error: 'Empresa não encontrada no sistema.' }, { status: 404 });
    }

    // 2. Verifica se já existe vínculo
    const existente = await prisma.contadorVinculo.findUnique({
        where: {
            contadorId_empresaId: { contadorId: userId, empresaId: empresaAlvo.id }
        }
    });

    if (existente) {
        return NextResponse.json({ error: `Vínculo já existe (Status: ${existente.status})` }, { status: 409 });
    }

    // 3. Cria solicitação PENDENTE
    await prisma.contadorVinculo.create({
        data: {
            contadorId: userId,
            empresaId: empresaAlvo.id,
            status: 'PENDENTE'
        }
    });

    return NextResponse.json({ success: true, message: 'Solicitação enviada ao cliente!' });

  } catch (e) {
    return NextResponse.json({ error: 'Erro ao solicitar.' }, { status: 500 });
  }
}

// PUT: Cliente aprova/rejeita
export async function PUT(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  try {
    const { vinculoId, acao } = await request.json(); // acao: 'APROVAR' | 'REJEITAR'
    
    // Verifica se o usuário é dono da empresa do vínculo
    const user = await prisma.user.findUnique({ 
        where: { id: userId }, 
        include: { empresa: true } 
    });

    const vinculo = await prisma.contadorVinculo.findUnique({ where: { id: vinculoId } });

    if (!vinculo || vinculo.empresaId !== user?.empresaId) {
        return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    }

    if (acao === 'REJEITAR') {
        await prisma.contadorVinculo.delete({ where: { id: vinculoId } });
        return NextResponse.json({ success: true, message: 'Solicitação recusada.' });
    }

    await prisma.contadorVinculo.update({
        where: { id: vinculoId },
        data: { status: 'APROVADO' }
    });

    return NextResponse.json({ success: true, message: 'Contador vinculado com sucesso!' });

  } catch (e) {
    return NextResponse.json({ error: 'Erro ao processar.' }, { status: 500 });
  }
}