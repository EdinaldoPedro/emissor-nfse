import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { upsertEmpresaAndLinkUser } from "../../services/empresaService";
import { validateRequest } from '@/app/utils/api-security';

const prisma = new PrismaClient();

// === HELPER: BUSCA IBGE NO BACKEND (SEGURANÇA) ===
async function buscarIbgePorCep(cep: string): Promise<string | null> {
    try {
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return null;
        
        // Busca no ViaCEP
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, { next: { revalidate: 3600 } });
        const data = await res.json();
        
        if (!data.erro && data.ibge) {
            return data.ibge;
        }
        return null;
    } catch (e) {
        console.error("Erro ao buscar IBGE (Backend):", e);
        return null;
    }
}

// Função Auxiliar de Segurança e Contexto
async function getEmpresaContexto(userId: string, contextId: string | null) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    if (!contextId || contextId === 'null' || contextId === 'undefined') return user.empresaId;

    const vinculo = await prisma.contadorVinculo.findUnique({
        where: { contadorId_empresaId: { contadorId: userId, empresaId: contextId } }
    });

    if (vinculo && vinculo.status === 'APROVADO') {
        return contextId; 
    }

    return null; 
}

// GET: Lista de Clientes
export async function GET(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    try {
        const userId = targetId;
        const contextId = request.headers.get('x-empresa-id'); 

        const empresaId = await getEmpresaContexto(userId, contextId);
        if (!empresaId) return NextResponse.json([], { status: 200 });

        const clientes = await prisma.userCliente.findMany({
            where: { userId: empresaId },
            include: { empresa: true }
        });

        const formatted = clientes.map(c => ({
            id: c.empresa.id,
            nome: c.empresa.razaoSocial,
            nomeFantasia: c.empresa.nomeFantasia,
            documento: c.empresa.documento,
            email: c.empresa.email,
            cep: c.empresa.cep,
            logradouro: c.empresa.logradouro,
            numero: c.empresa.numero,
            bairro: c.empresa.bairro,
            cidade: c.empresa.cidade,
            uf: c.empresa.uf,
            codigoIbge: c.empresa.codigoIbge, // Confirmação visual
            inscricaoMunicipal: c.empresa.inscricaoMunicipal
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Erro ao buscar clientes.' }, { status: 500 });
    }
}

// POST: Criar Novo Cliente
export async function POST(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    try {
        const userId = targetId;
        const contextId = request.headers.get('x-empresa-id');
        const body = await request.json();

        const empresaIdDono = await getEmpresaContexto(userId, contextId);
        if (!empresaIdDono) return NextResponse.json({ error: 'Empresa não identificada.' }, { status: 400 });

        // === BLINDAGEM DO IBGE ===
        if (body.cep && (!body.codigoIbge || body.codigoIbge.length < 7)) {
            console.log(`🛡️ Backend: Detectada falta de IBGE para CEP ${body.cep}. Corrigindo...`);
            const ibgeResgatado = await buscarIbgePorCep(body.cep);
            if (ibgeResgatado) {
                body.codigoIbge = ibgeResgatado;
            }
        }
        
        // CORREÇÃO AQUI: Passamos os 3 argumentos na ordem que o service espera
        // 1. Documento (para limpar e buscar na receita se precisar)
        // 2. ID do Dono (para vincular)
        // 3. O Body Completo (onde injetamos o IBGE manual)
        const clienteCriado = await upsertEmpresaAndLinkUser(
            body.documento, 
            empresaIdDono, 
            {
                ...body,
                aliquotaPadrao: 0,
                issRetidoPadrao: false
            }
        );

        return NextResponse.json(clienteCriado, { status: 201 });

    } catch (error: any) {
        console.error("Erro ao criar cliente:", error);
        return NextResponse.json({ error: error.message || 'Erro ao cadastrar cliente.' }, { status: 500 });
    }
}

// PUT: Atualizar Cliente
export async function PUT(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    try {
        const userId = targetId;
        const contextId = request.headers.get('x-empresa-id');
        const body = await request.json();

        if (!body.id) return NextResponse.json({ error: 'ID do cliente necessário.' }, { status: 400 });

        const empresaIdDono = await getEmpresaContexto(userId, contextId);
        if (!empresaIdDono) return NextResponse.json({ error: 'Permissão negada.' }, { status: 403 });

        const vinculo = await prisma.userCliente.findFirst({
            where: { userId: empresaIdDono, empresaId: body.id }
        });

        if (!vinculo) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });

        // === BLINDAGEM DO IBGE NA EDIÇÃO ===
        if (body.cep && (!body.codigoIbge || body.codigoIbge.length < 7)) {
            const ibgeResgatado = await buscarIbgePorCep(body.cep);
            if (ibgeResgatado) body.codigoIbge = ibgeResgatado;
        }

        const updated = await prisma.empresa.update({
            where: { id: body.id },
            data: {
                razaoSocial: body.nome || body.razaoSocial,
                nomeFantasia: body.nomeFantasia,
                inscricaoMunicipal: body.inscricaoMunicipal,
                email: body.email,
                cep: body.cep,
                logradouro: body.logradouro,
                numero: body.numero,
                complemento: body.complemento,
                bairro: body.bairro,
                cidade: body.cidade,
                uf: body.uf,
                codigoIbge: body.codigoIbge // Agora vai gravar!
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Erro na atualização:", error);
        return NextResponse.json({ error: "Erro ao atualizar dados." }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    // ... manter o código de DELETE igual ao anterior
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    try {
        const userId = targetId;
        const contextId = request.headers.get('x-empresa-id');
        const { searchParams } = new URL(request.url);
        const clienteId = searchParams.get('id');

        if (!clienteId) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

        const empresaIdDono = await getEmpresaContexto(userId, contextId);
        if (!empresaIdDono) return NextResponse.json({ error: 'Proibido' }, { status: 403 });

        await prisma.userCliente.deleteMany({
            where: {
                userId: empresaIdDono,
                empresaId: clienteId
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Erro ao remover cliente." }, { status: 500 });
    }
}