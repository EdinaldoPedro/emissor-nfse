import { BaseStrategy } from '../BaseStrategy';
import { IEmissorStrategy, IDadosEmissao, IResultadoEmissao } from '../../interfaces/IEmissorStrategy';

export class MeiRecifeStrategy extends BaseStrategy implements IEmissorStrategy {
    
    async executar(dados: IDadosEmissao): Promise<IResultadoEmissao> {
        const { prestador, tomador, servico, numeroDPS, serieDPS, ambiente } = dados;

        // === 1. VALIDAÇÃO ===
        try {
            this.validarCertificado(prestador);
            this.validarTomador(tomador); 

            if (this.cleanString(prestador.codigoIbge) !== '2611606') {
                throw new Error("Erro: Estratégia exclusiva para Recife/PE (IBGE 2611606).");
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

        // === 2. DADOS ===
        const dataAgora = new Date();
        const dhEmi = this.formatarDataSefaz(dataAgora); 
        const dCompet = dhEmi.split('T')[0]; 
        
        const valServ = servico.valor.toFixed(2);
        
        const ibgePrestador = this.cleanString(prestador.codigoIbge).padStart(7, '0');
        const cnpjPrestador = this.cleanString(prestador.documento);
        const tpAmb = ambiente === 'PRODUCAO' ? '1' : '2';
        const serie = serieDPS.padStart(5, '0'); 
        const nDps = String(numeroDPS);
        
        const nDpsPad = String(numeroDPS).padStart(15, '0');
        const idDps = `DPS${ibgePrestador}${tpAmb}${cnpjPrestador}${serie}${nDpsPad}`;

        const tomadorCNPJ = this.cleanString(tomador.documento);
        const tomadorCEP = this.cleanString(tomador.cep);
        
        // === 3. MONTAGEM XML (COM NAMESPACE EXPLICITO) ===
        // MUDANÇA: Adicionei xmlns na infDPS. Isso garante que o XML seja "self-contained" 
        // e o hash calculado por nós (que já injeta o xmlns) bata com o da Sefaz.
        const xml = `<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00"><infDPS xmlns="http://www.sped.fazenda.gov.br/nfse" Id="${idDps}"><tpAmb>${tpAmb}</tpAmb><dhEmi>${dhEmi}</dhEmi><verAplic>EmissorWeb_1.0</verAplic><serie>${parseInt(serie)}</serie><nDPS>${nDps}</nDPS><dCompet>${dCompet}</dCompet><tpEmit>1</tpEmit><cLocEmi>${ibgePrestador}</cLocEmi><prest><CNPJ>${cnpjPrestador}</CNPJ>${prestador.telefone ? `<fone>${this.cleanString(prestador.telefone)}</fone>` : ''}${prestador.email ? `<email>${prestador.email}</email>` : ''}<regTrib><opSimpNac>2</opSimpNac><regEspTrib>0</regEspTrib></regTrib></prest><toma><CNPJ>${tomadorCNPJ}</CNPJ><xNome>${tomador.razaoSocial}</xNome><end><endNac><cMun>${this.cleanString(tomador.codigoIbge)}</cMun><CEP>${tomadorCEP}</CEP></endNac><xLgr>${tomador.logradouro}</xLgr><nro>${tomador.numero}</nro>${tomador.complemento ? `<xCpl>${tomador.complemento}</xCpl>` : ''}<xBairro>${tomador.bairro || 'Centro'}</xBairro></end>${tomador.email ? `<email>${tomador.email}</email>` : ''}${tomador.telefone ? `<fone>${this.cleanString(tomador.telefone)}</fone>` : ''}</toma><serv><locPrest><cLocPrestacao>${ibgePrestador}</cLocPrestacao></locPrest><cServ><cTribNac>${this.cleanString(servico.codigoTribNacional)}</cTribNac><xDescServ>${servico.descricao}</xDescServ></cServ></serv><valores><vServPrest><vServ>${valServ}</vServ></vServPrest><trib><tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun><totTrib><indTotTrib>0</indTotTrib></totTrib></trib></valores></infDPS></DPS>`;

        try {
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