import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import zlib from 'zlib'; // <--- IMPORTANTE: GZIP

// URLs da API Nacional
const URL_HOMOLOGACAO = "https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse"; 
const URL_PRODUCAO = "https://sefin.nfse.gov.br/SefinNacional/nfse";

const prisma = new PrismaClient();
const cleanString = (str: string | null) => str ? str.replace(/\D/g, '') : '';

// --- HELPER: SEGURANÇA E CONTEXTO ---
async function getEmpresaContexto(userId: string, contextId: string | null) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role);
    if (isStaff && contextId && contextId !== 'null' && contextId !== 'undefined') {
        return contextId; 
    }

    if (!contextId || contextId === 'null' || contextId === 'undefined') {
        return user.empresaId;
    }

    const vinculo = await prisma.contadorVinculo.findUnique({
        where: { contadorId_empresaId: { contadorId: userId, empresaId: contextId } }
    });

    if (vinculo && vinculo.status === 'APROVADO') return contextId; 
    return null;
}

// --- HELPER: EXTRAÇÃO DE CERTIFICADO ---
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
        if (!cert || !key) throw new Error("Certificado/Chave não encontrados.");
        return {
            cert: forge.pki.certificateToPem(cert),
            key: forge.pki.privateKeyToPem(key)
        };
    } catch (e: any) {
        throw new Error(`Erro PFX: ${e.message}`);
    }
}

// --- FUNÇÃO DE ENVIO (GZIP + BASE64) ---
async function enviarParaPortalNacional(xmlDps: string, empresa: any) {
    let pfxBuffer: Buffer;
    try {
        if (empresa.certificadoA1 && empresa.certificadoA1.length > 250) {
            pfxBuffer = Buffer.from(empresa.certificadoA1, 'base64');
        } else {
            if (!empresa.certificadoA1) throw new Error("Arquivo não encontrado");
            pfxBuffer = fs.readFileSync(empresa.certificadoA1);
        }
    } catch (e: any) { return { sucesso: false, motivo: `Erro leitura PFX: ${e.message}`, listaErros: [] }; }

    let credenciais;
    try { credenciais = extrairCredenciaisDoPFX(pfxBuffer, empresa.senhaCertificado); } 
    catch (e: any) { return { sucesso: false, motivo: "Certificado inválido", listaErros: [{ codigo: "CERT", mensagem: e.message }] }; }

    const httpsAgent = new https.Agent({
        cert: credenciais.cert,
        key: credenciais.key,
        rejectUnauthorized: false,
        keepAlive: true
    });

    const url = empresa.ambiente === 'PRODUCAO' ? URL_PRODUCAO : URL_HOMOLOGACAO;

    try {
        console.log(`[DEBUG] Preparando GZIP para: ${url}`);

        // 1. GZIP do XML
        const xmlBuffer = Buffer.from(xmlDps, 'utf-8');
        const xmlGzip = zlib.gzipSync(xmlBuffer);
        
        // 2. Base64
        const arquivoBase64 = xmlGzip.toString('base64');

        // 3. JSON Wrapper
        const payload = { arquivo: arquivoBase64 };

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json', // Agora sim JSON
                'Authorization': 'Basic ' + Buffer.from(`${cleanString(empresa.documento)}:${empresa.senhaCertificado}`).toString('base64') 
            },
            httpsAgent: httpsAgent,
            timeout: 60000
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
        let erroMsg = error.message;
        let erroCodigo = "NET";
        let erroDetalhe = JSON.stringify(error.response?.data || {});

        if (error.response) {
            erroCodigo = String(error.response.status);
            erroMsg = `Erro HTTP ${error.response.status}`;
            console.error("Erro API Body:", error.response.data);
        }

        return { 
            sucesso: false, 
            motivo: erroMsg, 
            listaErros: [{ 
                codigo: erroCodigo, 
                mensagem: erroDetalhe, 
                // Salva o XML original para lermos no log (NÃO o base64)
                xmlOriginal: xmlDps 
            }] 
        };
    }
}

