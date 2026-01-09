import axios from 'axios';
import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import zlib from 'zlib';
import crypto from 'crypto'; 
import { IResultadoEmissao } from '../interfaces/IEmissorStrategy';

const URL_HOMOLOGACAO = "https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse"; 
const URL_PRODUCAO = "https://sefin.nfse.gov.br/SefinNacional/nfse";

export abstract class BaseStrategy {
    
    protected cleanString(str: string | null): string {
        return str ? str.replace(/\D/g, '') : '';
    }

    protected formatarDataSefaz(date: Date): string {
        const timestamp = date.getTime();
        const offsetBrasilia = -3 * 60 * 60 * 1000;
        const dateBR = new Date(timestamp + offsetBrasilia);
        
        const pad = (n: number) => n.toString().padStart(2, '0');
        
        const YYYY = dateBR.getUTCFullYear();
        const MM = pad(dateBR.getUTCMonth() + 1);
        const DD = pad(dateBR.getUTCDate());
        const HH = pad(dateBR.getUTCHours());
        const mm = pad(dateBR.getUTCMinutes());
        const ss = pad(dateBR.getUTCSeconds());
        
        return `${YYYY}-${MM}-${DD}T${HH}:${mm}:${ss}-03:00`;
    }

    protected validarCertificado(empresa: any): void {
        if (!empresa.certificadoA1) throw new Error("Certificado Digital não encontrado.");
        if (!empresa.senhaCertificado) throw new Error("Senha do certificado não configurada.");
    }

    protected validarTomador(tomador: any): void {
        if (!tomador.documento) throw new Error("Documento do Tomador (CPF/CNPJ) é obrigatório.");
        if (!tomador.razaoSocial) throw new Error("Nome/Razão Social do Tomador é obrigatório.");
        if (!tomador.cep || !tomador.logradouro || !tomador.numero) {
             throw new Error("Endereço do Tomador incompleto. CEP, Logradouro e Número são obrigatórios.");
        }
    }

    // --- ASSINATURA CORRIGIDA (PADRÃO VÁLIDO IGUAL AO EXEMPLO) ---
    protected assinarXML(xml: string, tagId: string, empresa: any): string {
        try {
            const credenciais = this.extrairCredenciais(empresa.certificadoA1, empresa.senhaCertificado);
            
            const certClean = credenciais.cert
                .replace('-----BEGIN CERTIFICATE-----', '')
                .replace('-----END CERTIFICATE-----', '')
                .replace(/[\r\n]/g, '');

            // 1. Extrai infDPS
            const match = xml.match(/<infDPS[\s\S]*?<\/infDPS>/);
            if (!match) throw new Error("Tag infDPS não encontrada para assinatura.");
            
            let nodeToSign = match[0]; 

            // 2. TRUQUE DO HASH (Virtual Injection)
            // O arquivo enviado NÃO terá xmlns na tag infDPS (para não ser redundante),
            // mas o Hash TEM que ser calculado como se tivesse (C14N Exclusive).
            if (!nodeToSign.includes('xmlns="http://www.sped.fazenda.gov.br/nfse"')) {
                // Injeta o xmlns virtualmente apenas para o hash
                nodeToSign = nodeToSign.replace('<infDPS', '<infDPS xmlns="http://www.sped.fazenda.gov.br/nfse"');
            }

            // 3. Calcula Digest (SHA-256)
            const shasum = crypto.createHash('sha256');
            shasum.update(nodeToSign, 'utf8');
            const digestValue = shasum.digest('base64');

            // 4. Monta SignedInfo (EXATAMENTE IGUAL AO XML VÁLIDO)
            // - Sem espaços entre tags
            // - Com xmlns na tag SignedInfo
            // - Algoritmo xml-exc-c14n# (SEM WithComments)
            const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod><Reference URI="#${tagId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

            // 5. Assina
            const signer = crypto.createSign('RSA-SHA256');
            signer.update(signedInfo);
            const signatureValue = signer.sign(credenciais.key, 'base64');

            // 6. Monta Bloco Signature
            const signatureXML = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certClean}</X509Certificate></X509Data></KeyInfo></Signature>`;

            // 7. Insere no XML Final
            return xml.replace('</DPS>', `${signatureXML}</DPS>`);

        } catch (e: any) {
            throw new Error(`Erro assinatura: ${e.message}`);
        }
    }

    protected extrairCredenciais(pfxBase64: string | null, senha: string | null) {
        if (!pfxBase64) throw new Error("Certificado digital não encontrado.");
        
        try {
            const pfxBuffer = Buffer.from(pfxBase64, 'base64');
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

            if (!cert || !key) throw new Error("Chaves não encontradas no PFX.");

            return {
                cert: forge.pki.certificateToPem(cert),
                key: forge.pki.privateKeyToPem(key)
            };
        } catch (e: any) {
            throw new Error(`Erro no Certificado: ${e.message}`);
        }
    }

    protected async transmitirXML(xml: string, empresa: any): Promise<IResultadoEmissao> {
        try {
            const credenciais = this.extrairCredenciais(empresa.certificadoA1, empresa.senhaCertificado);
            
            const httpsAgent = new https.Agent({
                cert: credenciais.cert,
                key: credenciais.key,
                rejectUnauthorized: false,
                keepAlive: true
            });

            const url = empresa.ambiente === 'PRODUCAO' ? URL_PRODUCAO : URL_HOMOLOGACAO;
            console.log(`[STRATEGY] Enviando para: ${url}`);

            const xmlBuffer = Buffer.from(xml, 'utf-8');
            const xmlGzip = zlib.gzipSync(xmlBuffer);
            const arquivoBase64 = xmlGzip.toString('base64');

            const response = await axios.post(url, { dpsXmlGZipB64: arquivoBase64 }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from(`${this.cleanString(empresa.documento)}:${empresa.senhaCertificado}`).toString('base64') 
                },
                httpsAgent: httpsAgent,
                timeout: 60000
            });

            const data = response.data;
            
            if (data.erros && data.erros.length > 0) {
                 return {
                    sucesso: false,
                    xmlGerado: xml,
                    erros: data.erros,
                    motivo: "Rejeição pelo Portal Nacional"
                };
            }

            return {
                sucesso: true,
                xmlGerado: xml,
                notaGov: {
                    numero: data.numeroNfse || 'PENDENTE',
                    chave: data.chaveAcesso,
                    protocolo: data.protocolo,
                    xml: data.nfseXmlGZipB64 || data.xmlProcessado
                }
            };

        } catch (error: any) {
            let erroMsg = error.message;
            let detalhes = {};

            if (error.response) {
                erroMsg = `Erro HTTP ${error.response.status}: ${error.response.statusText}`;
                detalhes = error.response.data || {};
            }

            return {
                sucesso: false,
                motivo: erroMsg,
                xmlGerado: xml,
                erros: [{ codigo: "API_ERR", mensagem: detalhes }]
            };
        }
    }
}