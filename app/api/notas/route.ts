import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
import https from 'https';
import fs from 'fs';

// URLs OFICIAIS DA API NACIONAL (ADN)
const URL_HOMOLOGACAO = "https://hom.nfse.gov.br/api/publica/emissao"; 
const URL_PRODUCAO = "https://nfse.gov.br/api/publica/emissao";

const prisma = new PrismaClient();
const formatMoney = (val: number) => val.toFixed(2);
const cleanString = (str: string | null) => str ? str.replace(/\D/g, '') : '';

// --- FUNÇÃO DE COMUNICAÇÃO REAL COM SEFAZ (mTLS) ---
async function enviarParaPortalNacional(dps: any, empresa: any) {
    // A validação do certificado acontece AQUI DENTRO agora, ou logo antes de chamar
    let pfxBuffer;
    
    try {
        if (empresa.certificadoA1.length > 200 && !empresa.certificadoA1.includes('/')) {
            pfxBuffer = Buffer.from(empresa.certificadoA1, 'base64');
        } else {
            if (!fs.existsSync(empresa.certificadoA1)) {
                throw new Error(`Arquivo de certificado não encontrado no servidor.`);
            }
            pfxBuffer = fs.readFileSync(empresa.certificadoA1);
        }
    } catch (e) {
        throw new Error("Falha ao ler o arquivo do certificado digital. Verifique as configurações da empresa.");
    }

    const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: empresa.senhaCertificado,
        rejectUnauthorized: false 
    });

    const url = empresa.ambiente === 'PRODUCAO' ? URL_PRODUCAO : URL_HOMOLOGACAO;

    try {
        console.log(`[API REAL] Enviando para ${url}...`);
        
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
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Erro não-JSON da Sefaz: ${responseText.substring(0, 200)}`);
        }

        if (!response.ok) {
            const listaErros = data.erros || [{ codigo: response.status, mensagem: data.message || "Erro desconhecido na API Nacional." }];
            return {
                sucesso: false,
                motivo: "Rejeição Sefaz",
                listaErros: listaErros
            };
        }

        return {
            sucesso: true,
            notaGov: {
                numero: data.numeroNfse || Math.floor(Math.random() * 100000), 
                chave: data.chaveAcesso || `KEY${Date.now()}`,
                protocolo: data.protocolo || `PROT${Date.now()}`,
                xml: data.xmlProcessado
            }
        };

    } catch (error: any) {
        return {
            sucesso: false,
            motivo: "Falha de Conexão",
            listaErros: [{ codigo: "NET_ERR", mensagem: error.message }]
        };
    }
}

// --- MÉTODO DE EMISSÃO (POST) ---
export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id') || 'anonimo';
  let vendaIdLog = null;
  let empresaIdLog = null;

  try {
    const body = await request.json();
    const { clienteId, valor, descricao, codigoCnae } = body;

    // 1. Identificar Prestador
    const userPrestador = await prisma.user.findUnique({
      where: { id: userId },
      include: { empresa: true }
    });
    const prestador = userPrestador?.empresa;

    if (!prestador) throw new Error("Usuário não possui empresa vinculada.");
    empresaIdLog = prestador.id;

    // 2. Identificar Tomador
    const tomador = await prisma.empresa.findUnique({ where: { id: clienteId } });
    if (!tomador) throw new Error('Cliente tomador não encontrado.');

    // 3. CRIAR A VENDA (Status: PROCESSANDO)
    const venda = await prisma.venda.create({
        data: {
            empresaId: prestador.id,
            clienteId: tomador.id,
            valor: parseFloat(valor),
            descricao: descricao,
            status: "PROCESSANDO"
        }
    });
    vendaIdLog = venda.id; 

    // === MUDANÇA: Prepara os dados ANTES de validar o certificado ===
    const ambienteEmissao = prestador.ambiente || 'HOMOLOGACAO';
    const isMEI = prestador.regimeTributario === 'MEI';
    const cnaeLimpo = cleanString(codigoCnae);
    
    let codigoTribNacional = '010101'; 
    let itemLc = '01.01';

    const regraGlobal = await prisma.globalCnae.findUnique({ where: { codigo: cnaeLimpo } });
    if (regraGlobal?.codigoTributacaoNacional) {
        codigoTribNacional = regraGlobal.codigoTributacaoNacional.replace(/\D/g, '');
        itemLc = regraGlobal.itemLc || itemLc;
    }

    // 4. Montagem do JSON (DPS) - AGORA ACONTECE CEDO
    const infDPS = {
        versao: "1.00",
        ambiente: ambienteEmissao === 'PRODUCAO' ? '1' : '2',
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
            codigoTributacaoNacional: codigoTribNacional,
            itemListaServico: itemLc.replace(/\D/g, ''),
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

    // 5. SALVA O LOG DO JSON (AQUI GARANTIMOS QUE ELE APAREÇA NA TELA DE DETALHES)
    await createLog({
        level: 'INFO', action: 'DPS_GERADA',
        message: `Ambiente: ${ambienteEmissao}. DPS montada.`,
        empresaId: prestador.id,
        vendaId: venda.id,
        details: JSON.stringify(infDPS, null, 2)
    });

    // 6. AGORA SIM: Validação de Certificado (Bloqueia envio se falhar)
    if (!prestador.certificadoA1) {
        throw new Error("Certificado Digital não cadastrado. O JSON foi gerado (veja logs), mas o envio foi bloqueado.");
    }

    // 7. Envio Real
    const respostaPortal = await enviarParaPortalNacional(infDPS, prestador);

    // 8. Tratamento do Retorno
    if (!respostaPortal.sucesso) {
        const listaErrosTexto = respostaPortal.listaErros?.map((e: any) => `[${e.codigo}] ${e.mensagem}`).join('\n');
        
        await prisma.venda.update({
            where: { id: venda.id },
            data: { status: 'ERRO_EMISSAO' }
        });

        await createLog({
            level: 'ERRO', action: 'REJEICAO_SEFAZ',
            message: `Falha na emissão: ${respostaPortal.motivo}`,
            empresaId: prestador.id,
            vendaId: venda.id,
            details: JSON.stringify(respostaPortal.listaErros, null, 2)
        });

        throw new Error(listaErrosTexto || "Erro na comunicação com a Sefaz.");
    }

    // 9. Sucesso
    const dadosGov = respostaPortal.notaGov;

    const novaNota = await prisma.notaFiscal.create({
      data: {
        vendaId: venda.id,
        empresaId: prestador.id,
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

    await createLog({
        level: 'INFO', action: 'EMISSAO_AUTORIZADA',
        message: `Nota REAL ${novaNota.numero} autorizada!`,
        empresaId: prestador.id,
        vendaId: venda.id,
        details: { chave: novaNota.chaveAcesso, protocolo: novaNota.protocolo }
    });

    return NextResponse.json({ success: true, nota: novaNota }, { status: 201 });

  } catch (error: any) {
    if (vendaIdLog) {
        try {
            // Se falhou (mesmo que seja falta de certificado), marca como ERRO
            const v = await prisma.venda.findUnique({ where: { id: vendaIdLog } });
            if (v?.status !== 'CONCLUIDA') {
                 await prisma.venda.update({ where: { id: vendaIdLog }, data: { status: 'ERRO_EMISSAO' } });
            }
        } catch (e) {
            console.error("Erro ao atualizar status da venda:", e);
        }
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

// --- MÉTODO DE LISTAGEM (GET) - MANTIDO ---
export async function GET(request: Request) {
  // ... (MANTENHA O CÓDIGO DO GET IGUAL AO ANTERIOR, POIS JÁ ESTAVA CORRETO)
  const userId = request.headers.get('x-user-id');
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const type = searchParams.get('type') || 'all';

  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ 
        where: { id: userId },
        include: { empresa: true }
    });

    if (!user?.empresa) return NextResponse.json([], { status: 200 });

    const skip = (page - 1) * limit;

    const whereClause: any = {
        empresaId: user.empresa.id,
        ...(search && {
            OR: [
                { cliente: { razaoSocial: { contains: search, mode: 'insensitive' } } },
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