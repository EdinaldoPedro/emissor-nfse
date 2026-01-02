import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
import https from 'https';
import fs from 'fs';

const URL_HOMOLOGACAO = "https://hom.nfse.gov.br/api/publica/emissao"; 
const URL_PRODUCAO = "https://nfse.gov.br/api/publica/emissao";

const prisma = new PrismaClient();
const cleanString = (str: string | null) => str ? str.replace(/\D/g, '') : '';

// --- HELPER: SEGURANÇA E CONTEXTO (NOVO) ---
async function getEmpresaContexto(userId: string, contextId: string | null) {
    // 1. Busca o usuário logado para saber quem é
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    // 2. Se não tem contexto (é o próprio dono acessando), retorna a empresa dele
    if (!contextId || contextId === 'null' || contextId === 'undefined') {
        return user.empresaId;
    }

    // 3. Se tem contexto (Contador acessando), verifica se existe vínculo APROVADO
    const vinculo = await prisma.contadorVinculo.findUnique({
        where: {
            contadorId_empresaId: { contadorId: userId, empresaId: contextId }
        }
    });

    if (vinculo && vinculo.status === 'APROVADO') {
        return contextId; // Permissão concedida! Retorna o ID da empresa do cliente.
    }

    return null; // Tentativa de acesso sem permissão
}

// --- FUNÇÃO DE ENVIO PARA A SEFAZ (MANTIDA IGUAL) ---
async function enviarParaPortalNacional(dps: any, empresa: any) {
    let pfxBuffer;
    try {
        if (empresa.certificadoA1 && empresa.certificadoA1.length > 200 && !empresa.certificadoA1.includes('/')) {
            pfxBuffer = Buffer.from(empresa.certificadoA1, 'base64');
        } else {
            if (!empresa.certificadoA1 || !fs.existsSync(empresa.certificadoA1)) throw new Error(`Certificado não encontrado.`);
            pfxBuffer = fs.readFileSync(empresa.certificadoA1);
        }
    } catch (e) {
        throw new Error("Falha ao ler o certificado digital.");
    }

    const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: empresa.senhaCertificado,
        rejectUnauthorized: false 
    });

    const url = empresa.ambiente === 'PRODUCAO' ? URL_PRODUCAO : URL_HOMOLOGACAO;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + Buffer.from(`${cleanString(empresa.documento)}:${empresa.senhaCertificado}`).toString('base64') 
            },
            body: JSON.stringify(dps),
            // @ts-ignore
            agent: httpsAgent 
        });

        const responseText = await response.text();
        let data;
        try { data = JSON.parse(responseText); } catch (e) { throw new Error(`Erro não-JSON da Sefaz: ${responseText.substring(0, 200)}`); }

        if (!response.ok) {
            return { sucesso: false, motivo: "Rejeição Sefaz", listaErros: data.erros || [{ codigo: response.status, mensagem: data.message }] };
        }

        return {
            sucesso: true,
            notaGov: {
                numero: data.numeroNfse || Math.floor(Math.random() * 100000), 
                chave: data.chaveAcesso,
                protocolo: data.protocolo,
                xml: data.xmlProcessado
            }
        };
    } catch (error: any) {
        return { sucesso: false, motivo: "Falha de Conexão", listaErros: [{ codigo: "NET_ERR", mensagem: error.message }] };
    }
}

