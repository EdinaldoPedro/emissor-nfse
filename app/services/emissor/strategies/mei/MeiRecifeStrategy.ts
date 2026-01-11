import { BaseStrategy } from '../BaseStrategy';
import { IEmissorStrategy, IDadosEmissao, IResultadoEmissao, IResultadoConsulta, IResultadoCancelamento } from '../../interfaces/IEmissorStrategy';
import axios from 'axios';
import https from 'https';
import crypto from 'crypto';
import zlib from 'zlib';

export class MeiRecifeStrategy extends BaseStrategy implements IEmissorStrategy {
    
    // 1. EMISSÃO (Mantido)
    async executar(dados: IDadosEmissao): Promise<IResultadoEmissao> {
        const { prestador, tomador, servico, numeroDPS, serieDPS, ambiente } = dados;
        try {
            this.validarCertificado(prestador);
            this.validarTomador(tomador); 
            if (!prestador.codigoIbge) throw new Error("IBGE do prestador não informado.");
            if (!servico.codigoTribNacional) throw new Error("Classificação Fiscal incompleta.");
            if (!tomador.logradouro || !tomador.numero || !tomador.cep || !tomador.codigoIbge) throw new Error("Endereço do tomador incompleto.");
            if (servico.valor <= 0) throw new Error("O valor deve ser maior que zero.");
        } catch (error: any) {
            return { sucesso: false, motivo: "Validação: " + error.message, erros: [{ codigo: "VAL_ERR", mensagem: error.message }] };
        }
        const dataAgora = new Date();
        const dhEmi = this.formatarDataSefaz(dataAgora); 
        const dCompet = dhEmi.split('T')[0];
        const valServ = servico.valor.toFixed(2);
        const ibgePrestador = this.cleanString(prestador.codigoIbge).padStart(7, '0');
        const docLimpo = this.cleanString(prestador.documento);
        const cnpjPrestador = docLimpo.padStart(14, '0');
        const tpAmb = ambiente === 'PRODUCAO' ? '1' : '2'; 
        const tpInsc = docLimpo.length === 14 ? '2' : '1';
        const serieLimpa = this.cleanString(serieDPS);
        const seriePad = serieLimpa.padStart(5, '0'); 
        const nDps = String(numeroDPS);
        const nDpsPad = nDps.padStart(15, '0');
        const idDps = `DPS${ibgePrestador}${tpInsc}${cnpjPrestador}${seriePad}${nDpsPad}`;
        const tomadorCNPJ = this.cleanString(tomador.documento);
        const tomadorCEP = this.cleanString(tomador.cep);
        const tomadorIBGE = this.cleanString(tomador.codigoIbge);
        
        const xml = `<?xml version="1.0" encoding="UTF-8"?>` + 
        `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">` + 
            `<infDPS Id="${idDps}">` + 
                `<tpAmb>${tpAmb}</tpAmb>` + 
                `<dhEmi>${dhEmi}</dhEmi>` + 
                `<verAplic>1.00</verAplic>` + 
                `<serie>${parseInt(serieLimpa)}</serie>` + 
                `<nDPS>${nDps}</nDPS>` + 
                `<dCompet>${dCompet}</dCompet>` + 
                `<tpEmit>1</tpEmit>` + 
                `<cLocEmi>${ibgePrestador}</cLocEmi>` + 
                `<prest>` + 
                    `<CNPJ>${cnpjPrestador}</CNPJ>` + 
                    (prestador.telefone ? `<fone>${this.cleanString(prestador.telefone)}</fone>` : '') +
                    `<regTrib><opSimpNac>2</opSimpNac><regEspTrib>0</regEspTrib></regTrib>` + 
                `</prest>` + 
                `<toma>` + 
                    `<CNPJ>${tomadorCNPJ}</CNPJ>` + 
                    `<xNome>${tomador.razaoSocial}</xNome>` + 
                    `<end><endNac><cMun>${tomadorIBGE}</cMun><CEP>${tomadorCEP}</CEP></endNac><xLgr>${tomador.logradouro}</xLgr><nro>${tomador.numero}</nro><xBairro>${tomador.bairro || 'Centro'}</xBairro></end>` + 
                    (tomador.email ? `<email>${tomador.email}</email>` : '') + 
                    (tomador.telefone ? `<fone>${this.cleanString(tomador.telefone)}</fone>` : '') + 
                `</toma>` + 
                `<serv>` + 
                    `<locPrest><cLocPrestacao>${ibgePrestador}</cLocPrestacao></locPrest>` + 
                    `<cServ><cTribNac>${this.cleanString(servico.codigoTribNacional)}</cTribNac><xDescServ>${servico.descricao}</xDescServ></cServ>` + 
                `</serv>` + 
                `<valores><vServPrest><vServ>${valServ}</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun><totTrib><indTotTrib>0</indTotTrib></totTrib></trib></valores>` + 
            `</infDPS>` + 
        `</DPS>`;
        try {
            const xmlAssinado = this.assinarXML(xml, idDps, prestador);
            return this.transmitirXML(xmlAssinado, prestador);
        } catch (error: any) {
            return { sucesso: false, motivo: "Erro na Assinatura Local: " + error.message, erros: [{ codigo: "SIGN_ERR", mensagem: error.message }] };
        }
    }