// --- API POST (EMISSÃO) ---
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
    if (!empresaIdAlvo) throw new Error("Acesso negado.");
    empresaIdLog = empresaIdAlvo;

    const prestador = await prisma.empresa.findUnique({ where: { id: empresaIdAlvo } });
    const tomador = await prisma.empresa.findUnique({ where: { id: clienteId } });
    if (!prestador || !tomador) throw new Error("Empresas não encontradas.");

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

    // Dados Fiscais
    const cnaeLimpo = cleanString(codigoCnae);
    const isMEI = prestador.regimeTributario === 'MEI';
    let itemLc = '01.01'; 
    let codigoTribNacional = '010101'; 

    const regraFiscal = await prisma.globalCnae.findUnique({ where: { codigo: cnaeLimpo } });
    if (regraFiscal) {
        if (regraFiscal.itemLc) itemLc = regraFiscal.itemLc;
        if (regraFiscal.codigoTributacaoNacional) codigoTribNacional = cleanString(regraFiscal.codigoTributacaoNacional);
    }

    // MONTAGEM DO XML (DPS)
    const dhEmiss = new Date().toISOString();
    const dCompet = new Date().toISOString().split('T')[0];
    const valServ = parseFloat(valor).toFixed(2);

    // XML COMPLETO DO DPS
    const xmlDPS = `
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse">
  <infDPS versao="1.00">
    <dhEmiss>${dhEmiss}</dhEmiss>
    <dCompet>${dCompet}</dCompet>
    <prestador>
      <cpfCNPJ>
        <cnpj>${cleanString(prestador.documento)}</cnpj>
      </cpfCNPJ>
      <inscricaoMunicipal>${cleanString(prestador.inscricaoMunicipal) || "00000"}</inscricaoMunicipal>
    </prestador>
    <tomador>
      <identificacaoTomador>
        <cpfCNPJ>
          <cnpj>${cleanString(tomador.documento)}</cnpj>
        </cpfCNPJ>
      </identificacaoTomador>
    </tomador>
    <servico>
      <locPrest>
        <codigoMunicipio>${prestador.codigoIbge}</codigoMunicipio>
      </locPrest>
      <codigoCnae>${cnaeLimpo}</codigoCnae>
      <codigoTributacaoNacional>${codigoTribNacional}</codigoTributacaoNacional>
      <discriminacao>${descricao}</discriminacao>
    </servico>
    <valores>
      <vServ>${valServ}</vServ>
      <vLiq>${valServ}</vLiq>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <tpRetISSQN>2</tpRetISSQN>
        </tribMun>
      </trib>
    </valores>
  </infDPS>
</DPS>`;

    await createLog({
        level: 'INFO', action: 'DPS_GERADA',
        message: `XML Gerado. Preparando envio GZIP.`,
        empresaId: prestador.id,
        vendaId: venda.id,
        // CORREÇÃO DO LOG: Salva como objeto para aparecer na caixa bonita
        details: { xmlGerado: xmlDPS } 
    });

    // ENVIO
    const respostaPortal = await enviarParaPortalNacional(xmlDPS, prestador);

    if (!respostaPortal.sucesso) {
        await prisma.venda.update({ where: { id: venda.id }, data: { status: 'ERRO_EMISSAO' } });
        await createLog({
            level: 'ERRO', action: 'ERRO_EMISSAO_PORTAL',
            message: `Falha: ${respostaPortal.motivo}`,
            empresaId: prestador.id,
            vendaId: venda.id,
            details: JSON.stringify(respostaPortal.listaErros, null, 2)
        });
        return NextResponse.json({ error: "Emissão falhou.", details: respostaPortal.listaErros }, { status: 400 });
    }

    // SUCESSO
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
        xmlBase64: dadosGov.xml,
        cnae: cnaeLimpo,
        dataEmissao: new Date()
      }
    });

    await prisma.venda.update({ where: { id: venda.id }, data: { status: 'CONCLUIDA' } });
    return NextResponse.json({ success: true, nota: novaNota }, { status: 201 });

  } catch (error: any) {
    if (vendaIdLog) try { await prisma.venda.update({ where: { id: vendaIdLog }, data: { status: 'ERRO_EMISSAO' } }); } catch(e){}
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

// --- API GET (LISTAGEM DE NOTAS) ---
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
                      select: { message: true, details: true }
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