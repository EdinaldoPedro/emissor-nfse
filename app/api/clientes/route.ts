import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
import { checkPlanLimits } from '@/app/services/planService';
import { validateRequest } from "@/app/utils/api-security";

const prisma = new PrismaClient();

// === NOVA INTELIGÊNCIA: AUTO-BUSCA DE IBGE ===
async function buscarIbgePorCep(cep: string): Promise<string | null> {
    try {
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return null;
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, { next: { revalidate: 3600 } });
        const data = await res.json();
        if (!data.erro && data.ibge) return data.ibge;
        return null;
    } catch (e) {
        return null;
    }
}

async function getEmpresaContexto(user: any, contextId: string | null) {
    const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role);
    if (contextId && contextId !== 'null' && contextId !== 'undefined') {
        if (isStaff) return contextId;
        if (contextId === user.empresaId) return contextId;

        const colaborador = await prisma.userCliente.findUnique({
            where: { userId_empresaId: { userId: user.id, empresaId: contextId } }
        });
        if (colaborador) return contextId;

        const vinculo = await prisma.contadorVinculo.findUnique({
            where: { contadorId_empresaId: { contadorId: user.id, empresaId: contextId } }
        });
        if (vinculo && vinculo.status === 'APROVADO') return contextId;
        
        const empresaAdicional = await prisma.empresa.findFirst({
            where: { id: contextId, donoFaturamentoId: user.id }
        });
        if (empresaAdicional) return contextId;

        return null; 
    }
    return user.empresaId;
}

