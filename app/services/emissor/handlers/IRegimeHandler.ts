import { ICanonicalRps } from "../interfaces/ICanonicalRps";

export interface IRegimeHandler {
    /**
     * Recebe os dados brutos da venda e da empresa e retorna
     * a parte do objeto RPS relacionada a serviços e tributos.
     */
    getDadosTributarios(venda: any, empresa: any): Promise<Partial<ICanonicalRps['servico']>>;
}