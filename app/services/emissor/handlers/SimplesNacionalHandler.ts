import { IRegimeHandler } from "./IRegimeHandler";
import { ICanonicalRps } from "../interfaces/ICanonicalRps";
import { TaxCodeResolver } from "../resolvers/TaxCodeResolver";

export class SimplesNacionalHandler implements IRegimeHandler {
    async getDadosTributarios(venda: any, empresa: any): Promise<Partial<ICanonicalRps['servico']>> {
        
        // 1. Resolve particularidades municipais (Recife vs Rio)
        // ATENÇÃO: Passamos empresa.id agora
        const codigosLocais = await TaxCodeResolver.resolve(
            empresa.codigoIbge, 
            venda.cnae || empresa.cnaePrincipal,
            empresa.id 
        );

        // 2. Prepara Valores
        const valor = Number(venda.valor);
        const issRetido = venda.issRetido === true;
        
        // Se retido, usa a alíquota da venda (2-5%). Se não, usa a do cadastro (DAS).
        const aliquota = issRetido 
            ? Number(venda.aliquota) 
            : Number(empresa.aliquotaPadrao || 0);
            
        const valorIss = valor * (aliquota / 100);

        // 3. Processa Retenções Federais (se houver)
        const r = venda.retencoes || {}; 
        const retencoes = {
            pis: { valor: Number(r.pis?.valor) || 0, retido: !!r.pis?.retido },
            cofins: { valor: Number(r.cofins?.valor) || 0, retido: !!r.cofins?.retido },
            inss: { valor: Number(r.inss?.valor) || 0, retido: !!r.inss?.retido },
            ir: { valor: Number(r.ir?.valor) || 0, retido: !!r.ir?.retido },
            csll: { valor: Number(r.csll?.valor) || 0, retido: !!r.csll?.retido }
        };

        // 4. Calcula Líquido
        let totalRetido = 0;
        if (issRetido) totalRetido += valorIss;
        if (retencoes.pis.retido) totalRetido += retencoes.pis.valor;
        if (retencoes.cofins.retido) totalRetido += retencoes.cofins.valor;
        if (retencoes.inss.retido) totalRetido += retencoes.inss.valor;
        if (retencoes.ir.retido) totalRetido += retencoes.ir.valor;
        if (retencoes.csll.retido) totalRetido += retencoes.csll.valor;

        return {
            valor: valor,
            valorLiquido: valor - totalRetido,
            descricao: venda.descricao,
            cnae: venda.cnae || empresa.cnaePrincipal,
            itemListaServico: venda.itemLc || '01.01',
            codigoTributacaoNacional: venda.codigoTribNacional, // Ex: 1.01.01

            // Dados Fiscais
            aliquotaAplicada: aliquota,
            valorIss: valorIss,
            issRetido: issRetido,
            tipoTributacao: '1', // 1 - Tributação no município (Regra geral)

            // Injeção do Resolver (Ex: Recife exige isso)
            codigoNbs: codigosLocais.codigoNbs,
            codigoTributacaoMunicipal: codigosLocais.codigoMunicipal,

            retencoes: retencoes
        };
    }
}