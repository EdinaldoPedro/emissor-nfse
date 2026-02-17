import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Configuração por Município
const REGRAS_MUNICIPAIS: Record<string, { exigeNbs: boolean, exigeCodMunicipal: boolean }> = {
    "2611606": { exigeNbs: true, exigeCodMunicipal: true }, // Recife-PE
    "3304557": { exigeNbs: false, exigeCodMunicipal: false }, // Rio de Janeiro
};

export class TaxCodeResolver {
    
    // Adicionamos empresaId opcional para buscar na tabela Cnae correta
    static async resolve(ibgeMunicipio: string, cnae: string, empresaId?: string): Promise<{ codigoNbs?: string, codigoMunicipal?: string }> {
        const regra = REGRAS_MUNICIPAIS[ibgeMunicipio];

        // Se não tem regra, retorna vazio
        if (!regra) {
            return { codigoNbs: undefined, codigoMunicipal: undefined };
        }

        let resultado = { codigoNbs: undefined as string | undefined, codigoMunicipal: undefined as string | undefined };

        // 1. Busca Código Municipal (Tabela TributacaoMunicipal)
        if (regra.exigeCodMunicipal) {
            const tributacao = await prisma.tributacaoMunicipal.findFirst({
                where: {
                    codigoIbge: ibgeMunicipio,
                    cnae: cnae
                }
            });
            if (tributacao) {
                // Aqui pegamos o campo correto que já existe no seu banco
                resultado.codigoMunicipal = tributacao.codigoTributacaoMunicipal;
            }
        }

        // 2. Busca NBS (Tabela Cnae ou GlobalCnae) - AQUI ESTAVA O ERRO
        if (regra.exigeNbs) {
            // Tenta buscar na tabela Cnae da empresa primeiro (se tiver ID)
            if (empresaId) {
                const cnaeEmpresa = await prisma.cnae.findFirst({
                    where: { codigo: cnae, empresaId: empresaId }
                });
                if (cnaeEmpresa?.codigoNbs) {
                    resultado.codigoNbs = cnaeEmpresa.codigoNbs;
                    return resultado; // Achou, retorna.
                }
            }

            // Fallback: Busca na tabela GlobalCnae se não achou na empresa
            const cnaeGlobal = await prisma.globalCnae.findUnique({
                where: { codigo: cnae }
            });
            if (cnaeGlobal?.codigoNbs) {
                resultado.codigoNbs = cnaeGlobal.codigoNbs;
            }
        }

        return resultado;
    }
}