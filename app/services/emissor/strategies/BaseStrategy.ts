import axios from 'axios';
import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import zlib from 'zlib';
import { IResultadoEmissao } from '../interfaces/IEmissorStrategy';

// Endpoints Oficiais
const URL_HOMOLOGACAO = "https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse"; 
const URL_PRODUCAO = "https://sefin.nfse.gov.br/SefinNacional/nfse";

export abstract class BaseStrategy {
    
    protected cleanString(str: string | null): string {
        return str ? str.replace(/\D/g, '') : '';
    }

    // --- NOVO: Validação Básica Compartilhada ---
    protected validarCertificado(empresa: any): void {
        if (!empresa.certificadoA1) {
            throw new Error("Certificado Digital não encontrado. Faça o upload nas configurações da empresa.");
        }
        if (!empresa.senhaCertificado) {
            throw new Error("Senha do certificado não configurada.");
        }
    }

    protected validarTomador(tomador: any): void {
        if (!tomador.documento) throw new Error("Documento do Tomador (CPF/CNPJ) é obrigatório.");
        if (!tomador.razaoSocial) throw new Error("Nome/Razão Social do Tomador é obrigatório.");
        // Endereço é crucial para NFS-e Nacional
        if (!tomador.cep || !tomador.logradouro || !tomador.numero) {
             throw new Error("Endereço do Tomador incompleto. CEP, Logradouro e Número são obrigatórios.");
        }
    }
    // --------------------------------------------

    protected extrairCredenciais(pfxBase64: string | null, senha: string | null) {
        // ... (código anterior de extração mantido igual) ...
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
            
            // Tratamento de sucesso da API (mesmo que venha erros de negócio)
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
                console.error("[API ERRO BODY]", JSON.stringify(detalhes, null, 2));
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