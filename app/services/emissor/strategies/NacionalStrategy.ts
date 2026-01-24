import { BaseStrategy } from './BaseStrategy';
import { IEmissorStrategy, IDadosEmissao, IResultadoEmissao, IResultadoConsulta, IResultadoCancelamento } from '../interfaces/IEmissorStrategy';
import axios from 'axios';
import https from 'https';
import crypto from 'crypto';
import zlib from 'zlib';
import { NacionalAdapter } from '../adapters/NacionalAdapter';
import { ICanonicalRps } from '../interfaces/ICanonicalRps';

export class NacionalStrategy extends BaseStrategy implements IEmissorStrategy {
    
    private adapter: NacionalAdapter;

    constructor() {
        super();
        this.adapter = new NacionalAdapter();
    }

    async executar(dados: IDadosEmissao): Promise<IResultadoEmissao> {
        const { prestador, tomador, servico, numeroDPS, serieDPS, ambiente } = dados;

        try {
            // 1. Validações Prévias
            this.validarCertificado(prestador);
            this.validarTomador(tomador);
            if (!servico.codigoTribNacional) throw new Error("CNAE/Tributação Nacional não definido.");

            // 2. Inteligência Fiscal
            const isMei = prestador.regimeTributario === 'MEI';
            const aliquotaFinal = isMei ? 0 : (servico.valor > 0 ? (servico.aliquota || Number(prestador.aliquotaPadrao) || 0) : 0);
            const valorIss = (servico.valor * aliquotaFinal) / 100;

            // === 3. TRATAMENTO DE RETENÇÕES (CORREÇÃO DE ROBUSTEZ) ===
            // Garante que se vier null/undefined do banco/front, viram zeros aqui.
            const r = (servico as any).retencoes || {}; 
            const retencoes = {
                pis: { valor: Number(r.pis?.valor) || 0, retido: !!r.pis?.retido },
                cofins: { valor: Number(r.cofins?.valor) || 0, retido: !!r.cofins?.retido },
                inss: { valor: Number(r.inss?.valor) || 0, retido: !!r.inss?.retido },
                ir: { valor: Number(r.ir?.valor) || 0, retido: !!r.ir?.retido },
                csll: { valor: Number(r.csll?.valor) || 0, retido: !!r.csll?.retido }
            };

            // Cálculo do Líquido (Valor Bruto - ISS Retido - Federais Retidos)
            let totalRetido = 0;
            if (servico.issRetido) totalRetido += valorIss;
            if (retencoes.pis.retido) totalRetido += retencoes.pis.valor;
            if (retencoes.cofins.retido) totalRetido += retencoes.cofins.valor;
            if (retencoes.inss.retido) totalRetido += retencoes.inss.valor;
            if (retencoes.ir.retido) totalRetido += retencoes.ir.valor;
            if (retencoes.csll.retido) totalRetido += retencoes.csll.valor;

            const valorLiquido = servico.valor - totalRetido;

            // 4. Montagem do Objeto Canônico (Domínio)
            const rps: ICanonicalRps = {
                prestador: {
                    id: prestador.id,
                    documento: prestador.documento,
                    inscricaoMunicipal: prestador.inscricaoMunicipal,
                    regimeTributario: prestador.regimeTributario as any,
                    endereco: {
                        codigoIbge: prestador.codigoIbge,
                        uf: prestador.uf
                    },
                    configuracoes: {
                        aliquotaPadrao: Number(prestador.aliquotaPadrao),
                        issRetido: servico.issRetido !== undefined ? servico.issRetido : prestador.issRetidoPadrao,
                        tipoTributacao: prestador.tipoTributacaoPadrao,
                        regimeEspecial: prestador.regimeEspecialTributacao
                    }
                },
                tomador: {
                    documento: tomador.documento,
                    razaoSocial: tomador.razaoSocial,
                    email: tomador.email,
                    telefone: tomador.telefone,
                    endereco: {
                        cep: tomador.cep,
                        logradouro: tomador.logradouro,
                        numero: tomador.numero,
                        bairro: tomador.bairro || 'Centro',
                        codigoIbge: tomador.codigoIbge,
                        uf: tomador.uf
                    }
                },
                servico: {
                    valor: servico.valor,
                    valorLiquido: valorLiquido,
                    descricao: servico.descricao,
                    cnae: servico.cnae,
                    codigoTributacaoNacional: servico.codigoTribNacional,
                    itemListaServico: servico.itemLc,
                    
                    // Repassa propriedades para o Adapter saber se adiciona tags ou não
                    codigoNbs: (servico as any).codigoNbs, // Caso venha do backend
                    codigoTributacaoMunicipal: (servico as any).codigoTributacaoMunicipal, // Caso venha do backend

                    aliquotaAplicada: aliquotaFinal,
                    valorIss: valorIss,
                    issRetido: servico.issRetido || false,
                    tipoTributacao: prestador.tipoTributacaoPadrao || '1',
                    
                    retencoes: retencoes // Agora garantido que não é undefined
                },
                meta: {
                    ambiente: ambiente,
                    serie: serieDPS,
                    numero: numeroDPS,
                    dataEmissao: new Date()
                }
            };

            // 5. Adapter: Transformar RPS em XML
            const xmlGerado = this.adapter.toXml(rps);

            // 6. Assinar e Transmitir
            const idDps = `DPS${this.cleanString(rps.prestador.endereco.codigoIbge).padStart(7,'0')}2${this.cleanString(rps.prestador.documento).padStart(14,'0')}${this.cleanString(rps.meta.serie).padStart(5,'0')}${String(rps.meta.numero).padStart(15,'0')}`;
            
            const xmlAssinado = this.assinarXML(xmlGerado, idDps, prestador);
            return this.transmitirXML(xmlAssinado, prestador);

        } catch (error: any) {
            return { 
                sucesso: false, 
                motivo: `Erro Motor Fiscal: ${error.message}`, 
                erros: [{ codigo: "MOTOR_ERR", mensagem: error.message }] 
            };
        }
    }

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
            }

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

    async cancelar(chave: string, protocolo: string, motivoCompleto: string, empresa: any): Promise<IResultadoCancelamento> {
        try {
            const dhEvento = this.formatarDataSefaz(new Date());
            const tpEvento = '101101';
            const idPed = `PRE${chave}${tpEvento}`; 
            
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

            const response = await axios.post(urlEventos, 
                { pedidoRegistroEventoXmlGZipB64: payloadBase64 }, 
                {
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + Buffer.from(`${this.cleanString(empresa.documento)}:${empresa.senhaCertificado}`).toString('base64') },
                    httpsAgent
                }
            );

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
            let msgErro = error.message;
            if (error.response && error.response.data) {
                const erroData = JSON.stringify(error.response.data);
                if (erroData.includes("E0840")) {
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

            const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod><Reference URI="#${tagId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

            const signer = crypto.createSign('RSA-SHA256');
            signer.update(signedInfo);
            const signatureValue = signer.sign(credenciais.key, 'base64');

            const signatureXML = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certClean}</X509Certificate></X509Data></KeyInfo></Signature>`;

            return xml.replace('</pedRegEvento>', `${signatureXML}</pedRegEvento>`);
        } catch (e: any) { throw new Error(e.message); }
    }
}