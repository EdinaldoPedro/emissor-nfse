import { BaseStrategy } from '../BaseStrategy';
import { IEmissorStrategy, IDadosEmissao, IResultadoEmissao, IResultadoConsulta, IResultadoCancelamento } from '../../interfaces/IEmissorStrategy';
import axios from 'axios';
import https from 'https';
import crypto from 'crypto';
import zlib from 'zlib';

export class MeiRecifeStrategy extends BaseStrategy implements IEmissorStrategy {
    
    // === 1. EMISSÃO (Mantido igual - POST na raiz funciona para envio) ===
    async executar(dados: IDadosEmissao): Promise<IResultadoEmissao> {
        const { prestador, tomador, servico, numeroDPS, serieDPS, ambiente } = dados;

        // ... (Validações mantidas) ...
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

    // === 2. CONSULTA (CORRIGIDA: MUDANÇA PARA GET REST) ===
    async consultar(chave: string, empresa: any): Promise<IResultadoConsulta> {
        try {
            const credenciais = this.extrairCredenciais(empresa.certificadoA1, empresa.senhaCertificado);
            const httpsAgent = new https.Agent({ cert: credenciais.cert, key: credenciais.key, rejectUnauthorized: false });

            const urlBase = empresa.ambiente === 'PRODUCAO' 
                ? "https://sefin.nfse.gov.br/SefinNacional/nfse" 
                : "https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse";

            // A URL REST para consulta é GET /nfse/{chave}
            const urlConsulta = `${urlBase}/${chave}`;

            console.log(`[CONSULTA] GET ${urlConsulta}`);

            const response = await axios.get(urlConsulta, {
                headers: { 
                    'Authorization': 'Basic ' + Buffer.from(`${this.cleanString(empresa.documento)}:${empresa.senhaCertificado}`).toString('base64')
                },
                httpsAgent
            });

            // Se for REST, o retorno geralmente já é o objeto ou XML, sem precisar descompactar GZIP manual
            const data = response.data;
            
            // Verifica se veio campo compactado (padrão antigo) ou direto
            let xmlRetorno = '';
            
            if (data.nfseXmlGZipB64) {
                const bufferRetorno = Buffer.from(data.nfseXmlGZipB64, 'base64');
                xmlRetorno = zlib.gunzipSync(bufferRetorno).toString('utf-8');
            } else if (typeof data === 'string' && data.includes('<')) {
                xmlRetorno = data;
            } else {
                // Se vier JSON direto, tenta extrair
                xmlRetorno = JSON.stringify(data);
            }

            console.log("[CONSULTA SUCESSO] Resposta:", xmlRetorno.substring(0, 100));

            let numeroReal = '';
            const matchNum = xmlRetorno.match(/<nNfse>(\d+)<\/nNfse>/i) || xmlRetorno.match(/<nNFSe>(\d+)<\/nNFSe>/i);
            if (matchNum) numeroReal = matchNum[1];

            if (numeroReal || xmlRetorno.includes('Autorizado') || xmlRetorno.includes('chaveAcesso')) {
                return {
                    sucesso: true,
                    situacao: 'AUTORIZADA',
                    numeroNota: numeroReal,
                    xmlDistribuicao: Buffer.from(xmlRetorno).toString('base64'),
                    pdfBase64: null,
                    motivo: 'Nota recuperada com sucesso via GET.'
                };
            }

            return { sucesso: false, situacao: 'ERRO', motivo: 'Sefaz retornou, mas sem XML válido.' };

        } catch (error: any) {
            console.error("Erro Axios GET:", error.message);
            return { sucesso: false, situacao: 'ERRO', motivo: error.message };
        }
    }

    // === 3. CANCELAMENTO (CORRIGIDA: URL DE EVENTOS) ===
    async cancelar(chave: string, motivo: string, empresa: any): Promise<IResultadoCancelamento> {
        try {
            const dhEvento = this.formatarDataSefaz(new Date());
            const idEvento = `ID110111${chave}01`;
            
            const infEventoContent = 
                `<cOrgao>${this.cleanString(empresa.codigoIbge)}</cOrgao>` + 
                `<tpAmb>${empresa.ambiente === 'PRODUCAO' ? '1' : '2'}</tpAmb>` +
                `<CNPJ>${this.cleanString(empresa.documento)}</CNPJ>` +
                `<chNFSe>${chave}</chNFSe>` +
                `<dhEvento>${dhEvento}</dhEvento>` +
                `<tpEvento>110111</tpEvento>` + 
                `<nSeqEvento>1</nSeqEvento>` +
                `<detEvento versao="1.00">` +
                    `<descEvento>Cancelamento</descEvento>` +
                    `<nProt>0000000000000000</nProt>` +
                    `<xJust>${motivo.substring(0, 255)}</xJust>` + 
                `</detEvento>`;

            // Para POST de evento, o XML é necessário
            const xmlEvento = `<evento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00"><infEvento Id="${idEvento}">${infEventoContent}</infEvento></evento>`;

            const xmlAssinado = this.assinarEvento(xmlEvento, idEvento, empresa);

            const xmlBuffer = Buffer.from(xmlAssinado, 'utf-8');
            const xmlGzip = zlib.gzipSync(xmlBuffer);
            const payloadBase64 = xmlGzip.toString('base64');

            const credenciais = this.extrairCredenciais(empresa.certificadoA1, empresa.senhaCertificado);
            const httpsAgent = new https.Agent({ cert: credenciais.cert, key: credenciais.key, rejectUnauthorized: false });
            
            const urlBase = empresa.ambiente === 'PRODUCAO' 
                ? "https://sefin.nfse.gov.br/SefinNacional/nfse"
                : "https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse";
            
            // CORREÇÃO: URL específica de Eventos com a chave
            const urlEventos = `${urlBase}/${chave}/eventos`;

            console.log(`[CANCELAMENTO] Enviando para: ${urlEventos}`);

            const response = await axios.post(urlEventos, 
                { pedidoRegistroEventoXmlGZipB64: payloadBase64 }, // Chave corrigida conforme documentação (pedidoRegistro...)
                {
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + Buffer.from(`${this.cleanString(empresa.documento)}:${empresa.senhaCertificado}`).toString('base64') },
                    httpsAgent
                }
            );

            // Tenta decodificar o retorno
            const data = response.data;
            const zipRetorno = data.eventoXmlGZipB64 || data.pedidoRegistroEventoXmlGZipB64;

            if (zipRetorno) {
                 const buff = Buffer.from(zipRetorno, 'base64');
                 const xmlRetorno = zlib.gunzipSync(buff).toString('utf-8');
                 
                 if (xmlRetorno.includes('135') || xmlRetorno.includes('Evento registrado')) {
                     return {
                         sucesso: true,
                         dataCancelamento: new Date(),
                         xmlEvento: Buffer.from(xmlRetorno).toString('base64'),
                         motivo: 'Cancelamento homologado.'
                     };
                 }
            }

            return { sucesso: false, motivo: "Evento rejeitado ou retorno inválido." };

        } catch (error: any) {
            return { sucesso: false, motivo: error.message };
        }
    }

