// Mapeamento Inteligente: CNAE -> Item da Lista -> Tributação Nacional
// Fonte baseada na Tabela de Conversão da NFS-e Nacional

interface TaxMap {
    descricao: string;
    itemLC: string; // Item da Lista de Serviço (LC 116/03)
    codigoTributacaoNacional: string; // O código que a API exige
}

export const cnaeParaTributacao: Record<string, TaxMap> = {
    // --- TECNOLOGIA E DESENVOLVIMENTO ---
    "6201501": { 
        descricao: "Desenvolvimento de programas de computador sob encomenda",
        itemLC: "1.01",
        codigoTributacaoNacional: "01.01.01" 
    },
    "6202300": { 
        descricao: "Desenvolvimento e licenciamento de programas de computador customizáveis",
        itemLC: "1.02",
        codigoTributacaoNacional: "01.02.01"
    },
    "6203100": { 
        descricao: "Desenvolvimento e licenciamento de programas de computador não-customizáveis",
        itemLC: "1.03",
        codigoTributacaoNacional: "01.03.01"
    },
    "6204000": { 
        descricao: "Consultoria em tecnologia da informação",
        itemLC: "1.06",
        codigoTributacaoNacional: "01.06.01"
    },
    "6209100": { 
        descricao: "Suporte técnico, manutenção e outros serviços em TI",
        itemLC: "1.07",
        codigoTributacaoNacional: "01.07.01"
    },
    "6311900": { 
        descricao: "Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet",
        itemLC: "1.03",
        codigoTributacaoNacional: "01.03.02" // Processamento de dados
    },
    "6319400": {
        descricao: "Portais, provedores de conteúdo e outros serviços de informação na internet",
        itemLC: "1.09", // Disponibilização de conteúdo (sem cessão definitiva)
        codigoTributacaoNacional: "01.09.01" 
    },

    // --- MARKETING E PUBLICIDADE ---
    "7311400": {
        descricao: "Agências de publicidade",
        itemLC: "17.06",
        codigoTributacaoNacional: "17.06.01"
    },
    "7319003": {
        descricao: "Marketing direto",
        itemLC: "17.06",
        codigoTributacaoNacional: "17.06.01"
    },
    "7319002": {
        descricao: "Promoção de vendas",
        itemLC: "10.08",
        codigoTributacaoNacional: "10.08.01" // Agenciamento de publicidade e propaganda
    },

    // --- ENSINO E TREINAMENTO ---
    "8599604": {
        descricao: "Treinamento em desenvolvimento profissional e gerencial",
        itemLC: "8.02",
        codigoTributacaoNacional: "08.02.01"
    },
    "8599603": {
        descricao: "Treinamento em informática",
        itemLC: "8.02",
        codigoTributacaoNacional: "08.02.01"
    },
    "8550302": {
        descricao: "Atividades de apoio à educação",
        itemLC: "8.02",
        codigoTributacaoNacional: "08.02.01"
    },

    // --- SERVIÇOS ADMINISTRATIVOS ---
    "8211300": {
        descricao: "Serviços combinados de escritório e apoio administrativo",
        itemLC: "17.02",
        codigoTributacaoNacional: "17.02.01" // Datilografia, digitação, estenografia...
    },
    "8219999": {
        descricao: "Preparação de documentos e serviços especializados de apoio administrativo",
        itemLC: "17.02",
        codigoTributacaoNacional: "17.02.01"
    },

    // --- MANUTENÇÃO E REPAROS ---
    "9511800": {
        descricao: "Reparação e manutenção de computadores e de equipamentos periféricos",
        itemLC: "14.01",
        codigoTributacaoNacional: "14.01.01"
    },
    
    // --- DESIGN E FOTOGRAFIA ---
    "7410202": {
        descricao: "Design de interiores",
        itemLC: "7.06", // Colocação e instalação de tapetes, cortinas... (Item mais próximo para MEI decorador)
        codigoTributacaoNacional: "07.06.01"
    },
    "7420001": {
        descricao: "Atividades de produção de fotografias, exceto aérea e submarina",
        itemLC: "13.04", // Reprografia, microfilmagem e digitalização (sp) ou 24.01
        codigoTributacaoNacional: "13.04.01" 
    }
};

// Função auxiliar para encontrar ou retornar um padrão
export function getTributacaoPorCnae(cnae: string) {
    const cnaeLimpo = cnae.replace(/\D/g, ''); // Remove pontos e traços
    
    // Tenta encontrar o mapeamento exato
    const map = cnaeParaTributacao[cnaeLimpo];

    if (map) {
        return map;
    }

    // FALLBACK (Plano B): Se não achar o CNAE na lista,
    // retorna um genérico "Outros Serviços" para não travar,
    // mas o ideal é o usuário cadastrar corretamente.
    return {
        descricao: "Serviço não classificado automaticamente",
        itemLC: "01.01", // Padrãozão de TI (Arriscado, mas evita crash)
        codigoTributacaoNacional: "01.01.01"
    };
}