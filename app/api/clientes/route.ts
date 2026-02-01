import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { validateRequest } from '@/app/utils/api-security';
import { upsertEmpresaAndLinkUser } from "@/app/services/empresaService";

const prisma = new PrismaClient();

// === HELPER: BUSCA IBGE (SEGURANÇA) ===
async function buscarIbgePorCep(cep: string): Promise<string | null> {
    try {
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return null;
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, { next: { revalidate: 3600 } });
        const data = await res.json();
        return (!data.erro && data.ibge) ? data.ibge : null;
    } catch (e) { return null; }
}

// GET: Listar Clientes
export async function GET(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    try {
        let empresaId = request.headers.get('x-empresa-id');
        
        if (!empresaId || empresaId === 'null' || empresaId === 'undefined') {
            const user = await prisma.user.findUnique({ where: { id: targetId } });
            empresaId = user?.empresaId || null;
            
            // Fallback: Tenta achar vínculo via UserCliente
            if (!empresaId) {
                const vinculo = await prisma.userCliente.findFirst({ where: { userId: targetId } });
                if (vinculo) empresaId = vinculo.empresaId;
            }
        }

        if (!empresaId) return NextResponse.json([]);

        const clientes = await prisma.cliente.findMany({
            where: { empresaId: empresaId },
            orderBy: { nome: 'asc' }
        });
        
        return NextResponse.json(clientes);
    } catch (e) {
        return NextResponse.json({ error: 'Erro ao listar.' }, { status: 500 });
    }
}

// POST: Criar/Atualizar Cliente
export async function POST(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    console.log(`[DEBUG] Iniciando cadastro de cliente pelo usuário: ${targetId}`);

    try {
        // === LÓGICA ROBUSTA DE IDENTIFICAÇÃO DA EMPRESA ===
        let empresaId = request.headers.get('x-empresa-id');
        if (empresaId === 'null' || empresaId === 'undefined' || empresaId === '') empresaId = null;

        // 1. Se não veio no header, busca no usuário
        if (!empresaId) {
            const user = await prisma.user.findUnique({ where: { id: targetId } });
            console.log(`[DEBUG] User.empresaId no banco: ${user?.empresaId}`);
            empresaId = user?.empresaId || null;

            // 2. Fallback de Emergência: Busca se existe UserCliente
            if (!empresaId) {
                const vinculo = await prisma.userCliente.findFirst({ where: { userId: targetId } });
                if (vinculo) {
                    console.log(`[DEBUG] Vínculo UserCliente encontrado: ${vinculo.empresaId}`);
                    empresaId = vinculo.empresaId;
                    
                    // Auto-correção: Salva no user para a próxima ficar mais rápida
                    await prisma.user.update({ where: { id: targetId }, data: { empresaId: vinculo.empresaId } });
                }
            }

            // 3. Fallback Nuclear: Busca empresa pelo CPF/CNPJ do usuário (se ele for o dono)
            if (!empresaId && user?.cpf) {
                // Tenta achar empresa onde o dono tem esse documento (caso tenha cadastrado como PF ou algo assim)
                // Ou se o documento da empresa for igual ao login
                // (Lógica simplificada: tenta achar qualquer empresa vinculada a este user ID como dono)
                const empresaDono = await prisma.empresa.findFirst({ where: { donoUser: { id: targetId } } });
                if (empresaDono) {
                    console.log(`[DEBUG] Empresa encontrada via DonoUser: ${empresaDono.id}`);
                    empresaId = empresaDono.id;
                    await prisma.user.update({ where: { id: targetId }, data: { empresaId: empresaDono.id } });
                }
            }
        }

        // SE AINDA ASSIM NÃO ACHOU, AVISA
        if (!empresaId) {
            console.error(`[ERRO CRÍTICO] Usuário ${targetId} tentou cadastrar cliente mas não tem empresa vinculada.`);
            return NextResponse.json({ 
                error: 'Sua conta não está vinculada a nenhuma empresa. Por favor, vá em Configurações > Minha Empresa e clique em Salvar novamente para corrigir o vínculo.' 
            }, { status: 400 });
        }

        const body = await request.json();
        const { 
            id, tipo, nome, nomeFantasia, documento, 
            email, telefone, 
            cep, logradouro, numero, bairro, cidade, uf, codigoIbge, pais,
            inscricaoMunicipal 
        } = body;

        if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
        
        if (tipo !== 'EXT') {
            if (!documento) return NextResponse.json({ error: 'Documento obrigatório para Brasil.' }, { status: 400 });
        }

        let ibgeFinal = codigoIbge;
        if (cep && (!ibgeFinal || ibgeFinal.length < 7)) {
            const ibgeResgatado = await buscarIbgePorCep(cep);
            if (ibgeResgatado) ibgeFinal = ibgeResgatado;
        }

        const dataPayload = {
            empresaId: empresaId, 
            tipo: tipo || 'PJ',
            nome,
            nomeFantasia,
            documento: documento ? documento.replace(/\D/g, '') : null,
            email,
            telefone,
            cep: cep ? cep.replace(/\D/g, '') : null,
            logradouro,
            numero,
            bairro,
            cidade,
            uf,
            codigoIbge: ibgeFinal,
            pais: pais || 'Brasil',
            inscricaoMunicipal
        };

        let clienteSalvo;
        
        if (id) {
            clienteSalvo = await prisma.cliente.update({ where: { id }, data: dataPayload });
        } else {
            let existe = null;
            if (tipo !== 'EXT' && dataPayload.documento) {
                existe = await prisma.cliente.findFirst({ where: { empresaId, documento: dataPayload.documento } });
            } else if (tipo === 'EXT') {
                existe = await prisma.cliente.findFirst({ where: { empresaId, nome: dataPayload.nome, tipo: 'EXT' } });
            }

            if (existe) {
                 clienteSalvo = await prisma.cliente.update({ where: { id: existe.id }, data: dataPayload });
            } else {
                 clienteSalvo = await prisma.cliente.create({ data: dataPayload });
            }
        }

        return NextResponse.json(clienteSalvo);

    } catch (error: any) {
        console.error("Erro POST Cliente:", error);
        return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID necessário.' }, { status: 400 });

        await prisma.cliente.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Erro ao excluir.' }, { status: 500 });
    }
}