    // 2. CONSULTA (Mantido)
    async consultar(chave: string, empresa: any): Promise<IResultadoConsulta> {
        try {
            const credenciais = this.extrairCredenciais(empresa.certificadoA1, empresa.senhaCertificado);
            const httpsAgent = new https.Agent({ cert: credenciais.cert, key: credenciais.key, rejectUnauthorized: false });
            const urlBase = empresa.ambiente === 'PRODUCAO' 
                ? "https://sefin.nfse.gov.br/SefinNacional/nfse" 
                : "https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse";
            const urlConsulta = `${urlBase}/${chave}`;
            console.log(`[CONSULTA] GET ${urlConsulta}`);
            const response = await axios.get(urlConsulta, {
                headers: { 
                    'Authorization': 'Basic ' + Buffer.from(`${this.cleanString(empresa.documento)}:${empresa.senhaCertificado}`).toString('base64')
                },
                httpsAgent
            });
            const data = response.data;
            let xmlRetorno = '';
            if (data.nfseXmlGZipB64) {
                const bufferRetorno = Buffer.from(data.nfseXmlGZipB64, 'base64');
                xmlRetorno = zlib.gunzipSync(bufferRetorno).toString('utf-8');
            } else if (typeof data === 'string' && data.includes('<')) {
                xmlRetorno = data;
            } else {
                xmlRetorno = JSON.stringify(data);
            }
            let numeroReal = '';
            const matchNum = xmlRetorno.match(/<nNfse>(\d+)<\/nNfse>/i) || xmlRetorno.match(/<nNFSe>(\d+)<\/nNFSe>/i);
            if (matchNum) numeroReal = matchNum[1];
            let protocoloRecuperado = data.protocolo || '';
            if (!protocoloRecuperado) {
                 let match = xmlRetorno.match(/:?nProt>(\d+)<\//i) || xmlRetorno.match(/"protocolo"\s*:\s*"?(\d+)"?/i);
                 if (!match) match = xmlRetorno.match(/:?nDFSe>(\d+)<\//i);
                 if (match) protocoloRecuperado = match[1];
                 else if (!protocoloRecuperado) protocoloRecuperado = chave;
            }
            let situacaoAtual: 'AUTORIZADA' | 'CANCELADA' = 'AUTORIZADA';
            if (xmlRetorno.includes('<cSit>2</cSit>') || 
                xmlRetorno.includes('<cSit>3</cSit>') || 
                xmlRetorno.includes('<e101101>')) {
                situacaoAtual = 'CANCELADA';
                console.log("[CONSULTA] Nota detectada como CANCELADA na Sefaz.");
            }
            console.log(`[CONSULTA] Status: ${situacaoAtual} | Protocolo: ${protocoloRecuperado}`);
            if (numeroReal || xmlRetorno.includes('Autorizado') || xmlRetorno.includes('chaveAcesso') || situacaoAtual === 'CANCELADA') {
                return {
                    sucesso: true,
                    situacao: situacaoAtual,
                    numeroNota: numeroReal || '0',
                    protocolo: protocoloRecuperado, 
                    xmlDistribuicao: Buffer.from(xmlRetorno).toString('base64'),
                    pdfBase64: null,
                    motivo: 'Consulta realizada com sucesso.'
                };
            }
            return { sucesso: false, situacao: 'ERRO', motivo: 'Sefaz retornou, mas sem XML válido.' };
        } catch (error: any) {
            console.error("Erro Axios GET:", error.message);
            return { sucesso: false, situacao: 'ERRO', motivo: error.message };
        }
    }

    // === 3. CANCELAMENTO (COM CORREÇÃO PARA E0840) ===
    async cancelar(chave: string, protocolo: string, motivoCompleto: string, empresa: any): Promise<IResultadoCancelamento> {
        try {
            const dhEvento = this.formatarDataSefaz(new Date());
            const tpEvento = '101101';
            const idPed = `PRE${chave}${tpEvento}`; 
            const nProtReal = this.cleanString(protocolo);
            const MAPA_MOTIVOS: Record<string, string> = {
                "Erro na emissão": "1", "Serviço não prestado": "2", "Erro de assinatura": "3", "Duplicidade da nota": "4"
            };
            let cMotivo = "1";
            let xMotivo = motivoCompleto;
            const partesMotivo = motivoCompleto.split(':');
            if (partesMotivo.length > 1) {
                const chaveMotivo = partesMotivo[0].trim();
                if (MAPA_MOTIVOS[chaveMotivo]) {
                    cMotivo = MAPA_MOTIVOS[chaveMotivo];
                    xMotivo = partesMotivo.slice(1).join(':').trim();
                }
            }
            if (xMotivo.length < 15) xMotivo += " (Solicitação do contribuinte)";
            const infPedRegContent = 
                `<tpAmb>${empresa.ambiente === 'PRODUCAO' ? '1' : '2'}</tpAmb>` +
                `<verAplic>1.00</verAplic>` +
                `<dhEvento>${dhEvento}</dhEvento>` +
                `<CNPJAutor>${this.cleanString(empresa.documento)}</CNPJAutor>` +
                `<chNFSe>${chave}</chNFSe>` +
                `<${'e' + tpEvento}>` + 
                    `<xDesc>Cancelamento de NFS-e</xDesc>` +
                    `<cMotivo>${cMotivo}</cMotivo>` +
                    `<xMotivo>${xMotivo}</xMotivo>` + 
                `</${'e' + tpEvento}>`;
            const xmlParaAssinar = `<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00"><infPedReg Id="${idPed}">${infPedRegContent}</infPedReg></pedRegEvento>`;
            const xmlAssinado = this.assinarPedidoEvento(xmlParaAssinar, idPed, empresa);
            const xmlEnvio = `<?xml version="1.0" encoding="UTF-8"?>${xmlAssinado}`;
            const xmlBuffer = Buffer.from(xmlEnvio, 'utf-8');
            const xmlGzip = zlib.gzipSync(xmlBuffer);
            const payloadBase64 = xmlGzip.toString('base64');
            const credenciais = this.extrairCredenciais(empresa.certificadoA1, empresa.senhaCertificado);
            const httpsAgent = new https.Agent({ cert: credenciais.cert, key: credenciais.key, rejectUnauthorized: false });
            const urlBase = empresa.ambiente === 'PRODUCAO' 
                ? "https://sefin.nfse.gov.br/SefinNacional/nfse"
                : "https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse";
            const urlEventos = `${urlBase}/${chave}/eventos`;
            console.log(`[CANCELAMENTO] ID: ${idPed} | Evento: ${tpEvento} | URL: ${urlEventos}`);
            
            const response = await axios.post(urlEventos, 
                { pedidoRegistroEventoXmlGZipB64: payloadBase64 }, 
                {
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + Buffer.from(`${this.cleanString(empresa.documento)}:${empresa.senhaCertificado}`).toString('base64') },
                    httpsAgent
                }
            );

            // Se chegou aqui, é sucesso direto (200)
            const data = response.data;
            const zipRetorno = data.eventoXmlGZipB64 || data.pedidoRegistroEventoXmlGZipB64;
            if (zipRetorno) {
                 const buff = Buffer.from(zipRetorno, 'base64');
                 const xmlRetorno = zlib.gunzipSync(buff).toString('utf-8');
                 return {
                     sucesso: true,
                     dataCancelamento: new Date(),
                     xmlEvento: Buffer.from(xmlRetorno).toString('base64'),
                     motivo: 'Cancelamento homologado.'
                 };
            }
            return { sucesso: false, motivo: "Evento rejeitado ou retorno inválido." };

        } catch (error: any) {
            // === AQUI ESTÁ A CORREÇÃO PARA E0840 ===
            let msgErro = error.message;
            if (error.response && error.response.data) {
                const erroData = JSON.stringify(error.response.data);
                console.error("[ERRO SEFAZ DETALHADO]", erroData);
                
                // Se o erro for E0840, significa que JÁ ESTÁ CANCELADO! Tratamos como SUCESSO.
                if (erroData.includes("E0840")) {
                    console.log("[CANCELAMENTO] Erro E0840 detectado: Nota já está cancelada. Sincronizando...");
                    return {
                        sucesso: true,
                        dataCancelamento: new Date(),
                        motivo: "Nota já estava cancelada na Sefaz (Sincronizado)."
                    };
                }

                msgErro = `Sefaz Recusou: ${erroData.substring(0, 100)}...`;
            }
            return { sucesso: false, motivo: msgErro };
        }
    }

    private assinarPedidoEvento(xml: string, tagId: string, empresa: any): string {
        try {
            const credenciais = this.extrairCredenciais(empresa.certificadoA1, empresa.senhaCertificado);
            const certClean = credenciais.cert.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|[\r\n]/g, '');
            const match = xml.match(/<infPedReg[\s\S]*?<\/infPedReg>/);
            if (!match) throw new Error("Tag infPedReg não encontrada.");
            let nodeToSign = match[0]; 
            if (!nodeToSign.includes('xmlns="http://www.sped.fazenda.gov.br/nfse"')) {
                nodeToSign = nodeToSign.replace('<infPedReg', '<infPedReg xmlns="http://www.sped.fazenda.gov.br/nfse"');
            }
            const shasum = crypto.createHash('sha256');
            shasum.update(nodeToSign, 'utf8');
            const digestValue = shasum.digest('base64');
            const signedInfo = 
`<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod><Reference URI="#${tagId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
            const signer = crypto.createSign('RSA-SHA256');
            signer.update(signedInfo);
            const signatureValue = signer.sign(credenciais.key, 'base64');
            const signatureXML = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certClean}</X509Certificate></X509Data></KeyInfo></Signature>`;
            return xml.replace('</pedRegEvento>', `${signatureXML}</pedRegEvento>`);
        } catch (e: any) { throw new Error(e.message); }
    }
    
