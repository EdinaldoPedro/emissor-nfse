export interface ICanonicalRps {
    prestador: {
        id: string;
        documento: string;
        inscricaoMunicipal?: string;
        regimeTributario: 'MEI' | 'SIMPLES' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';
        endereco: {
            codigoIbge: string;
            uf: string;
        };
        configuracoes: {
            aliquotaPadrao?: number;
            issRetido?: boolean;
            tipoTributacao?: string;
            regimeEspecial?: string;
        };
    };
    tomador: {
        documento: string;
        razaoSocial: string;
        email?: string;
        telefone?: string;
        endereco: {
            cep: string;
            logradouro: string;
            numero: string;
            bairro: string;
            codigoIbge: string;
            uf: string;
        };
    };
    servico: {
        valor: number;
        valorLiquido: number;
        descricao: string;
        cnae: string;
        
        itemListaServico?: string;
        codigoTributacaoNacional?: string;

        // === CAMPOS NOVOS (Correção do erro de Build) ===
        codigoNbs?: string;                // Necessário para o Resolver de Recife
        codigoTributacaoMunicipal?: string; // Necessário para o Resolver de Recife
        
        // ISS
        aliquotaAplicada?: number;
        valorIss?: number;
        issRetido: boolean;
        tipoTributacao: string;

        // RETENÇÕES FEDERAIS
        retencoes: {
            pis: { valor: number; aliquota?: number; retido: boolean };
            cofins: { valor: number; aliquota?: number; retido: boolean };
            csll: { valor: number; aliquota?: number; retido: boolean };
            inss: { valor: number; aliquota?: number; retido: boolean };
            ir: { valor: number; aliquota?: number; retido: boolean };
        };
    };
    meta: {
        ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
        serie: string;
        numero: number;
        dataEmissao: Date;
    };
}