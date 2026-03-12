import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
import { checkPlanLimits } from '@/app/services/planService';
import { validateRequest } from "@/app/utils/api-security";

const prisma = new PrismaClient();

async function getEmpresaContexto(user: any, contextId: string | null) {
    const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role);
    if (contextId && contextId !== 'null' && contextId !== 'undefined') {
        if (isStaff) return contextId;
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
            vinculos: {
                some: { empresaId: empresaIdAlvo }
            },
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
            ...c,
            vendas: c._count?.vendas || 0,
            _count: undefined
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
            if (!planCheck.allowed) {
                return NextResponse.json({ 
                    error: "Limite de clientes atingido.", 
                    code: planCheck.status 
                }, { status: 403 });
            }
        }

        const docLimpo = body.documento.replace(/\D/g, '');

        const clienteExiste = await prisma.cliente.findFirst({
            where: { 
                documento: docLimpo,
                vinculos: { some: { empresaId: empresaIdAlvo } }
            }
        });

        if (clienteExiste) {
            return NextResponse.json({ error: 'Já existe um cliente com este CPF/CNPJ nesta empresa.' }, { status: 400 });
        }

        const novoCliente = await prisma.cliente.create({
            data: {
                nome: body.nome,
                documento: docLimpo,
                tipo: docLimpo.length === 11 ? 'F' : (docLimpo.length === 14 ? 'J' : 'E'),
                email: body.email || null,
                telefone: body.telefone ? body.telefone.replace(/\D/g, '') : null,
                cep: body.cep ? body.cep.replace(/\D/g, '') : null,
                logradouro: body.logradouro || null,
                numero: body.numero || null,
                complemento: body.complemento || null,
                bairro: body.bairro || null,
                cidade: body.cidade || null,
                uf: body.uf || null,
                codigoIbge: body.codigoIbge || null,
                inscricaoMunicipal: body.inscricaoMunicipal || null,
                inscricaoEstadual: body.inscricaoEstadual || null,
                nif: body.nif || null,
                pais: body.pais || 'Brasil', // Ajustado para bater com o schema
                moeda: body.moeda || 'BRL',
                vinculos: {
                    create: {
                        empresaId: empresaIdAlvo
                    }
                }
            }
        });

        await createLog({
            level: 'INFO', action: 'CLIENTE_CRIADO', message: `Cliente ${novoCliente.nome} adicionado.`,
            empresaId: empresaIdAlvo
        });

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
            where: { 
                id: id, 
                vinculos: { some: { empresaId: empresaIdAlvo } } 
            }
        });

        if (!clienteAtual) {
            return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
        }

        if (dadosAtualizacao.documento) dadosAtualizacao.documento = dadosAtualizacao.documento.replace(/\D/g, '');
        if (dadosAtualizacao.telefone) dadosAtualizacao.telefone = dadosAtualizacao.telefone.replace(/\D/g, '');
        if (dadosAtualizacao.cep) dadosAtualizacao.cep = dadosAtualizacao.cep.replace(/\D/g, '');
        
        // Remove a propriedade 'exterior' se ela vier no body da atualização também, para evitar o mesmo erro
        if ('exterior' in dadosAtualizacao) {
            delete dadosAtualizacao.exterior;
        }

        if (dadosAtualizacao.documento && dadosAtualizacao.documento !== clienteAtual.documento) {
             const clienteExiste = await prisma.cliente.findFirst({
                where: { 
                    documento: dadosAtualizacao.documento,
                    vinculos: { some: { empresaId: empresaIdAlvo } }
                }
            });
            if (clienteExiste) return NextResponse.json({ error: 'Já existe outro cliente com este CPF/CNPJ nesta empresa.' }, { status: 400 });
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