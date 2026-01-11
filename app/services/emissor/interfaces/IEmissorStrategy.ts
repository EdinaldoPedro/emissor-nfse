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

export interface IResultadoConsulta {
    sucesso: boolean;
    situacao: 'AUTORIZADA' | 'CANCELADA' | 'PROCESSANDO' | 'ERRO';
    numeroNota?: string;      // O número real (ex: 125)
    xmlDistribuicao?: string; // O XML oficial completo (Base64)
    pdfBase64?: string;       // O PDF (se disponível pela API)
    motivo?: string;
}

// ADICIONADO: Interface de Cancelamento
export interface IResultadoCancelamento {
    sucesso: boolean;
    dataCancelamento?: Date;
    xmlEvento?: string;       // XML do evento registrado
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
    // Novos métodos obrigatórios
    consultar(chave: string, empresa: any): Promise<IResultadoConsulta>;
    cancelar(chave: string, motivo: string, empresa: any): Promise<IResultadoCancelamento>;
}