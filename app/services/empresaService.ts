import { PrismaClient } from '@prisma/client';
import { syncCnaesGlobalmente } from './syncService';

const prisma = new PrismaClient();

export async function upsertEmpresaAndLinkUser(cnpj: string, userId: string, dadosManuais?: any) {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  if (cnpjLimpo.length !== 14) throw new Error("CNPJ Inválido");

  console.log(`[SERVICE] Iniciando cadastro empresa: ${cnpjLimpo}`);

  // 1. Tenta buscar dados da API externa
  let dadosApi = null;
  try {
    const baseUrl = process.env.URL_API_LOCAL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/external/cnpj`, {
        method: 'POST', body: JSON.stringify({ cnpj: cnpjLimpo })
    });
    if (res.ok) {
        dadosApi = await res.json();
    }
  } catch (e) {
    console.log("[SERVICE] Falha ao consultar API externa, usando dados manuais.");
  }

  const dados = dadosApi || dadosManuais;

  if (dados && !dados.razaoSocial && dados.nome) {
      dados.razaoSocial = dados.nome;
  }

  if (!dados || !dados.razaoSocial) {
      throw new Error("Dados da empresa não encontrados (Razão Social obrigatória).");
  }

  // === LIMPEZA DE DUPLICATAS NA LISTA DE CNAES (MEMÓRIA) ===
  let cnaesUnicos: any[] = [];
  if (dados.cnaes && Array.isArray(dados.cnaes)) {
      const mapUnicos = new Map();
      
      dados.cnaes.forEach((c: any) => {
          const codigoLimpo = String(c.codigo).replace(/\D/g, '');
          // Só adiciona se ainda não processamos este código
          if (!mapUnicos.has(codigoLimpo)) {
              mapUnicos.set(codigoLimpo, {
                  codigo: codigoLimpo,
                  descricao: c.descricao,
                  principal: c.principal
              });
          }
      });
      cnaesUnicos = Array.from(mapUnicos.values());
  }
  // =========================================================

  // 2. Upsert Empresa
  const empresa = await prisma.empresa.upsert({
    where: { documento: cnpjLimpo },
    update: {
        razaoSocial: dados.razaoSocial,
        nomeFantasia: dados.nomeFantasia,
        email: dados.email,
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        bairro: dados.bairro,
        cidade: dados.cidade,
        uf: dados.uf,
        codigoIbge: dados.codigoIbge,
        lastApiCheck: new Date(),
        
        // === AQUI ESTÁ A CORREÇÃO MÁGICA ===
        // Ao atualizar a empresa, apagamos os CNAEs velhos e criamos os limpos
        atividades: {
            deleteMany: {}, // <--- Apaga TODOS os CNAEs dessa empresa
            create: cnaesUnicos // <--- Cria apenas os únicos
        }
    },
    create: {
        documento: cnpjLimpo,
        razaoSocial: dados.razaoSocial,
        nomeFantasia: dados.nomeFantasia,
        email: dados.email,
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        bairro: dados.bairro,
        cidade: dados.cidade,
        uf: dados.uf,
        codigoIbge: dados.codigoIbge,
        lastApiCheck: new Date(),
        atividades: {
            create: cnaesUnicos // Usa a lista limpa
        }
    }
  });

  // 3. Link User (Adiciona na lista "Meus Clientes")
  const vinculo = await prisma.userCliente.findUnique({
      where: { userId_empresaId: { userId, empresaId: empresa.id } }
  });

  if (!vinculo) {
      await prisma.userCliente.create({
          data: {
              userId,
              empresaId: empresa.id,
              apelido: dados.nomeFantasia || dados.razaoSocial
          }
      });
  }

  // === SINCRONIZAÇÃO COM TABELAS GLOBAIS ===
  if (cnaesUnicos.length > 0) {
      await syncCnaesGlobalmente(cnaesUnicos, empresa.codigoIbge);
  }
  
  return empresa;
}