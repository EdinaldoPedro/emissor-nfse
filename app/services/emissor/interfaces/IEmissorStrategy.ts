export interface IResultadoEmissao {
    sucesso: boolean;
    notaGov?: {
        numero: string;
        chave: string;
        protocolo: string;
        xml: string;
    };
    erros?: any[];
    xmlGerado?: string;
    motivo?: string;
}

export interface IDadosEmissao {
    prestador: any;
    tomador: any;
    venda: any;
    servico: {
        valor: number;
        descricao: string;
        cnae: string;
        itemLc: string;
        codigoTribNacional: string;
    };
    ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
    numeroDPS: number;
    serieDPS: string;
}

export interface IEmissorStrategy {
    executar(dados: IDadosEmissao): Promise<IResultadoEmissao>;
}