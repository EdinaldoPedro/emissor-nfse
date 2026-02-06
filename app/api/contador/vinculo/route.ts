import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

// === HELPER: BUSCA IBGE SECUNDÁRIA ===
async function buscarIbgePorCep(cep: string): Promise<string | null> {
    try {
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return null;
        
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();
        
        if (!data.erro && data.ibge) {
            return data.ibge;
        }
        return null;
    } catch (e) {
        return null;
    }
}

// === HELPER: CONSULTA EXTERNA ===
async function consultarCNPJExterno(cnpj: string) {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    // 1. Tenta BrasilAPI
    try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, { timeout: 5000 } as any);
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
                codigoIbge: data.codigo_municipio, // BrasilAPI costuma ter
                cnaes: [
                    { codigo: String(data.cnae_fiscal), descricao: data.cnae_fiscal_descricao, principal: true },
                    ...(data.cnaes_secundarios || []).map((c: any) => ({ codigo: String(c.codigo), descricao: c.descricao, principal: false }))
                ]
            };
        }
    } catch (e) { console.log("BrasilAPI falhou."); }

    // 2. Fallback: ReceitaWS
    try {
        const res = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpjLimpo}`, { timeout: 5000 } as any);
        if (res.ok) {
            const data = await res.json();
            if (data.status !== 'ERROR') {
                return {
                    razaoSocial: data.nome,
                    nomeFantasia: data.fantasia || data.nome,
                    email: data.email,
                    cep: data.cep?.replace(/\D/g, ''),
                    logradouro: data.logradouro,
                    numero: data.numero,
                    bairro: data.bairro,
                    cidade: data.municipio,
                    uf: data.uf,
                    codigoIbge: null, // ReceitaWS NÃO TEM IBGE CONFIÁVEL
                    cnaes: [
                         ...(data.atividade_principal || []).map((c: any) => ({ codigo: c.code.replace(/\D/g,''), descricao: c.text, principal: true })),
                         ...(data.atividades_secundarias || []).map((c: any) => ({ codigo: c.code.replace(/\D/g,''), descricao: c.text, principal: false }))
                    ]
                };
            }
        }
    } catch (e) { console.log("ReceitaWS falhou."); }

    return null;
}

// GET: Lista vínculos (Mantido)
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
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar vínculos' }, { status: 500 });
  }
}

// POST: Cadastro Simplificado
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  if (user.role !== 'CONTADOR' && !['MASTER','ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Apenas contadores.' }, { status: 403 });
  }

  try {
    const { cnpj } = await request.json();
    const cnpjLimpo = cnpj.replace(/\D/g, '');

    // 1. Limite
    const dadosContador = await prisma.user.findUnique({
        where: { id: user.id },
        include: { empresasContabeis: true }
    });
    if (dadosContador) {
        const limite = dadosContador.limiteEmpresas || 5; 
        if (dadosContador.empresasContabeis.length >= limite) {
            return NextResponse.json({ error: `Limite atingido (${limite}).` }, { status: 403 });
        }
    }

    // 2. Verifica Existência
    const empresaExistente = await prisma.empresa.findUnique({
        where: { documento: cnpjLimpo },
        include: { donoUser: true }
    });

    if (empresaExistente) {
        const vinculo = await prisma.contadorVinculo.findUnique({
            where: { contadorId_empresaId: { contadorId: user.id, empresaId: empresaExistente.id } }
        });
        if (vinculo) return NextResponse.json({ error: "Já vinculado." }, { status: 409 });

        const status = empresaExistente.donoUser ? 'PENDENTE' : 'APROVADO';
        await prisma.contadorVinculo.create({
            data: { contadorId: user.id, empresaId: empresaExistente.id, status }
        });

        return NextResponse.json({ 
            success: true, 
            message: status === 'PENDENTE' ? 'Solicitação enviada ao dono.' : 'Empresa vinculada!',
            status 
        });
    }

    // === 3. CRIAR EMPRESA ===
    const dadosExternos = await consultarCNPJExterno(cnpjLimpo);
    
    // CORREÇÃO CRÍTICA: Se não veio IBGE mas veio CEP, busca no ViaCEP
    let ibgeFinal = dadosExternos?.codigoIbge;
    if (!ibgeFinal && dadosExternos?.cep) {
        console.log("IBGE não encontrado na Receita. Buscando no ViaCEP...");
        ibgeFinal = await buscarIbgePorCep(dadosExternos.cep) || '';
    }

    const dadosCriacao: any = {
        documento: cnpjLimpo,
        razaoSocial: dadosExternos?.razaoSocial || `Empresa ${cnpjLimpo}`,
        nomeFantasia: dadosExternos?.nomeFantasia,
        cep: dadosExternos?.cep,
        logradouro: dadosExternos?.logradouro,
        numero: dadosExternos?.numero,
        bairro: dadosExternos?.bairro,
        cidade: dadosExternos?.cidade,
        uf: dadosExternos?.uf,
        codigoIbge: ibgeFinal, // Agora vai preenchido!
        email: dadosExternos?.email
    };

    if (dadosExternos?.cnaes && dadosExternos.cnaes.length > 0) {
        dadosCriacao.atividades = {
            create: dadosExternos.cnaes.map((c: any) => ({
                codigo: c.codigo,
                descricao: c.descricao,
                principal: c.principal
            }))
        };
    }

    const novaEmpresa = await prisma.empresa.create({ data: dadosCriacao });

    await prisma.contadorVinculo.create({
        data: {
            contadorId: user.id,
            empresaId: novaEmpresa.id,
            status: 'APROVADO'
        }
    });

    return NextResponse.json({ 
        success: true, 
        message: 'Empresa cadastrada e vinculada com sucesso!',
        status: 'APROVADO'
    });

  } catch (e: any) {
    return NextResponse.json({ error: 'Erro ao processar: ' + e.message }, { status: 500 });
  }
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