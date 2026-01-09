import { BaseStrategy } from '../BaseStrategy';
import { IEmissorStrategy, IDadosEmissao, IResultadoEmissao } from '../../interfaces/IEmissorStrategy';

export class MeiRecifeStrategy extends BaseStrategy implements IEmissorStrategy {
    
    async executar(dados: IDadosEmissao): Promise<IResultadoEmissao> {
        const { prestador, tomador, servico, numeroDPS, serieDPS, ambiente } = dados;

        // === 1. VALIDAÇÃO RIGOROSA (O "Guardrail") ===
        try {
            // Validações Comuns (Certificado, Tomador Básico)
            this.validarCertificado(prestador);
            this.validarTomador(tomador);

            // Validações Específicas MEI Recife
            if (this.cleanString(prestador.codigoIbge) !== '2611606') {
                throw new Error("Esta estratégia é exclusiva para prestadores de Recife/PE (IBGE 2611606).");
            }
            
            if (!servico.cnae || !servico.codigoTribNacional) {
                 throw new Error("Classificação Fiscal incompleta. CNAE e Código de Tributação Nacional são obrigatórios.");
            }

            // Validação de Valores
            if (servico.valor <= 0) {
                throw new Error("O valor do serviço deve ser maior que zero.");
            }

        } catch (error: any) {
            // Retorna erro de validação sem nem tentar montar XML
            return {
                sucesso: false,
                motivo: error.message,
                erros: [{ codigo: "VAL_ERR", mensagem: error.message }]
            };
        }

        // === 2. MONTAGEM DO XML (BUILDER) ===
        // Segue estritamente o modelo '2611...xml' validado

        const dhEmi = new Date().toISOString();
        const dCompet = new Date().toISOString().split('T')[0];
        const valServ = servico.valor.toFixed(2);
        
        // Identificadores e Chaves
        const ibgePrestador = this.cleanString(prestador.codigoIbge).padStart(7, '0');
        const cnpjPrestador = this.cleanString(prestador.documento);
        const tpAmb = ambiente === 'PRODUCAO' ? '1' : '2';
        const serie = serieDPS.padStart(5, '0'); // Ex: 00900
        const nDps = String(numeroDPS); // Sem padding excessivo dentro da tag nDPS, só no ID se quiser
        
        // O ID do DPS segue regra específica: DPS + IBGE(7) + Amb(1) + CNPJ(14) + Serie(5) + Numero(15)
        const nDpsPad = String(numeroDPS).padStart(15, '0');
        const idDps = `DPS${ibgePrestador}${tpAmb}${cnpjPrestador}${serie}${nDpsPad}`;

        const tomadorCNPJ = this.cleanString(tomador.documento);
        const tomadorCEP = this.cleanString(tomador.cep);
        
        // Regras Fixas MEI
        // opSimpNac = 2 (Optante MEI)
        // regEspTrib = 0 (Nenhum regime especial adicional)
        // cLocPrestacao = Local do Prestador (Para MEI padrão)
        
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="${idDps}" versao="1.00">
    <tpAmb>${tpAmb}</tpAmb>
    <dhEmi>${dhEmi}</dhEmi>
    <verAplic>EmissorWeb_1.0</verAplic>
    <serie>${parseInt(serie)}</serie>
    <nDPS>${nDps}</nDPS>
    <dCompet>${dCompet}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>${ibgePrestador}</cLocEmi>
    <prest>
      <CNPJ>${cnpjPrestador}</CNPJ>
      ${prestador.telefone ? `<fone>${this.cleanString(prestador.telefone)}</fone>` : ''}
      ${prestador.email ? `<email>${prestador.email}</email>` : ''}
      <regTrib>
        <opSimpNac>2</opSimpNac>
        <regEspTrib>0</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      <CNPJ>${tomadorCNPJ}</CNPJ>
      <xNome>${tomador.razaoSocial}</xNome>
      ${tomadorCEP ? `
      <end>
        <endNac>
          <cMun>${this.cleanString(tomador.codigoIbge) || '0000000'}</cMun>
          <CEP>${tomadorCEP}</CEP>
        </endNac>
        <xLgr>${tomador.logradouro || 'Não Informado'}</xLgr>
        <nro>${tomador.numero || 'S/N'}</nro>
        <xCpl>${tomador.complemento || ''}</xCpl>
        <xBairro>${tomador.bairro || 'Centro'}</xBairro>
      </end>` : ''}
      ${tomador.email ? `<email>${tomador.email}</email>` : ''}
    </toma>
    <serv>
      <locPrest>
        <cLocPrestacao>${ibgePrestador}</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>${this.cleanString(servico.codigoTribNacional)}</cTribNac>
        <xDescServ>${servico.descricao}</xDescServ>
      </cServ>
    </serv>
    <valores>
      <vServPrest>
        <vServ>${valServ}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <tpRetISSQN>1</tpRetISSQN>
        </tribMun>
        <totTrib>
          <indTotTrib>0</indTotTrib>
        </totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;

        // === 3. TRANSMISSÃO ===
        return this.transmitirXML(xml, prestador);
    }
}