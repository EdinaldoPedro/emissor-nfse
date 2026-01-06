import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import forge from 'node-forge';

// URLs da API Nacional
const URL_HOMOLOGACAO = "https://hom.nfse.gov.br/api/publica/emissao"; 
const URL_PRODUCAO = "https://nfse.gov.br/api/publica/emissao";

const prisma = new PrismaClient();
const cleanString = (str: string | null) => str ? str.replace(/\D/g, '') : '';

// --- HELPER: SEGURANÇA E CONTEXTO (CORRIGIDO PARA ADMINS) ---
async function getEmpresaContexto(userId: string, contextId: string | null) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    // 1. Super-poderes para Staff (Permite Admin/Suporte atuar em qualquer empresa)
    const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role);
    if (isStaff && contextId && contextId !== 'null' && contextId !== 'undefined') {
        return contextId; 
    }

    // 2. Se não tem contexto, usa a empresa do próprio usuário (Dono)
    if (!contextId || contextId === 'null' || contextId === 'undefined') {
        return user.empresaId;
    }

    // 3. Se tem contexto e não é Admin, verifica vínculo de contador
    const vinculo = await prisma.contadorVinculo.findUnique({
        where: {
            contadorId_empresaId: { contadorId: userId, empresaId: contextId }
        }
    });

    if (vinculo && vinculo.status === 'APROVADO') {
        return contextId; 
    }

    return null;
}

// --- HELPER: EXTRAÇÃO DE CERTIFICADO (PFX -> PEM) ---
function extrairCredenciaisDoPFX(pfxBuffer: Buffer, senha: string) {
    try {
        const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha || '');

        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        // @ts-ignore
        const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;

        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        // @ts-ignore
        let key = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;

        if (!key) {
            const keyBags2 = p12.getBags({ bagType: forge.pki.oids.keyBag });
            // @ts-ignore
            key = keyBags2[forge.pki.oids.keyBag]?.[0]?.key;
        }

        if (!cert || !key) throw new Error("Certificado ou chave privada não encontrados no arquivo.");

        return {
            cert: forge.pki.certificateToPem(cert),
            key: forge.pki.privateKeyToPem(key)
        };

    } catch (e: any) {
        if (e.message.includes('password') || e.message.includes('MAC')) {
            throw new Error("Senha do certificado incorreta.");
        }
        throw new Error(`Erro ao ler PFX: ${e.message}`);
    }
}

// --- FUNÇÃO DE ENVIO ---
async function enviarParaPortalNacional(dps: any, empresa: any) {
    let pfxBuffer: Buffer;

    try {
        if (empresa.certificadoA1 && empresa.certificadoA1.length > 250) {
            pfxBuffer = Buffer.from(empresa.certificadoA1, 'base64');
        } else {
            if (!empresa.certificadoA1 || !fs.existsSync(empresa.certificadoA1)) {
                throw new Error(`Arquivo do certificado não encontrado.`);
            }
            pfxBuffer = fs.readFileSync(empresa.certificadoA1);
        }
    } catch (e: any) {
        throw new Error(`Erro ao carregar arquivo do certificado: ${e.message}`);
    }

    let credenciais;
    try {
        credenciais = extrairCredenciaisDoPFX(pfxBuffer, empresa.senhaCertificado);
    } catch (e: any) {
        return { 
            sucesso: false, 
            motivo: "Erro no Certificado", 
            listaErros: [{ codigo: "CERT_ERR", mensagem: e.message }] 
        };
    }

    const httpsAgent = new https.Agent({
        cert: credenciais.cert,
        key: credenciais.key,
        rejectUnauthorized: false,
        keepAlive: true,
        timeout: 120000 
    });

    const url = empresa.ambiente === 'PRODUCAO' ? URL_PRODUCAO : URL_HOMOLOGACAO;

    try {
        const response = await axios.post(url, dps, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + Buffer.from(`${cleanString(empresa.documento)}:${empresa.senhaCertificado}`).toString('base64') 
            },
            httpsAgent: httpsAgent,
            timeout: 120000 
        });

        const data = response.data;

        return {
            sucesso: true,
            notaGov: {
                numero: data.numeroNfse || 'PENDENTE', 
                chave: data.chaveAcesso,
                protocolo: data.protocolo,
                xml: data.xmlProcessado
            }
        };

    } catch (error: any) {
        console.error("ERRO PORTAL NACIONAL:", error.message);

        if (error.response) {
            const data = error.response.data;
            return { 
                sucesso: false, 
                motivo: "Rejeição do Portal Nacional", 
                listaErros: data.erros || [{ codigo: error.response.status, mensagem: JSON.stringify(data) }] 
            };
        } else if (error.request) {
            return { 
                sucesso: false, 
                motivo: "Sem resposta do Portal Nacional (Timeout)", 
                listaErros: [{ codigo: "TIMEOUT", mensagem: "O servidor do Portal Nacional demorou a responder." }] 
            };
        } else {
            return { 
                sucesso: false, 
                motivo: "Erro Interno do Emissor", 
                listaErros: [{ codigo: "SETUP_ERR", mensagem: error.message }] 
            };
        }
    }
}

