import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

// ... (Suas funções helpers buscarIbgePorCep e consultarCNPJExterno continuam aqui) ...
async function buscarIbgePorCep(cep: string): Promise<string | null> {
    try {
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return null;
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();
        return (!data.erro && data.ibge) ? data.ibge : null;
    } catch (e) { return null; }
}

async function consultarCNPJExterno(cnpj: string) {
    const cepLimpo = cnpj.replace(/\D/g, '');
    try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cepLimpo}`, { timeout: 5000 } as any);
        if (res.ok) {
            const data = await res.json();
            return {
                razaoSocial: data.razao_social,
                nomeFantasia: data.nome_fantasia || data.razao_social,
                email: data.email,
                cep: data.cep,
                logradouro: data.logradouro,
                numero: data.numero,
                bairro: data.bairro,
                cidade: data.municipio,
                uf: data.uf,
                codigoIbge: data.codigo_municipio,
                cnaes: [{ codigo: String(data.cnae_fiscal), descricao: data.cnae_fiscal_descricao, principal: true }]
            };
        }
    } catch(e) {}
    return null;
}

// GET (Mantido)
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');

  try {
    if (mode === 'contador') {
        if (!['CONTADOR', 'MASTER', 'ADMIN'].includes(user.role)) return forbidden();
        const vinculos = await prisma.contadorVinculo.findMany({
            where: { contadorId: user.id },
            include: { empresa: true },
            orderBy: { updatedAt: 'desc' }
        });
        return NextResponse.json(vinculos);
    }
    if (mode === 'cliente') {
        if (!user.empresaId) return NextResponse.json([]);
        const solicitacoes = await prisma.contadorVinculo.findMany({
            where: { empresaId: user.empresaId, status: 'PENDENTE' },
            include: { contador: { select: { nome: true, email: true } } }
        });
        return NextResponse.json(solicitacoes);
    }
    return NextResponse.json([]);
  } catch (e) { return NextResponse.json({ error: 'Erro ao buscar vínculos' }, { status: 500 }); }
}

// POST (Mantido)
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'CONTADOR' && !['MASTER','ADMIN'].includes(user.role)) return NextResponse.json({ error: 'Apenas contadores.' }, { status: 403 });

  try {
    const { cnpj } = await request.json();
    const cnpjLimpo = cnpj.replace(/\D/g, '');

    const dadosContador = await prisma.user.findUnique({ where: { id: user.id }, include: { empresasContabeis: true } });
    if (dadosContador) {
        const limite = dadosContador.limiteEmpresas || 5; 
        if (dadosContador.empresasContabeis.length >= limite) return NextResponse.json({ error: `Limite atingido (${limite}).` }, { status: 403 });
    }

    const empresaExistente = await prisma.empresa.findUnique({ where: { documento: cnpjLimpo }, include: { donoUser: true } });
    if (empresaExistente) {
        const vinculo = await prisma.contadorVinculo.findUnique({ where: { contadorId_empresaId: { contadorId: user.id, empresaId: empresaExistente.id } } });
        if (vinculo) return NextResponse.json({ error: "Já vinculado." }, { status: 409 });
        const status = empresaExistente.donoUser ? 'PENDENTE' : 'APROVADO';
        await prisma.contadorVinculo.create({ data: { contadorId: user.id, empresaId: empresaExistente.id, status } });
        return NextResponse.json({ success: true, message: status === 'PENDENTE' ? 'Solicitação enviada.' : 'Vinculada!', status });
    }

    const dadosExternos = await consultarCNPJExterno(cnpjLimpo);
    let ibgeFinal = dadosExternos?.codigoIbge;
    if (!ibgeFinal && dadosExternos?.cep) ibgeFinal = await buscarIbgePorCep(dadosExternos.cep) || '';

    const novaEmpresa = await prisma.empresa.create({ 
        data: {
            documento: cnpjLimpo,
            razaoSocial: dadosExternos?.razaoSocial || `Empresa ${cnpjLimpo}`,
            nomeFantasia: dadosExternos?.nomeFantasia,
            cep: dadosExternos?.cep,
            codigoIbge: ibgeFinal,
            // ... (restante dos campos opcionais)
        } 
    });

    await prisma.contadorVinculo.create({ data: { contadorId: user.id, empresaId: novaEmpresa.id, status: 'APROVADO' } });
    return NextResponse.json({ success: true, message: 'Empresa criada e vinculada!', status: 'APROVADO' });
  } catch (e: any) { return NextResponse.json({ error: 'Erro: ' + e.message }, { status: 500 }); }
}

// PUT (Mantido)
export async function PUT(request: Request) {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorized();
    try {
        const { vinculoId, acao } = await request.json();
        const vinculo = await prisma.contadorVinculo.findUnique({ where: { id: vinculoId } });
        if (!vinculo || vinculo.empresaId !== user.empresaId) return forbidden();
        if (acao === 'REJEITAR') {
            await prisma.contadorVinculo.delete({ where: { id: vinculoId } });
            return NextResponse.json({ success: true, message: 'Recusado.' });
        }
        await prisma.contadorVinculo.update({ where: { id: vinculoId }, data: { status: 'APROVADO' } });
        return NextResponse.json({ success: true, message: 'Aprovado!' });
    } catch (e) { return NextResponse.json({ error: 'Erro interno.' }, { status: 500 }); }
}

// === NOVO: DELETE (Desvincular Empresa) ===
export async function DELETE(request: Request) {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorized();

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID necessário' }, { status: 400 });

        const vinculo = await prisma.contadorVinculo.findUnique({ where: { id } });
        if (!vinculo) return NextResponse.json({ error: 'Vínculo não encontrado' }, { status: 404 });

        // Só Admin ou o próprio contador podem deletar
        if (vinculo.contadorId !== user.id && !['MASTER', 'ADMIN'].includes(user.role)) {
            return forbidden();
        }

        await prisma.contadorVinculo.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Erro ao desvincular.' }, { status: 500 });
    }
}