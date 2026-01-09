import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import zlib from 'zlib'; 

// === CONFIGURAÇÃO BASEADA NO SWAGGER OFICIAL ===
const URL_HOMOLOGACAO = "https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse"; 
const URL_PRODUCAO = "https://sefin.nfse.gov.br/SefinNacional/nfse";

const prisma = new PrismaClient();
const cleanString = (str: string | null) => str ? str.replace(/\D/g, '') : '';

// --- HELPER: CONTEXTO ---
async function getEmpresaContexto(userId: string, contextId: string | null) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role);
    if (isStaff && contextId && contextId !== 'null' && contextId !== 'undefined') return contextId; 
    if (!contextId || contextId === 'null' || contextId === 'undefined') return user.empresaId;
    const vinculo = await prisma.contadorVinculo.findUnique({
        where: { contadorId_empresaId: { contadorId: userId, empresaId: contextId } }
    });
    return (vinculo && vinculo.status === 'APROVADO') ? contextId : null;
}

// --- HELPER: CERTIFICADO ---
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
    } catch (e: any) { throw new Error(`Erro PFX: ${e.message}`); }
}

// --- FUNÇÃO DE ENVIO ---
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
        console.log(`[DEBUG] Enviando para: ${url}`);

        const xmlBuffer = Buffer.from(xmlDps, 'utf-8');
        const xmlGzip = zlib.gzipSync(xmlBuffer);
        const arquivoBase64 = xmlGzip.toString('base64');

        const payload = { 
            dpsXmlGZipB64: arquivoBase64 
        };

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
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
                xml: data.nfseXmlGZipB64 || data.xmlProcessado 
            }
        };

    } catch (error: any) {
        let erroMsg = error.message;
        let erroCodigo = "NET";
        let erroDetalhe = error.response?.data || { erro: "Sem resposta detalhada" };

        if (error.response) {
            erroCodigo = String(error.response.status);
            erroMsg = `Erro HTTP ${error.response.status}: ${error.response.statusText}`;
            console.error("Erro API Body:", JSON.stringify(error.response.data, null, 2));
        }

        return { 
            sucesso: false, 
            motivo: erroMsg, 
            listaErros: [{ 
                codigo: erroCodigo, 
                mensagem: erroDetalhe, 
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

    // Busca Prestador COM OS NOVOS CAMPOS
    const prestador = await prisma.empresa.findUnique({ where: { id: empresaIdAlvo } });
    const tomador = await prisma.empresa.findUnique({ where: { id: clienteId } });
    if (!prestador || !tomador) throw new Error("Empresas não encontradas.");

    // === GESTÃO DO SEQUENCIAL DPS ===
    // Incrementa AGORA para garantir unicidade na tentativa
    const novoNumeroDPS = (prestador.ultimoDPS || 0) + 1;
    
    // Atualiza o banco imediatamente para evitar colisão se outra nota for enviada em paralelo
    await prisma.empresa.update({
        where: { id: prestador.id },
        data: { ultimoDPS: novoNumeroDPS }
    });

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

    // Configuração Fiscal
    const cnaeLimpo = cleanString(codigoCnae);
    const isMEI = prestador.regimeTributario === 'MEI';
    let itemLc = '01.01'; 
    let codigoTribNacional = '010101'; 

    const regraFiscal = await prisma.globalCnae.findUnique({ where: { codigo: cnaeLimpo } });
    if (regraFiscal) {
        if (regraFiscal.itemLc) itemLc = regraFiscal.itemLc;
        if (regraFiscal.codigoTributacaoNacional) codigoTribNacional = cleanString(regraFiscal.codigoTributacaoNacional);
    }

    // === MONTAGEM DO ID DPS PADRÃO NACIONAL ===
    // Formato: DPS + IBGE(7) + Amb(1) + CNPJ(14) + Serie(5) + Numero(15)
    
    const ibgePrestador = cleanString(prestador.codigoIbge).padStart(7, '0');
    const ambienteCodigo = prestador.ambiente === 'PRODUCAO' ? '1' : '2'; // 1=Prod, 2=Hom
    const cnpjPrestador = cleanString(prestador.documento);
    const serieDps = (prestador.serieDPS || "900").padStart(5, '0');
    const nDps = novoNumeroDPS.toString().padStart(15, '0');

    // ID de 45 Caracteres (3 letras + 42 números)
    const idDps = `DPS${ibgePrestador}${ambienteCodigo}${cnpjPrestador}${serieDps}${nDps}`;

    const dhEmiss = new Date().toISOString();
    const dCompet = new Date().toISOString().split('T')[0];
    const valServ = parseFloat(valor).toFixed(2);

    // === XML ===
    // Nota: 'nDPS' dentro do XML é numérico simples, sem padding excessivo, mas o ID precisa do padding.
    const xmlDPS = `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="${idDps}" versao="1.00">
    <dhEmiss>${dhEmiss}</dhEmiss>
    <dCompet>${dCompet}</dCompet>
    <serie>${parseInt(serieDps)}</serie>
    <nDPS>${novoNumeroDPS}</nDPS>
    <tpEmit>1</tpEmit>
    <prestador>
      <cpfCNPJ>
        <cnpj>${cnpjPrestador}</cnpj>
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
        message: `Gerado DPS Nº ${novoNumeroDPS} (Série ${serieDps}). ID: ${idDps}`,
        empresaId: prestador.id,
        vendaId: venda.id,
        details: { xmlGerado: xmlDPS } 
    });

    const respostaPortal = await enviarParaPortalNacional(xmlDPS, prestador);

    if (!respostaPortal.sucesso) {
        await prisma.venda.update({ where: { id: venda.id }, data: { status: 'ERRO_EMISSAO' } });
        
        await createLog({
            level: 'ERRO', action: 'ERRO_EMISSAO_PORTAL',
            message: `Falha: ${respostaPortal.motivo}`,
            empresaId: prestador.id,
            vendaId: venda.id,
            details: respostaPortal.listaErros[0]?.mensagem || "Erro desconhecido"
        });
        
        return NextResponse.json({ error: "Emissão falhou.", details: respostaPortal.listaErros }, { status: 400 });
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
        details: { stack: error.stack }
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- API GET (LISTAGEM) ---
export async function GET(request: Request) {
    // ... (mesmo código do GET anterior) ...
    return NextResponse.json({ data: [], meta: { total: 0, page: 1, totalPages: 1 } });
}