import { PrismaClient } from '@prisma/client';
import { syncCnaesGlobalmente } from './syncService';
import { validarCPF } from '@/app/utils/cpf'; // <--- Importante

const prisma = new PrismaClient();

export async function upsertEmpresaAndLinkUser(documento: string, userId: string, dadosManuais?: any) {
  const docLimpo = documento.replace(/\D/g, '');
  
  // 1. Validação de Formato (Tamanho)
  if (docLimpo.length !== 14 && docLimpo.length !== 11) {
      throw new Error("Documento inválido (Deve ter 11 ou 14 dígitos).");
  }

  // 2. Validação Matemática de CPF (NOVO: BLINDAGEM DO BACKEND)
  if (docLimpo.length === 11) {
      if (!validarCPF(docLimpo)) {
          throw new Error("CPF Inválido: Dígitos verificadores não conferem.");
      }
  }

  console.log(`[SERVICE] Iniciando cadastro: ${docLimpo}`);

  // 3. Tenta buscar dados da API externa APENAS SE FOR CNPJ (14 dígitos)
  let dadosApi = null;
  
  if (docLimpo.length === 14) {
      try {
        const baseUrl = process.env.URL_API_LOCAL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/external/cnpj`, {
            method: 'POST', body: JSON.stringify({ cnpj: docLimpo })
        });
        if (res.ok) {
            dadosApi = await res.json();
        }
      } catch (e) {
        console.log("[SERVICE] Falha ao consultar API externa, usando dados manuais.");
      }
  }

  const dados = dadosApi || dadosManuais;

  if (dados && !dados.razaoSocial && dados.nome) {
      dados.razaoSocial = dados.nome;
  }

  if (!dados || !dados.razaoSocial) {
      throw new Error("Dados do cliente incompletos (Nome/Razão Social obrigatório).");
  }

  // === LIMPEZA DE DUPLICATAS NA LISTA DE CNAES ===
  let cnaesUnicos: any[] = [];
  if (dados.cnaes && Array.isArray(dados.cnaes)) {
      const mapUnicos = new Map();
      dados.cnaes.forEach((c: any) => {
          const codigoLimpo = String(c.codigo).replace(/\D/g, '');
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

  // 4. Upsert Empresa (Cliente/Tomador)
  const empresa = await prisma.empresa.upsert({
    where: { documento: docLimpo },
    update: {
        razaoSocial: dados.razaoSocial,
        nomeFantasia: dados.nomeFantasia || dados.razaoSocial,
        email: dados.email,
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        bairro: dados.bairro,
        cidade: dados.cidade,
        uf: dados.uf,
        codigoIbge: dados.codigoIbge, // ESSENCIAL
        lastApiCheck: new Date(),
        
        ...(cnaesUnicos.length > 0 && {
            atividades: {
                deleteMany: {}, 
                create: cnaesUnicos 
            }
        })
    },
    create: {
        documento: docLimpo,
        razaoSocial: dados.razaoSocial,
        nomeFantasia: dados.nomeFantasia || dados.razaoSocial,
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
            create: cnaesUnicos 
        }
    }
  });

  // 5. Link User
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

  if (cnaesUnicos.length > 0) {
      await syncCnaesGlobalmente(cnaesUnicos, empresa.codigoIbge);
  }
  
  return empresa;
}