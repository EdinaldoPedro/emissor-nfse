import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { validateRequest } from '@/app/utils/api-security';
import { sanitizeStringExternal } from '@/app/utils/formatters';

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

// GET: Listar Clientes (da MINHA Carteira)
export async function GET(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    try {
        let empresaId = request.headers.get('x-empresa-id');
        
        // Lógica de fallback para descobrir a empresa do usuário logado
        if (!empresaId || empresaId === 'null' || empresaId === 'undefined') {
            const user = await prisma.user.findUnique({ where: { id: targetId } });
            empresaId = user?.empresaId || null;
            
            if (!empresaId) {
                const vinculo = await prisma.userCliente.findFirst({ where: { userId: targetId } });
                if (vinculo) empresaId = vinculo.empresaId;
            }
        }

        if (!empresaId) return NextResponse.json([]);

        // === CORREÇÃO: Busca via Tabela de Vínculo ===
        const vinculos = await prisma.vinculoCarteira.findMany({
            where: { empresaId: empresaId },
            include: { cliente: true }, // Traz os dados do cliente global
            orderBy: { cliente: { nome: 'asc' } }
        });

        // Mapeia para retornar apenas os dados do cliente (flat)
        const clientes = vinculos.map(v => ({
            ...v.cliente,
            // Adiciona campos do vínculo se necessário (ex: apelido)
            apelido: v.apelido,
            idVinculo: v.id // Útil para deleção
        }));
        
        return NextResponse.json(clientes);

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Erro ao listar clientes.' }, { status: 500 });
    }
}

// POST: Criar/Vincular Cliente
export async function POST(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    try {
        // === 1. Identifica a Empresa Prestadora ===
        let empresaId = request.headers.get('x-empresa-id');
        if (!empresaId || empresaId === 'null') {
            const user = await prisma.user.findUnique({ where: { id: targetId } });
            empresaId = user?.empresaId || null;
            
            if (!empresaId) {
                const vinculo = await prisma.userCliente.findFirst({ where: { userId: targetId } });
                if (vinculo) empresaId = vinculo.empresaId;
            }
        }

        if (!empresaId) {
            return NextResponse.json({ error: 'Empresa não identificada.' }, { status: 400 });
        }

        const body = await request.json();
        let { 
            id, tipo, nome, nomeFantasia, documento, 
            email, telefone, 
            cep, logradouro, numero, bairro, cidade, uf, codigoIbge, pais,
            inscricaoMunicipal, nif, moeda, complemento
        } = body;

        // === 2. Limpeza e Sanitização ===
        if (tipo === 'EXT') {
            // Garante que o documento (CPF/CNPJ) seja nulo para não dar conflito de Unique
            documento = null; 
            
            // Limpa o NIF para deixar só números e no máximo 9 dígitos
            if (nif) nif = nif.replace(/\D/g, '').slice(0, 9);

            // Aplica a sanitização obrigatória do Padrão Nacional
            nome = sanitizeStringExternal(nome);
            logradouro = sanitizeStringExternal(logradouro);
            numero = sanitizeStringExternal(numero);
            bairro = sanitizeStringExternal(bairro);
            cidade = sanitizeStringExternal(cidade);
            uf = sanitizeStringExternal(uf);
            pais = sanitizeStringExternal(pais);
            if (complemento) complemento = sanitizeStringExternal(complemento);
        }

        // Validações Básicas
        if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
        const docLimpo = documento ? documento.replace(/\D/g, '') : null;
        if (tipo !== 'EXT' && !docLimpo) return NextResponse.json({ error: 'Documento obrigatório.' }, { status: 400 });

        // Tratamento de IBGE (Ignorar se for exterior)
        let ibgeFinal = codigoIbge;
        if (cep && (!ibgeFinal || ibgeFinal.length < 7) && tipo !== 'EXT') {
            const ibgeResgatado = await buscarIbgePorCep(cep);
            if (ibgeResgatado) ibgeFinal = ibgeResgatado;
        }

        // === 3. Verifica se o Cliente já existe no Catálogo Global ===
        let clienteGlobal = null;
        
        if (id) {
            // Edição direta
            clienteGlobal = await prisma.cliente.findUnique({ where: { id } });
        } else if (tipo !== 'EXT') {
            clienteGlobal = await prisma.cliente.findUnique({ where: { documento: docLimpo } });
        } else {
            // Para Exterior, tentamos achar pelo Nome (já que não tem CNPJ único)
            clienteGlobal = await prisma.cliente.findFirst({ where: { nome, tipo: 'EXT' } });
        }

        // Monta o objeto com os dados finais limpos
        const dadosCliente = {
            tipo: tipo || 'PJ',
            nome,
            nomeFantasia,
            documento: docLimpo, // Ficará null para EXT
            nif: nif || null,
            moeda: moeda || 'BRL',
            email,
            telefone,
            cep: tipo === 'EXT' ? cep : (cep ? cep.replace(/\D/g, '') : null), // Preserva letras no CEP do exterior se houver
            logradouro,
            numero,
            complemento,
            bairro,
            cidade,
            uf,
            codigoIbge: ibgeFinal,
            pais: pais || 'Brasil',
            inscricaoMunicipal
        };

        // === 4. Cria ou Atualiza no Global ===
        if (clienteGlobal) {
            clienteGlobal = await prisma.cliente.update({
                where: { id: clienteGlobal.id },
                data: dadosCliente
            });
        } else {
            clienteGlobal = await prisma.cliente.create({
                data: dadosCliente
            });
        }

        // === 5. Cria o Vínculo na Carteira (Se não existir) ===
        const vinculoExistente = await prisma.vinculoCarteira.findUnique({
            where: {
                empresaId_clienteId: {
                    empresaId: empresaId,
                    clienteId: clienteGlobal.id
                }
            }
        });

        if (!vinculoExistente) {
            await prisma.vinculoCarteira.create({
                data: {
                    empresaId: empresaId,
                    clienteId: clienteGlobal.id,
                    apelido: nomeFantasia || nome // Usa fantasia como apelido padrão
                }
            });
        }

        return NextResponse.json(clienteGlobal);

    } catch (error: any) {
        console.error("Erro POST Cliente:", error);
        return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 });
    }
}

// DELETE: Remove da Carteira
export async function DELETE(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id'); // ID do CLIENTE Global
        
        if (!id) return NextResponse.json({ error: 'ID necessário.' }, { status: 400 });

        // === CORREÇÃO: Lê a empresa do Header primeiro (Essencial para o Contador) ===
        let empresaId = request.headers.get('x-empresa-id');

        if (!empresaId || empresaId === 'null' || empresaId === 'undefined') {
            const user = await prisma.user.findUnique({ where: { id: targetId } });
            empresaId = user?.empresaId || null;
            
            if (!empresaId) {
                const vinculo = await prisma.userCliente.findFirst({ where: { userId: targetId } });
                if (vinculo) empresaId = vinculo.empresaId;
            }
        }

        if (!empresaId) return NextResponse.json({ error: 'Empresa não identificada.' }, { status: 400 });

        // Remove o VÍNCULO (Não apaga o cliente global)
        await prisma.vinculoCarteira.deleteMany({
            where: {
                empresaId: empresaId,
                clienteId: id
            }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Erro ao desvincular.' }, { status: 500 });
    }
}