export async function GET(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;
    
    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

    const contextId = request.headers.get('x-empresa-id');
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    try {
        const empresaIdAlvo = await getEmpresaContexto(user, contextId);
        if (!empresaIdAlvo) return NextResponse.json({ data: [], meta: { total: 0 } });

        const whereClause = {
            vinculos: { some: { empresaId: empresaIdAlvo } },
            ...(search && {
                OR: [
                    { nome: { contains: search, mode: 'insensitive' as const } },
                    { documento: { contains: search } },
                    { email: { contains: search, mode: 'insensitive' as const } }
                ]
            })
        };

        const skip = (page - 1) * limit;

        const [clientes, total] = await prisma.$transaction([
            prisma.cliente.findMany({
                where: whereClause,
                skip: skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: { _count: { select: { vendas: true } } }
            }),
            prisma.cliente.count({ where: whereClause })
        ]);

        const dadosFormatados = clientes.map((c: any) => ({
            ...c, vendas: c._count?.vendas || 0, _count: undefined
        }));

        return NextResponse.json({
            data: dadosFormatados,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (error: any) {
        return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

    const contextId = request.headers.get('x-empresa-id');
    const body = await request.json();

    try {
        const empresaIdAlvo = await getEmpresaContexto(user, contextId);
        if (!empresaIdAlvo) return NextResponse.json({ error: 'Acesso negado a esta empresa' }, { status: 403 });

        const prestador = await prisma.empresa.findUnique({ where: { id: empresaIdAlvo } });
        if (!prestador) throw new Error("Empresa não encontrada.");

        let donoFaturamentoId = prestador.donoFaturamentoId;
        if (!donoFaturamentoId) {
            const donoEmpresa = await prisma.user.findFirst({
                where: { empresaId: empresaIdAlvo, role: { notIn: ['CONTADOR', 'SUPORTE', 'SUPORTE_TI'] } },
                orderBy: { createdAt: 'asc' }
            });
            if (donoEmpresa) donoFaturamentoId = donoEmpresa.id;
        }

        if (donoFaturamentoId) {
            const planCheck = await checkPlanLimits(donoFaturamentoId, 'CADASTRAR_CLIENTE' as any);
            if (!planCheck.allowed) return NextResponse.json({ error: "Limite de clientes atingido.", code: planCheck.status }, { status: 403 });
        }

        const docLimpo = body.documento ? body.documento.replace(/\D/g, '') : '';
        const cepLimpo = body.cep ? body.cep.replace(/\D/g, '') : null;

        // === 1. FORÇA O TIPO CORRETO ===
        let tipoFinal = body.tipo;
        if (!tipoFinal || tipoFinal === 'J' || tipoFinal === 'F' || tipoFinal === 'j' || tipoFinal === 'f') {
            tipoFinal = docLimpo.length === 11 ? 'PF' : (docLimpo.length === 14 ? 'PJ' : 'EXT');
        }

        // === 2. RECUPERA IBGE FALTANTE ===
        let codigoIbgeFinal = body.codigoIbge;
        if (cepLimpo && (!codigoIbgeFinal || codigoIbgeFinal.length < 7)) {
            const ibgeEncontrado = await buscarIbgePorCep(cepLimpo);
            if (ibgeEncontrado) codigoIbgeFinal = ibgeEncontrado;
        }

        // 3. BUSCA O CLIENTE GLOBALMENTE NO BANCO
        const clienteGlobal = await prisma.cliente.findUnique({
            where: { documento: docLimpo },
            include: { vinculos: { where: { empresaId: empresaIdAlvo } } }
        });

        if (clienteGlobal) {
            if (clienteGlobal.vinculos && clienteGlobal.vinculos.length > 0) {
                return NextResponse.json({ error: 'Já existe um cliente com este CPF/CNPJ na sua carteira.' }, { status: 400 });
            }

            // Atualiza tipo se estiver errado na base antiga e vincula
            const clienteVinculado = await prisma.cliente.update({
                where: { id: clienteGlobal.id },
                data: {
                    tipo: tipoFinal,
                    ...(codigoIbgeFinal && (!clienteGlobal.codigoIbge || clienteGlobal.codigoIbge.length < 7) ? { codigoIbge: codigoIbgeFinal } : {}),
                    vinculos: { create: { empresaId: empresaIdAlvo } }
                }
            });

            await createLog({ level: 'INFO', action: 'CLIENTE_VINCULADO', message: `Cliente ${clienteVinculado.nome} vinculado à sua carteira.`, empresaId: empresaIdAlvo });
            return NextResponse.json({ success: true, cliente: clienteVinculado }, { status: 201 });
        }

        // 4. SE NÃO EXISTE GLOBALMENTE, CRIA DO ZERO BLINDADO
        const novoCliente = await prisma.cliente.create({
            data: {
                nome: body.nome,
                documento: docLimpo,
                tipo: tipoFinal,
                email: body.email || null,
                telefone: body.telefone ? body.telefone.replace(/\D/g, '') : null,
                cep: cepLimpo,
                logradouro: body.logradouro || null,
                numero: body.numero || null,
                complemento: body.complemento || null,
                bairro: body.bairro || null,
                cidade: body.cidade || null,
                uf: body.uf || null,
                codigoIbge: codigoIbgeFinal,
                inscricaoMunicipal: body.inscricaoMunicipal || null,
                inscricaoEstadual: body.inscricaoEstadual || null,
                nif: body.nif || null,
                pais: body.pais || 'Brasil',
                moeda: body.moeda || 'BRL',
                vinculos: { create: { empresaId: empresaIdAlvo } }
            }
        });

        await createLog({ level: 'INFO', action: 'CLIENTE_CRIADO', message: `Cliente ${novoCliente.nome} adicionado.`, empresaId: empresaIdAlvo });
        return NextResponse.json({ success: true, cliente: novoCliente }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Erro ao salvar cliente.' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

    const contextId = request.headers.get('x-empresa-id');
    const body = await request.json();
    const { id, ...dadosAtualizacao } = body;

    try {
        const empresaIdAlvo = await getEmpresaContexto(user, contextId);
        if (!empresaIdAlvo) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

        const clienteAtual = await prisma.cliente.findFirst({
            where: { id: id, vinculos: { some: { empresaId: empresaIdAlvo } } }
        });

        if (!clienteAtual) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });

        if (dadosAtualizacao.documento) {
            dadosAtualizacao.documento = dadosAtualizacao.documento.replace(/\D/g, '');
            // Força a atualização do tipo se estiver errado
            if (!dadosAtualizacao.tipo || dadosAtualizacao.tipo === 'J' || dadosAtualizacao.tipo === 'F') {
                dadosAtualizacao.tipo = dadosAtualizacao.documento.length === 11 ? 'PF' : 'PJ';
            }
        }
        
        if (dadosAtualizacao.telefone) dadosAtualizacao.telefone = dadosAtualizacao.telefone.replace(/\D/g, '');
        
        if (dadosAtualizacao.cep) {
            dadosAtualizacao.cep = dadosAtualizacao.cep.replace(/\D/g, '');
            // Auto-recupera IBGE no PUT se tiver vindo vazio
            if (!dadosAtualizacao.codigoIbge || dadosAtualizacao.codigoIbge.length < 7) {
                const ibgeEncontrado = await buscarIbgePorCep(dadosAtualizacao.cep);
                if (ibgeEncontrado) dadosAtualizacao.codigoIbge = ibgeEncontrado;
            }
        }
        
        if ('exterior' in dadosAtualizacao) delete dadosAtualizacao.exterior;

        if (dadosAtualizacao.documento && dadosAtualizacao.documento !== clienteAtual.documento) {
             const clienteGlobalExistente = await prisma.cliente.findUnique({ where: { documento: dadosAtualizacao.documento } });
            if (clienteGlobalExistente) return NextResponse.json({ error: 'Este CPF/CNPJ já pertence a outro cadastro no sistema global.' }, { status: 400 });
        }

        const clienteAtualizado = await prisma.cliente.update({
            where: { id: id },
            data: dadosAtualizacao
        });

        return NextResponse.json({ success: true, cliente: clienteAtualizado });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Erro ao atualizar.' }, { status: 500 });
    }
}