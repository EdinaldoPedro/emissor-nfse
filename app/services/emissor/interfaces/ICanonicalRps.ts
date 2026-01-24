// app/services/emissor/interfaces/ICanonicalRps.ts

export interface ICanonicalRps {
    prestador: {
        id: string;
        documento: string; // CNPJ
        inscricaoMunicipal?: string;
        regimeTributario: 'MEI' | 'SIMPLES' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';
        endereco: {
            codigoIbge: string;
            uf: string;
        };
        configuracoes: {
            aliquotaPadrao?: number;
            issRetido?: boolean;
            tipoTributacao?: string; // 1-Exigivel, 2-Nao Incidencia...
            regimeEspecial?: string; // 0-Nenhum, 1-Microempresa Municipal...
        };
    };
    tomador: {
        documento: string;
        razaoSocial: string;
        endereco: {
            cep: string;
            logradouro: string;
            numero: string;
            bairro: string;
            codigoIbge: string;
            uf: string;
        };
        email?: string;
        telefone?: string;
    };
    servico: {
        valor: number;
        descricao: string;
        cnae: string;
        
        // Campos fiscais específicos da transação
        itemListaServico?: string; // LC 116 (ex: 1.07)
        codigoTributacaoNacional?: string; // NBS
        
        aliquotaAplicada?: number; // Se houver (0 para MEI)
        valorIss?: number;         // Calculado
        issRetido: boolean;
        
        tipoTributacao: string; // Exigibilidade para esta nota específica
    };
    meta: {
        ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
        serie: string;
        numero: number;
        dataEmissao: Date;
    };
}