    private assinarEvento(xml: string, tagId: string, empresa: any): string {
        try {
            const credenciais = this.extrairCredenciais(empresa.certificadoA1, empresa.senhaCertificado);
            const certClean = credenciais.cert.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|[\r\n]/g, '');

            const match = xml.match(/<infEvento[\s\S]*?<\/infEvento>/);
            if (!match) throw new Error("Tag infEvento não encontrada.");
            let nodeToSign = match[0]; 
            
            if (!nodeToSign.includes('xmlns="http://www.sped.fazenda.gov.br/nfse"')) {
                nodeToSign = nodeToSign.replace('<infEvento', '<infEvento xmlns="http://www.sped.fazenda.gov.br/nfse"');
            }

            const shasum = crypto.createHash('sha256');
            shasum.update(nodeToSign, 'utf8');
            const digestValue = shasum.digest('base64');

            const signedInfo = 
`<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><Reference URI="#${tagId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

            const signer = crypto.createSign('RSA-SHA256');
            signer.update(signedInfo);
            const signatureValue = signer.sign(credenciais.key, 'base64');

            const signatureXML = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certClean}</X509Certificate></X509Data></KeyInfo></Signature>`;

            return xml.replace('</evento>', `${signatureXML}</evento>`);
        } catch (e: any) { throw new Error(e.message); }
    }
}