// --- API POST (ENDPOINT PRINCIPAL) ---
export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  const contextId = request.headers.get('x-empresa-id'); 
  
  let vendaIdLog = null;
  let empresaIdLog = null;

  try {
    const body = await request.json();
    const { clienteId, valor, descricao, codigoCnae } = body;

    if (!userId) throw new Error("Usuário não identificado.");

    const empresaIdAlvo = await getEmpresaContexto(userId, contextId);
    if (!empresaIdAlvo) throw new Error("Acesso negado ou empresa não identificada.");

    empresaIdLog = empresaIdAlvo;

    const prestador = await prisma.empresa.findUnique({ where: { id: empresaIdAlvo } });
    if (!prestador) throw new Error("Dados da empresa emissora não encontrados.");

    const tomador = await prisma.empresa.findUnique({ where: { id: clienteId } });
    if (!tomador) throw new Error('Cliente tomador não encontrado.');

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

    const cnaeLimpo = cleanString(codigoCnae);
    const isMEI = prestador.regimeTributario === 'MEI';
    
    let itemLc = ''; 
    let codigoTribNacional = ''; 

    const regraFiscal = await prisma.globalCnae.findUnique({
        where: { codigo: cnaeLimpo }
    });

    if (regraFiscal) {
        if (regraFiscal.itemLc) itemLc = regraFiscal.itemLc;
        if (regraFiscal.codigoTributacaoNacional) codigoTribNacional = regraFiscal.codigoTributacaoNacional;
    }

    const infDPS = {
        versao: "1.00",
        ambiente: prestador.ambiente === 'PRODUCAO' ? '1' : '2',
        dhEmiss: new Date().toISOString(),
        dCompet: new Date().toISOString().split('T')[0],
        subst: { subst: "2" },
        prestador: {
            cpfCNPJ: { cnpj: cleanString(prestador.documento) },
            inscricaoMunicipal: cleanString(prestador.inscricaoMunicipal) || "00000", 
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
                uf: tomador.uf,
                logradouro: tomador.logradouro || undefined,
                numero: tomador.numero || undefined,
                bairro: tomador.bairro || undefined
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

    await createLog({
        level: 'INFO', action: 'DPS_GERADA',
        message: `Emissão iniciada por ${userId}`,
        empresaId: prestador.id,
        vendaId: venda.id,
        details: infDPS 
    });

    if (!prestador.certificadoA1) throw new Error("Certificado Digital não cadastrado.");
    
    const respostaPortal = await enviarParaPortalNacional(infDPS, prestador);

    if (!respostaPortal.sucesso) {
        await prisma.venda.update({ where: { id: venda.id }, data: { status: 'ERRO_EMISSAO' } });
        
        await createLog({
            level: 'ERRO', action: 'ERRO_EMISSAO_PORTAL',
            message: `Falha: ${respostaPortal.motivo}`,
            empresaId: prestador.id,
            vendaId: venda.id,
            details: respostaPortal.listaErros
        });
        
        return NextResponse.json({ 
            error: "Emissão falhou. Verifique os logs.",
            details: respostaPortal.listaErros 
        }, { status: 400 });
    }

    const dadosGov = respostaPortal.notaGov;
    const novaNota = await prisma.notaFiscal.create({
      data: {
        vendaId: venda.id,
        empresaId: prestador.id,
        clienteId: tomador.id,
        numero: parseInt(dadosGov.numero) || 0,
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

// --- API GET (LISTAGEM) ---
export async function GET(request: Request) {
    const userId = request.headers.get('x-user-id');
    const contextId = request.headers.get('x-empresa-id');
  
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || 'all';
  
    if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });
  
    try {
      const empresaIdAlvo = await getEmpresaContexto(userId, contextId);
      if (!empresaIdAlvo) return NextResponse.json([], { status: 200 });
  
      const skip = (page - 1) * limit;
  
      const whereClause: any = {
          empresaId: empresaIdAlvo,
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