    private assinarXML(xml: string, tagId: string, empresa: any): string {
        try {
            const credenciais = this.extrairCredenciais(empresa.certificadoA1, empresa.senhaCertificado);
            const certClean = credenciais.cert.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|[\r\n]/g, '');
            const match = xml.match(/<infDPS[\s\S]*?<\/infDPS>/);
            if (!match) throw new Error("Tag infDPS não encontrada.");
            let nodeToSign = match[0]; 
            if (!nodeToSign.includes('xmlns="http://www.sped.fazenda.gov.br/nfse"')) {
                nodeToSign = nodeToSign.replace('<infDPS', '<infDPS xmlns="http://www.sped.fazenda.gov.br/nfse"');
            }
            const shasum = crypto.createHash('sha256');
            shasum.update(nodeToSign, 'utf8');
            const digestValue = shasum.digest('base64');
            const signedInfo = 
`<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod><Reference URI="#${tagId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;
            const signer = crypto.createSign('RSA-SHA256');
            signer.update(signedInfo);
            const signatureValue = signer.sign(credenciais.key, 'base64');
            const signatureXML = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certClean}</X509Certificate></X509Data></KeyInfo></Signature>`;
            return xml.replace('</DPS>', `${signatureXML}</DPS>`);
        } catch (e: any) { throw new Error(e.message); }
    }
}