// --- API POST (EMISSÃO COM CONTEXTO) ---
export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  const contextId = request.headers.get('x-empresa-id'); // Header do contador
  
  let vendaIdLog = null;
  let empresaIdLog = null;

  try {
    const body = await request.json();
    const { clienteId, valor, descricao, codigoCnae } = body;

    if (!userId) throw new Error("Usuário não identificado.");

    // 1. Resolve a Empresa Emissora (Prestador) usando o Contexto
    const empresaIdAlvo = await getEmpresaContexto(userId, contextId);
    if (!empresaIdAlvo) throw new Error("Acesso negado ou empresa não identificada.");

    empresaIdLog = empresaIdAlvo;

    // Busca dados completos do Prestador (Empresa do Cliente)
    const prestador = await prisma.empresa.findUnique({ where: { id: empresaIdAlvo } });
    if (!prestador) throw new Error("Dados da empresa emissora não encontrados.");

    // Busca o Tomador (Cliente do Cliente)
    const tomador = await prisma.empresa.findUnique({ where: { id: clienteId } });
    if (!tomador) throw new Error('Cliente tomador não encontrado.');

    // 2. Criar Venda (Vinculada à Empresa do Contexto)
    const venda = await prisma.venda.create({
        data: {
            empresaId: prestador.id, // <--- Importante: Venda fica na empresa certa
            clienteId: tomador.id,
            valor: parseFloat(valor),
            descricao: descricao,
            status: "PROCESSANDO"
        }
    });
    vendaIdLog = venda.id; 

    // === 3. DE-PARA INTELIGENTE ===
    const cnaeLimpo = cleanString(codigoCnae);
    const isMEI = prestador.regimeTributario === 'MEI';
    
    let itemLc = ''; 
    let codigoTribNacional = ''; 

    const regraFiscal = await prisma.globalCnae.findUnique({
        where: { codigo: cnaeLimpo }
    });

    if (regraFiscal) {
        if (regraFiscal.itemLc && regraFiscal.itemLc.trim() !== '') {
            itemLc = regraFiscal.itemLc;
        }
        if (regraFiscal.codigoTributacaoNacional && regraFiscal.codigoTributacaoNacional.trim() !== '') {
            codigoTribNacional = regraFiscal.codigoTributacaoNacional;
        }
    }

    // 4. Montagem do JSON (DPS)
    const infDPS = {
        versao: "1.00",
        ambiente: prestador.ambiente === 'PRODUCAO' ? '1' : '2',
        dhEmiss: new Date().toISOString(),
        dCompet: new Date().toISOString().split('T')[0],
        subst: { subst: "2" },
        prestador: {
            cpfCNPJ: { cnpj: cleanString(prestador.documento) },
            inscricaoMunicipal: cleanString(prestador.inscricaoMunicipal),
            regimeTributario: isMEI ? 4 : 1, 
        },
        tomador: {
            identificacaoTomador: {
                cpfCNPJ: {
                    cnpj: cleanString(tomador.documento).length === 14 ? cleanString(tomador.documento) : undefined,
                    cpf: cleanString(tomador.documento).length === 11 ? cleanString(tomador.documento) : undefined,
                }
            },
            razaoSocial: tomador.razaoSocial,
            endereco: {
                codigoMunicipio: tomador.codigoIbge || "9999999",
                cep: cleanString(tomador.cep),
                uf: tomador.uf
            }
        },
        servico: {
            locPrest: { codigoMunicipio: prestador.codigoIbge },
            codigoCnae: cnaeLimpo,
            codigoTributacaoNacional: cleanString(codigoTribNacional), 
            itemListaServico: cleanString(itemLc),
            discriminacao: descricao,
        },
        valores: {
            vServ: parseFloat(valor),
            vDescIncond: 0,
            vDescCond: 0,
            vLiq: parseFloat(valor),
            trib: {
                tribMun: {
                    tribISSQN: 1, 
                    tpRetISSQN: 2 
                }
            }
        }
    };

    // 5. Log
    await createLog({
        level: 'INFO', action: 'DPS_GERADA',
        message: `Emissão por ${userId} (Contexto: ${empresaIdAlvo})`,
        empresaId: prestador.id,
        vendaId: venda.id,
        details: infDPS 
    });

    // 6. Envio
    if (!prestador.certificadoA1) throw new Error("Certificado Digital não cadastrado nesta empresa.");
    
    const respostaPortal = await enviarParaPortalNacional(infDPS, prestador);

    if (!respostaPortal.sucesso) {
        await prisma.venda.update({ where: { id: venda.id }, data: { status: 'ERRO_EMISSAO' } });
        
        await createLog({
            level: 'ERRO', action: 'REJEICAO_SEFAZ',
            message: `Sefaz rejeitou: ${respostaPortal.motivo}`,
            empresaId: prestador.id,
            vendaId: venda.id,
            details: respostaPortal.listaErros
        });
        throw new Error("Erro na comunicação com a Sefaz.");
    }

    // 7. Sucesso - Salva Nota
    const dadosGov = respostaPortal.notaGov;
    const novaNota = await prisma.notaFiscal.create({
      data: {
        vendaId: venda.id,
        empresaId: prestador.id, // Vínculo correto
        clienteId: tomador.id,
        numero: parseInt(dadosGov.numero),
        valor: parseFloat(valor),
        descricao: descricao,
        prestadorCnpj: cleanString(prestador.documento),
        tomadorCnpj: cleanString(tomador.documento),
        status: 'AUTORIZADA',
        chaveAcesso: dadosGov.chave,
        protocolo: dadosGov.protocolo,
        xmlBase64: dadosGov.xml,
        cnae: cnaeLimpo,
        codigoServico: codigoTribNacional,
        dataEmissao: new Date()
      }
    });

    await prisma.venda.update({ where: { id: venda.id }, data: { status: 'CONCLUIDA' } });

    return NextResponse.json({ success: true, nota: novaNota }, { status: 201 });

  } catch (error: any) {
    if (vendaIdLog) {
       try { await prisma.venda.update({ where: { id: vendaIdLog }, data: { status: 'ERRO_EMISSAO' } }); } catch(e){}
    }
    await createLog({
        level: 'ERRO', action: 'FALHA_SISTEMA',
        message: error.message,
        empresaId: empresaIdLog || undefined,
        vendaId: vendaIdLog || undefined,
        details: error.stack
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- API GET (LISTAGEM COM CONTEXTO) ---
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  const contextId = request.headers.get('x-empresa-id'); // Header do contador

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const type = searchParams.get('type') || 'all';

  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  try {
    // 1. Resolve qual empresa estamos vendo (Contexto ou Própria)
    const empresaIdAlvo = await getEmpresaContexto(userId, contextId);

    // Se não encontrou empresa ou não tem permissão, retorna vazio
    if (!empresaIdAlvo) return NextResponse.json([], { status: 200 });

    const skip = (page - 1) * limit;

    const whereClause: any = {
        empresaId: empresaIdAlvo, // <--- Filtra pela empresa correta
        ...(search && {
            OR: [
                { cliente: { razaoSocial: { contains: search } } },
                { cliente: { documento: { contains: search } } },
                ...( !isNaN(Number(search)) ? [{ notas: { some: { numero: { equals: Number(search) } } } }] : [] )
            ]
        })
    };

    if (type === 'valid') {
        whereClause.status = { in: ['CONCLUIDA', 'CANCELADA'] };
    }

    const [vendas, total] = await prisma.$transaction([
        prisma.venda.findMany({
            where: whereClause,
            take: limit,
            skip: skip,
            orderBy: { createdAt: 'desc' },
            include: {
                cliente: { select: { razaoSocial: true, documento: true } },
                notas: { select: { id: true, numero: true, status: true, vendaId: true, valor: true, cnae: true, codigoServico: true } },
                logs: {
                    where: { level: 'ERRO' },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { message: true }
                }
            }
        }),
        prisma.venda.count({ where: whereClause })
    ]);

    // Otimização para buscar nome do item LC
    const cnaesEncontrados = Array.from(new Set(
        vendas.flatMap(v => v.notas.map(n => n.cnae)).filter(Boolean)
    ));

    const infosCnae = await prisma.globalCnae.findMany({
        where: { codigo: { in: cnaesEncontrados as string[] } },
        select: { codigo: true, itemLc: true }
    });

    const mapaItemLc = new Map(infosCnae.map(i => [i.codigo, i.itemLc]));

    const dadosFinais = vendas.map(v => {
        const nota = v.notas[0];
        let itemLcDisplay = '---';

        if (nota && nota.cnae) {
            const doBanco = mapaItemLc.get(nota.cnae);
            if (doBanco) itemLcDisplay = doBanco;
            else if (nota.codigoServico && nota.codigoServico.length >= 4) {
               itemLcDisplay = `${nota.codigoServico.substring(0,2)}.${nota.codigoServico.substring(2,4)}`;
            }
        }

        return {
            ...v,
            notas: v.notas.map(n => ({ ...n, itemLc: itemLcDisplay })),
            motivoErro: v.status === 'ERRO_EMISSAO' && v.logs[0] ? v.logs[0].message : null
        };
    });

    return NextResponse.json({
        data: dadosFinais,
        meta: { total, page, totalPages: Math.ceil(total / limit) }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar notas' }, { status: 500 });
  }
}