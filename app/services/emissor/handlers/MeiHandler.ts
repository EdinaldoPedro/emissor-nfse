import { IRegimeHandler } from "./IRegimeHandler";
import { ICanonicalRps } from "../interfaces/ICanonicalRps";

export class MeiHandler implements IRegimeHandler {
    async getDadosTributarios(venda: any, empresa: any): Promise<Partial<ICanonicalRps['servico']>> {
        const valor = Number(venda.valor);

        return {
            valor: valor,
            valorLiquido: valor, // MEI não tem retenção por padrão
            descricao: venda.descricao,
            cnae: venda.cnae || empresa.cnaePrincipal,
            itemListaServico: venda.itemLc || '01.01',
            codigoTributacaoNacional: venda.codigoTribNacional,
            
            // Regras MEI
            aliquotaAplicada: 0,
            valorIss: 0,
            issRetido: false,
            tipoTributacao: '1', 
            
            // === A CORREÇÃO ESTÁ AQUI ===
            // Repassa o que veio da API
            codigoNbs: venda.codigoNbs,
            codigoTributacaoMunicipal: "",

            retencoes: {
                pis: { valor: 0, retido: false },
                cofins: { valor: 0, retido: false },
                inss: { valor: 0, retido: false },
                ir: { valor: 0, retido: false },
                csll: { valor: 0, retido: false }
            }
        };
    }
}