import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function upsertEmpresaAndLinkUser(cnpj: string, userId: string, dadosManuais?: any) {
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  if (cnpjLimpo.length !== 14) throw new Error("CNPJ Inválido");

  // 1. Tenta buscar dados da API externa
  let dadosApi = null;
  try {
    const baseUrl = process.env.URL_API_LOCAL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/external/cnpj`, {
        method: 'POST', body: JSON.stringify({ cnpj: cnpjLimpo })
    });
    if (res.ok) dadosApi = await res.json();
  } catch (e) {
    console.log("Falha ao consultar API externa, usando dados manuais");
  }

  // Se a API falhou, usamos o que o usuário digitou no formulário
  const dados = dadosApi || dadosManuais;

  // === CORREÇÃO 1: Mapear 'nome' para 'razaoSocial' ===
  // O formulário envia 'nome', mas o banco exige 'razaoSocial'.
  // Se faltar a razão social, usamos o nome digitado.
  if (dados && !dados.razaoSocial && dados.nome) {
      dados.razaoSocial = dados.nome;
  }

  if (!dados || !dados.razaoSocial) {
      throw new Error("Dados da empresa não encontrados (Razão Social obrigatória).");
  }

  // 2. Busca ou Cria a Empresa (Centralizada)
  const empresa = await prisma.empresa.upsert({
    where: { documento: cnpjLimpo },
    update: {
        // Atualiza se já existir
        razaoSocial: dados.razaoSocial,
        nomeFantasia: dados.nomeFantasia,
        email: dados.email, // <--- CORREÇÃO 2: Gravando e-mail na atualização
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        bairro: dados.bairro,
        cidade: dados.cidade,
        uf: dados.uf,
        codigoIbge: dados.codigoIbge,
        lastApiCheck: new Date()
    },
    create: {
        documento: cnpjLimpo,
        razaoSocial: dados.razaoSocial,
        nomeFantasia: dados.nomeFantasia,
        email: dados.email, // <--- CORREÇÃO 2: Gravando e-mail na criação
        cep: dados.cep,
        logradouro: dados.logradouro,
        numero: dados.numero,
        bairro: dados.bairro,
        cidade: dados.cidade,
        uf: dados.uf,
        codigoIbge: dados.codigoIbge,
        lastApiCheck: new Date(),
        // Cria CNAEs se vierem da API
        atividades: {
            create: dados.cnaes?.map((c: any) => ({
                codigo: c.codigo,
                descricao: c.descricao,
                principal: c.principal
            }))
        }
    }
  });

  // 3. Cria o vínculo com o Usuário (Adiciona na lista "Meus Clientes")
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

  return empresa;
}