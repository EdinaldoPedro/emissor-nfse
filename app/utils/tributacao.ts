// Mapeamento Inteligente: CNAE -> Item da Lista -> Tributação Nacional
// Fonte baseada na Tabela de Conversão da NFS-e Nacional (LC 116/03)

export interface TaxMap {
    descricao: string;
    itemLC: string; 
    codigoTributacaoNacional: string; 
}

export const cnaeParaTributacao: Record<string, TaxMap> = {
    // ==========================================
    // 1. TECNOLOGIA, DESENVOLVIMENTO E INFORMAÇÃO
    // ==========================================
    "6201501": { descricao: "Desenvolvimento de programas de computador sob encomenda", itemLC: "1.01", codigoTributacaoNacional: "01.01.01" },
    "6201502": { descricao: "Web design", itemLC: "1.08", codigoTributacaoNacional: "01.08.01" },
    "6202300": { descricao: "Desenvolvimento e licenciamento de programas de computador customizáveis", itemLC: "1.02", codigoTributacaoNacional: "01.02.01" },
    "6203100": { descricao: "Desenvolvimento e licenciamento de programas de computador não-customizáveis", itemLC: "1.03", codigoTributacaoNacional: "01.03.01" },
    "6204000": { descricao: "Consultoria em tecnologia da informação", itemLC: "1.06", codigoTributacaoNacional: "01.06.01" },
    "6209100": { descricao: "Suporte técnico, manutenção e outros serviços em TI", itemLC: "1.07", codigoTributacaoNacional: "01.07.01" },
    "6311900": { descricao: "Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet", itemLC: "1.03", codigoTributacaoNacional: "01.03.02" },
    "6319400": { descricao: "Portais, provedores de conteúdo e outros serviços de informação na internet", itemLC: "1.09", codigoTributacaoNacional: "01.09.01" },
    "9511800": { descricao: "Reparação e manutenção de computadores e de equipamentos periféricos", itemLC: "14.01", codigoTributacaoNacional: "14.01.01" },
    "9512600": { descricao: "Reparação e manutenção de equipamentos de comunicação", itemLC: "14.01", codigoTributacaoNacional: "14.01.01" },

    // ==========================================
    // 2. MARKETING, DESIGN, FOTO E VÍDEO
    // ==========================================
    "7311400": { descricao: "Agências de publicidade", itemLC: "17.06", codigoTributacaoNacional: "17.06.01" },
    "7319002": { descricao: "Promoção de vendas", itemLC: "10.08", codigoTributacaoNacional: "10.08.01" },
    "7319003": { descricao: "Marketing direto", itemLC: "17.06", codigoTributacaoNacional: "17.06.01" },
    "7319004": { descricao: "Consultoria em publicidade", itemLC: "17.06", codigoTributacaoNacional: "17.06.01" },
    "7319099": { descricao: "Outras atividades de publicidade não especificadas", itemLC: "17.06", codigoTributacaoNacional: "17.06.01" },
    "7410202": { descricao: "Design de interiores", itemLC: "7.06", codigoTributacaoNacional: "07.06.01" },
    "7410299": { descricao: "Atividades de design não especificadas", itemLC: "17.24", codigoTributacaoNacional: "17.24.01" },
    "7420001": { descricao: "Atividades de produção de fotografias, exceto aérea e submarina", itemLC: "13.04", codigoTributacaoNacional: "13.04.01" },
    "7420004": { descricao: "Filmagem de festas e eventos", itemLC: "13.03", codigoTributacaoNacional: "13.03.01" },
    "7420005": { descricao: "Serviços de microfilmagem", itemLC: "13.04", codigoTributacaoNacional: "13.04.01" },
    "5911199": { descricao: "Atividades de produção cinematográfica, de vídeos e de programas de televisão", itemLC: "13.03", codigoTributacaoNacional: "13.03.01" },
    "5912099": { descricao: "Atividades de pós-produção cinematográfica, de vídeos e de programas de televisão", itemLC: "13.03", codigoTributacaoNacional: "13.03.01" },

    // ==========================================
    // 3. CONSULTORIA, ADMINISTRAÇÃO E ESCRITÓRIO
    // ==========================================
    "6911701": { descricao: "Serviços advocatícios", itemLC: "17.14", codigoTributacaoNacional: "17.14.01" },
    "6920601": { descricao: "Atividades de contabilidade", itemLC: "17.19", codigoTributacaoNacional: "17.19.01" },
    "6920602": { descricao: "Atividades de consultoria e auditoria contábil e tributária", itemLC: "17.19", codigoTributacaoNacional: "17.19.01" },
    "7020400": { descricao: "Atividades de consultoria em gestão empresarial, exceto consultoria técnica específica", itemLC: "17.20", codigoTributacaoNacional: "17.20.01" },
    "7490104": { descricao: "Atividades de intermediação e agenciamento de serviços e negócios em geral", itemLC: "10.02", codigoTributacaoNacional: "10.02.01" },
    "8211300": { descricao: "Serviços combinados de escritório e apoio administrativo", itemLC: "17.02", codigoTributacaoNacional: "17.02.01" },
    "8219999": { descricao: "Preparação de documentos e serviços especializados de apoio administrativo", itemLC: "17.02", codigoTributacaoNacional: "17.02.01" },
    "8220200": { descricao: "Atividades de teleatendimento", itemLC: "17.02", codigoTributacaoNacional: "17.02.01" },
    "8291100": { descricao: "Atividades de cobrança e informações cadastrais", itemLC: "17.22", codigoTributacaoNacional: "17.22.01" },
    "8299799": { descricao: "Outras atividades de serviços prestados principalmente às empresas", itemLC: "17.02", codigoTributacaoNacional: "17.02.01" },
    "7810800": { descricao: "Seleção e agenciamento de mão-de-obra", itemLC: "17.04", codigoTributacaoNacional: "17.04.01" },
    "7820500": { descricao: "Locação de mão-de-obra temporária", itemLC: "17.05", codigoTributacaoNacional: "17.05.01" },
    "6821401": { descricao: "Corretagem na compra e venda e avaliação de imóveis", itemLC: "10.05", codigoTributacaoNacional: "10.05.01" },
    "6822200": { descricao: "Gestão e administração da propriedade imobiliária", itemLC: "17.12", codigoTributacaoNacional: "17.12.01" },
    "6622300": { descricao: "Corretores e agentes de seguros, de planos de previdência complementar e de saúde", itemLC: "10.01", codigoTributacaoNacional: "10.01.01" },

    // ==========================================
    // 4. SAÚDE, TERAPIAS, ESTÉTICA E BEM-ESTAR
    // ==========================================
    "8630503": { descricao: "Atividade médica ambulatorial restrita a consultas", itemLC: "4.01", codigoTributacaoNacional: "04.01.01" },
    "8630504": { descricao: "Atividade odontológica", itemLC: "4.02", codigoTributacaoNacional: "04.02.01" },
    "8640202": { descricao: "Laboratórios clínicos", itemLC: "4.02", codigoTributacaoNacional: "04.02.01" }, // Análises clínicas
    "8650001": { descricao: "Atividades de enfermagem", itemLC: "4.06", codigoTributacaoNacional: "04.06.01" },
    "8650002": { descricao: "Atividades de profissionais da nutrição", itemLC: "4.07", codigoTributacaoNacional: "04.07.01" },
    "8650003": { descricao: "Atividades de psicologia e psicanálise", itemLC: "4.11", codigoTributacaoNacional: "04.11.01" },
    "8650004": { descricao: "Atividades de fisioterapia", itemLC: "4.08", codigoTributacaoNacional: "04.08.01" },
    "8650005": { descricao: "Atividades de terapia ocupacional", itemLC: "4.10", codigoTributacaoNacional: "04.10.01" },
    "8650006": { descricao: "Atividades de fonoaudiologia", itemLC: "4.09", codigoTributacaoNacional: "04.09.01" },
    "8690901": { descricao: "Atividades de práticas integrativas e complementares em saúde humana", itemLC: "4.99", codigoTributacaoNacional: "04.99.01" }, // Massoterapia, acupuntura
    "9602501": { descricao: "Cabeleireiros, manicure e pedicure", itemLC: "6.01", codigoTributacaoNacional: "06.01.01" },
    "9602502": { descricao: "Atividades de estética e outros serviços de cuidados com a beleza", itemLC: "6.02", codigoTributacaoNacional: "06.02.01" },
    "9313100": { descricao: "Atividades de condicionamento físico (Personal Trainer/Academia)", itemLC: "8.02", codigoTributacaoNacional: "08.02.01" },
    "7500100": { descricao: "Atividades veterinárias", itemLC: "5.01", codigoTributacaoNacional: "05.01.01" },

    // ==========================================
    // 5. ENGENHARIA, OBRAS, MANUTENÇÃO E REPAROS
    // ==========================================
    "7111100": { descricao: "Serviços de arquitetura", itemLC: "7.01", codigoTributacaoNacional: "07.01.01" },
    "7112000": { descricao: "Serviços de engenharia", itemLC: "7.01", codigoTributacaoNacional: "07.01.01" },
    "4321500": { descricao: "Instalação e manutenção elétrica", itemLC: "7.02", codigoTributacaoNacional: "07.02.01" },
    "4322301": { descricao: "Instalações hidráulicas, sanitárias e de gás", itemLC: "7.02", codigoTributacaoNacional: "07.02.01" },
    "4322302": { descricao: "Instalação e manutenção de sistemas centrais de ar condicionado, de ventilação e refrigeração", itemLC: "7.02", codigoTributacaoNacional: "07.02.01" },
    "4330404": { descricao: "Serviços de pintura de edifícios em geral", itemLC: "7.02", codigoTributacaoNacional: "07.02.01" },
    "4330402": { descricao: "Instalação de portas, janelas, tetos, divisórias e armários embutidos de qualquer material", itemLC: "7.02", codigoTributacaoNacional: "07.02.01" },
    "9521500": { descricao: "Reparação e manutenção de equipamentos eletroeletrônicos de uso pessoal e doméstico", itemLC: "14.01", codigoTributacaoNacional: "14.01.01" },
    "9529105": { descricao: "Reparação de artigos do mobiliário", itemLC: "14.01", codigoTributacaoNacional: "14.01.01" },
    "3314710": { descricao: "Manutenção e reparação de máquinas e equipamentos para uso geral", itemLC: "14.01", codigoTributacaoNacional: "14.01.01" },
    "4520001": { descricao: "Serviços de manutenção e reparação mecânica de veículos automotores", itemLC: "14.01", codigoTributacaoNacional: "14.01.01" },
    "4520002": { descricao: "Serviços de lanternagem ou funilaria e pintura de veículos automotores", itemLC: "14.01", codigoTributacaoNacional: "14.01.01" },
    "4520003": { descricao: "Serviços de manutenção e reparação elétrica de veículos automotores", itemLC: "14.01", codigoTributacaoNacional: "14.01.01" },
    "4520005": { descricao: "Serviços de lavagem, lubrificação e polimento de veículos automotores", itemLC: "14.01", codigoTributacaoNacional: "14.01.01" },

    // ==========================================
    // 6. EDUCAÇÃO, CURSOS E TREINAMENTOS
    // ==========================================
    "8599604": { descricao: "Treinamento em desenvolvimento profissional e gerencial", itemLC: "8.02", codigoTributacaoNacional: "08.02.01" },
    "8599603": { descricao: "Treinamento em informática", itemLC: "8.02", codigoTributacaoNacional: "08.02.01" },
    "8550302": { descricao: "Atividades de apoio à educação", itemLC: "8.02", codigoTributacaoNacional: "08.02.01" },
    "8592901": { descricao: "Ensino de dança", itemLC: "8.02", codigoTributacaoNacional: "08.02.01" },
    "8592902": { descricao: "Ensino de artes cênicas, exceto dança", itemLC: "8.02", codigoTributacaoNacional: "08.02.01" },
    "8592903": { descricao: "Ensino de música", itemLC: "8.02", codigoTributacaoNacional: "08.02.01" },
    "8592999": { descricao: "Ensino de arte e cultura não especificado anteriormente", itemLC: "8.02", codigoTributacaoNacional: "08.02.01" },
    "8593700": { descricao: "Ensino de idiomas", itemLC: "8.02", codigoTributacaoNacional: "08.02.01" },
    "8599605": { descricao: "Cursos preparatórios para concursos", itemLC: "8.02", codigoTributacaoNacional: "08.02.01" },
    "8599699": { descricao: "Outras atividades de ensino não especificadas", itemLC: "8.02", codigoTributacaoNacional: "08.02.01" },

    // ==========================================
    // 7. EVENTOS, TURISMO E LAZER
    // ==========================================
    "8230001": { descricao: "Serviços de organização de feiras, congressos, exposições e festas", itemLC: "17.10", codigoTributacaoNacional: "17.10.01" },
    "8230002": { descricao: "Casas de festas e eventos", itemLC: "17.10", codigoTributacaoNacional: "17.10.01" },
    "9001901": { descricao: "Produção teatral", itemLC: "12.13", codigoTributacaoNacional: "12.13.01" },
    "9001902": { descricao: "Produção musical", itemLC: "12.13", codigoTributacaoNacional: "12.13.01" },
    "9001906": { descricao: "Atividades de sonorização e de iluminação", itemLC: "12.13", codigoTributacaoNacional: "12.13.01" },
    "7911200": { descricao: "Agências de viagens", itemLC: "9.02", codigoTributacaoNacional: "09.02.01" },
    "7912100": { descricao: "Operadores turísticos", itemLC: "9.02", codigoTributacaoNacional: "09.02.01" },
    "7990200": { descricao: "Serviços de reservas e outros serviços de turismo não especificados", itemLC: "9.02", codigoTributacaoNacional: "09.02.01" },
    "9329899": { descricao: "Outras atividades de recreação e lazer não especificadas", itemLC: "12.08", codigoTributacaoNacional: "12.08.01" }, // Feiras, diversões
    "9003500": { descricao: "Gestão de espaços para artes cênicas, espetáculos e outras atividades artísticas", itemLC: "12.07", codigoTributacaoNacional: "12.07.01" },

    // ==========================================
    // 8. TRANSPORTES E LOGÍSTICA
    // ==========================================
    "5320202": { descricao: "Serviços de entrega rápida (Motoboy)", itemLC: "26.01", codigoTributacaoNacional: "26.01.01" },
    "4930201": { descricao: "Transporte rodoviário de carga, exceto produtos perigosos e mudanças, municipal", itemLC: "16.01", codigoTributacaoNacional: "16.01.01" },
    "4930202": { descricao: "Transporte rodoviário de carga, exceto produtos perigosos e mudanças, intermunicipal", itemLC: "16.01", codigoTributacaoNacional: "16.01.01" }, // Cuidado com ICMS, mas municipal é 16.01
    "4923001": { descricao: "Serviço de táxi (ou transporte por aplicativo municipal)", itemLC: "16.01", codigoTributacaoNacional: "16.01.01" },
    "4929901": { descricao: "Transporte rodoviário coletivo de passageiros, sob regime de fretamento, municipal", itemLC: "16.01", codigoTributacaoNacional: "16.01.01" },
    "4924800": { descricao: "Transporte escolar", itemLC: "16.01", codigoTributacaoNacional: "16.01.01" },
    "5229099": { descricao: "Outras atividades auxiliares dos transportes terrestres não especificadas", itemLC: "16.02", codigoTributacaoNacional: "16.02.01" },

    // ==========================================
    // 9. SERVIÇOS GERAIS, LIMPEZA E SEGURANÇA
    // ==========================================
    "8121400": { descricao: "Limpeza em prédios e em domicílios", itemLC: "7.10", codigoTributacaoNacional: "07.10.01" },
    "8129000": { descricao: "Atividades de limpeza não especificadas anteriormente", itemLC: "7.10", codigoTributacaoNacional: "07.10.01" },
    "8111900": { descricao: "Serviços combinados para apoio a edifícios, exceto condomínios prediais", itemLC: "17.05", codigoTributacaoNacional: "17.05.01" }, // Fornecimento de mão de obra
    "8130300": { descricao: "Atividades paisagísticas", itemLC: "7.11", codigoTributacaoNacional: "07.11.01" }, // Paisagismo, jardinagem
    "8011101": { descricao: "Atividades de vigilância e segurança privada", itemLC: "11.02", codigoTributacaoNacional: "11.02.01" },
    "8020001": { descricao: "Atividades de monitoramento de sistemas de segurança", itemLC: "11.02", codigoTributacaoNacional: "11.02.01" },
    "9601701": { descricao: "Lavanderias", itemLC: "14.09", codigoTributacaoNacional: "14.09.01" },
    "9609204": { descricao: "Exploração de máquinas de serviços pessoais acionadas por moeda", itemLC: "14.09", codigoTributacaoNacional: "14.09.01" },
    "9609207": { descricao: "Alojamento de animais domésticos (Pet Hotel)", itemLC: "5.09", codigoTributacaoNacional: "05.09.01" }, // Creche de animais
    "9609208": { descricao: "Higiene e embelezamento de animais domésticos (Pet Shop Banho e Tosa)", itemLC: "5.09", codigoTributacaoNacional: "05.09.01" }
};

/**
 * Função auxiliar para encontrar a classificação tributária com base no CNAE.
 * Retorna o mapeamento se encontrado ou um "fallback" seguro caso contrário.
 */
export function getTributacaoPorCnae(cnae: string | null | undefined): TaxMap {
    if (!cnae) {
        return getFallbackTributacao();
    }

    const cnaeLimpo = cnae.replace(/\D/g, ''); 
    
    // Tenta encontrar o mapeamento exato
    const map = cnaeParaTributacao[cnaeLimpo];

    if (map) {
        return map;
    }

    return getFallbackTributacao();
}

/**
 * Retorna uma tributação genérica caso o CNAE não esteja mapeado.
 * Isso impede que a interface crash ou que o XML da nota quebre.
 */
function getFallbackTributacao(): TaxMap {
    return {
        descricao: "Serviço não classificado automaticamente",
        itemLC: "01.01", 
        codigoTributacaoNacional: "01.01.01"
    };
}