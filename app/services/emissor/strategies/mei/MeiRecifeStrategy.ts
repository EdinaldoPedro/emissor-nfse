import { BaseStrategy } from '../BaseStrategy';
import { IEmissorStrategy, IDadosEmissao, IResultadoEmissao } from '../../interfaces/IEmissorStrategy';

export class MeiRecifeStrategy extends BaseStrategy implements IEmissorStrategy {
    
    async executar(dados: IDadosEmissao): Promise<IResultadoEmissao> {
        const { prestador, tomador, servico, numeroDPS, serieDPS, ambiente } = dados;

        // === 1. VALIDAÇÃO ===
        try {
            this.validarCertificado(prestador);
            this.validarTomador(tomador); 

            // Nota: O portal nacional aceita qualquer IBGE, mas validamos aqui para segurança
            if (!prestador.codigoIbge) {
                throw new Error("IBGE do prestador não informado.");
            }
            
            if (!servico.codigoTribNacional) {
                 throw new Error("Classificação Fiscal incompleta (Cód. Trib. Nacional).");
            }

            if (!tomador.logradouro || !tomador.numero || !tomador.cep || !tomador.codigoIbge) {
                throw new Error("Endereço do tomador incompleto.");
            }

            if (servico.valor <= 0) {
                throw new Error("O valor deve ser maior que zero.");
            }

        } catch (error: any) {
            return {
                sucesso: false,
                motivo: "Validação: " + error.message,
                erros: [{ codigo: "VAL_ERR", mensagem: error.message }]
            };
        }

        // === 2. PREPARAÇÃO DOS DADOS (FORMATO NACIONAL RIGOROSO) ===
        const dataAgora = new Date();
        const dhEmi = this.formatarDataSefaz(dataAgora); 
        const dCompet = dhEmi.split('T')[0]; // AAAA-MM-DD
        
        const valServ = servico.valor.toFixed(2);
        
        // Formatação dos campos chave para o ID (Total 42 dígitos numéricos após DPS)
        const ibgePrestador = this.cleanString(prestador.codigoIbge).padStart(7, '0'); // 7 dígitos
        const cnpjPrestador = this.cleanString(prestador.documento).padStart(14, '0'); // 14 dígitos
        const tpAmb = ambiente === 'PRODUCAO' ? '1' : '2'; // 1 dígito
        
        // Série: Deve ter 5 dígitos (ex: "900" vira "00900")
        const serieLimpa = this.cleanString(serieDPS);
        const seriePad = serieLimpa.padStart(5, '0'); 
        
        // Número: Deve ter 15 dígitos (ex: "44" vira "000000000000044")
        const nDps = String(numeroDPS);
        const nDpsPad = nDps.padStart(15, '0');
        
        // MONTAGEM DO ID (Deve ter 45 caracteres: DPS + 42 números)
        // Estrutura: DPS + IBGE(7) + Amb(1) + CNPJ(14) + Série(5) + Número(15)
        const idDps = `DPS${ibgePrestador}${tpAmb}${cnpjPrestador}${seriePad}${nDpsPad}`;

        console.log(`[STRATEGY] Gerando XML com ID: ${idDps} (Tamanho: ${idDps.length})`);

        const tomadorCNPJ = this.cleanString(tomador.documento);
        const tomadorCEP = this.cleanString(tomador.cep);
        const tomadorIBGE = this.cleanString(tomador.codigoIbge);
        
        // === 3. MONTAGEM XML ===
        // Importante: O xmlns na tag infDPS é vital para a assinatura bater com o validador da Sefaz
        const xml = `<?xml version="1.0" encoding="UTF-8"?>` + 
        `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">` + 
            `<infDPS Id="${idDps}">` + 
                `<tpAmb>${tpAmb}</tpAmb>` + 
                `<dhEmi>${dhEmi}</dhEmi>` + 
                `<verAplic>1.00</verAplic>` + 
                `<serie>${parseInt(serieLimpa)}</serie>` + // No XML vai sem zero à esquerda
                `<nDPS>${nDps}</nDPS>` + 
                `<dCompet>${dCompet}</dCompet>` + 
                `<tpEmit>1</tpEmit>` + 
                `<cLocEmi>${ibgePrestador}</cLocEmi>` + 
                `<prest>` + 
                    `<CNPJ>${cnpjPrestador}</CNPJ>` + 
                    (prestador.telefone ? `<fone>${this.cleanString(prestador.telefone)}</fone>` : '') +
                    `<regTrib>` + 
                        `<opSimpNac>2</opSimpNac>` + // 2 = Sim - MEI
                        `<regEspTrib>0</regEspTrib>` + // 0 = Nenhum
                    `</regTrib>` + 
                `</prest>` + 
                `<toma>` + 
                    `<CNPJ>${tomadorCNPJ}</CNPJ>` + 
                    `<xNome>${tomador.razaoSocial}</xNome>` + 
                    `<end>` + 
                        `<endNac>` + 
                            `<cMun>${tomadorIBGE}</cMun>` + 
                            `<CEP>${tomadorCEP}</CEP>` + 
                        `</endNac>` + 
                        `<xLgr>${tomador.logradouro}</xLgr>` + 
                        `<nro>${tomador.numero}</nro>` + 
                        (tomador.complemento ? `<xCpl>${tomador.complemento}</xCpl>` : '') + 
                        `<xBairro>${tomador.bairro || 'Centro'}</xBairro>` + 
                    `</end>` + 
                    (tomador.email ? `<email>${tomador.email}</email>` : '') + 
                    (tomador.telefone ? `<fone>${this.cleanString(tomador.telefone)}</fone>` : '') + 
                `</toma>` + 
                `<serv>` + 
                    `<locPrest>` + 
                        `<cLocPrestacao>${ibgePrestador}</cLocPrestacao>` + 
                    `</locPrest>` + 
                    `<cServ>` + 
                        `<cTribNac>${this.cleanString(servico.codigoTribNacional)}</cTribNac>` + 
                        `<xDescServ>${servico.descricao}</xDescServ>` + 
                    `</cServ>` + 
                `</serv>` + 
                `<valores>` + 
                    `<vServPrest>` + 
                        `<vServ>${valServ}</vServ>` + 
                    `</vServPrest>` + 
                    `<trib>` + 
                        `<tribMun>` + 
                            `<tribISSQN>1</tribISSQN>` + // 1 = Sim, tributado
                            `<tpRetISSQN>1</tpRetISSQN>` + // 1 = Não retido
                        `</tribMun>` + 
                        `<totTrib>` + 
                            `<indTotTrib>0</indTotTrib>` + 
                        `</totTrib>` + 
                    `</trib>` + 
                `</valores>` + 
            `</infDPS>` + 
        `</DPS>`;

        try {
            // Assina usando o ID correto (45 chars)
            const xmlAssinado = this.assinarXML(xml, idDps, prestador);
            return this.transmitirXML(xmlAssinado, prestador);
        } catch (error: any) {
            return {
                sucesso: false,
                motivo: "Erro na Assinatura Local: " + error.message,
                erros: [{ codigo: "SIGN_ERR", mensagem: error.message }]
            };
        }
    }
}