import { PrismaClient } from '@prisma/client';
import { syncCnaesGlobalmente } from './syncService';
import { validarCPF } from '@/app/utils/cpf'; 

const prisma = new PrismaClient();

// Helper para garantir string limpa e logar valores estranhos
function safeString(val: any): string | null {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    return str === "" ? null : str;
}

export async function upsertEmpresaAndLinkUser(documento: string, userId: string, dadosManuais?: any) {
  const docLimpo = documento.replace(/\D/g, '');
  
  // === LOG INICIAL ===
  console.log(`\n🔍 [DEBUG] Iniciando Upsert para: ${docLimpo}`);
  console.log(`📥 [DEBUG] Dados Manuais Recebidos (IBGE):`, dadosManuais?.codigoIbge);

  // 1. Validação de Formato
  if (docLimpo.length !== 14 && docLimpo.length !== 11) {
      throw new Error("Documento inválido (Deve ter 11 ou 14 dígitos).");
  }

  // 2. Validação CPF
  if (docLimpo.length === 11 && !validarCPF(docLimpo)) {
      throw new Error("CPF Inválido.");
  }

  // 3. Consulta API Externa (Apenas CNPJ)
  let dadosApi = null;
  if (docLimpo.length === 14) {
      try {
        const baseUrl = process.env.URL_API_LOCAL || 'http://localhost:3000';
        console.log(`🌍 [DEBUG] Consultando API Interna: ${baseUrl}/api/external/cnpj`);
        
        const res = await fetch(`${baseUrl}/api/external/cnpj`, {
            method: 'POST', 
            body: JSON.stringify({ cnpj: docLimpo }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (res.ok) {
            dadosApi = await res.json();
            console.log(`✅ [DEBUG] API retornou dados. IBGE da API:`, dadosApi?.codigoIbge);
        } else {
            console.log(`⚠️ [DEBUG] API falhou com status: ${res.status}`);
        }
      } catch (e) {
        console.log("❌ [DEBUG] Erro de conexão com API externa (Timeout/Rede).");
      }
  }

  // === LÓGICA DE DECISÃO (MERGE) ===
  const fontePrincipal = dadosApi || dadosManuais || {};
  const fonteSecundaria = dadosManuais || {};

  const ibgePrincipal = safeString(fontePrincipal.codigoIbge);
  const ibgeSecundario = safeString(fonteSecundaria.codigoIbge);
  
  // Decide qual IBGE usar
  let ibgeFinal = ibgePrincipal || ibgeSecundario;
  console.log(`🤔 [DEBUG] Decisão IBGE: Principal(${ibgePrincipal}) || Secundário(${ibgeSecundario}) = ${ibgeFinal}`);

  const dadosFinais = {
      razaoSocial: safeString(fontePrincipal.razaoSocial || fontePrincipal.nome) || safeString(fonteSecundaria.razaoSocial || fonteSecundaria.nome),
      nomeFantasia: safeString(fontePrincipal.nomeFantasia) || safeString(fonteSecundaria.nomeFantasia) || safeString(fontePrincipal.razaoSocial),
      email: safeString(fontePrincipal.email) || safeString(fonteSecundaria.email),
      
      cep: safeString(fontePrincipal.cep) || safeString(fonteSecundaria.cep),
      logradouro: safeString(fontePrincipal.logradouro) || safeString(fonteSecundaria.logradouro),
      numero: safeString(fontePrincipal.numero) || safeString(fonteSecundaria.numero),
      bairro: safeString(fontePrincipal.bairro) || safeString(fonteSecundaria.bairro),
      cidade: safeString(fontePrincipal.cidade) || safeString(fonteSecundaria.cidade),
      uf: safeString(fontePrincipal.uf) || safeString(fonteSecundaria.uf),
      
      codigoIbge: ibgeFinal,
      inscricaoMunicipal: safeString(fontePrincipal.inscricaoMunicipal) || safeString(fonteSecundaria.inscricaoMunicipal)
  };

  // === FALLBACK DE EMERGÊNCIA (Última tentativa) ===
  if (!dadosFinais.codigoIbge && dadosFinais.cep && dadosFinais.cep.length >= 8) {
      console.log("🚨 [DEBUG] IBGE ainda nulo! Tentando ViaCEP de emergência...");
      try {
          const cepOnly = dadosFinais.cep.replace(/\D/g, '');
          const resCep = await fetch(`https://viacep.com.br/ws/${cepOnly}/json/`);
          const dataCep = await resCep.json();
          if (!dataCep.erro && dataCep.ibge) {
              dadosFinais.codigoIbge = dataCep.ibge;
              console.log(`✅ [DEBUG] ViaCEP salvou o dia! IBGE: ${dataCep.ibge}`);
              
              if (!dadosFinais.uf) dadosFinais.uf = dataCep.uf;
              if (!dadosFinais.cidade) dadosFinais.cidade = dataCep.localidade;
          } else {
              console.log("❌ [DEBUG] ViaCEP também falhou ou CEP inválido.");
          }
      } catch(err) {
          console.error("❌ [DEBUG] Falha de rede no ViaCEP de emergência.");
      }
  }

  if (!dadosFinais.razaoSocial) {
      throw new Error("Dados incompletos: Razão Social é obrigatória.");
  }

  console.log(`💾 [DEBUG] Preparando Gravação -> IBGE FINAL: ${dadosFinais.codigoIbge}`);

  // === TRATAMENTO DE CNAES ===
  const listaCnaesRaw = (dadosApi && dadosApi.cnaes) ? dadosApi.cnaes : (dadosManuais?.cnaes || []);
  let cnaesUnicos: any[] = [];
  if (Array.isArray(listaCnaesRaw)) {
      const mapUnicos = new Map();
      listaCnaesRaw.forEach((c: any) => {
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

  // ==================================================================================
  // 4. TRANSAÇÃO SEGURA: UPSERT + TAKEOVER (CLIENTE ASSUME PROPRIEDADE) + VÍNCULOS
  // ==================================================================================
  const empresaProcessada = await prisma.$transaction(async (tx) => {
      
      // A. Verifica se a empresa já existe para aplicar regras de negócio
      const empresaExistente = await tx.empresa.findUnique({
          where: { documento: docLimpo },
          include: { donoUser: true }
      });

      // Lógica de Segurança (Takeover)
      if (empresaExistente) {
          // 1. Se já tem dono e não é o usuário atual -> ERRO (Não pode roubar empresa de outro)
          if (empresaExistente.donoUser && empresaExistente.donoUser.id !== userId) {
              throw new Error("Esta empresa já pertence a outro usuário cadastrado no sistema.");
          }

          // 2. Se NÃO tem dono (foi criada por contador), o cliente assume AGORA.
          if (!empresaExistente.donoUser) {
              console.log(`[TAKEOVER] Usuário ${userId} assumindo empresa órfã ${empresaExistente.id}`);
              
              // "Derruba" os contadores: Muda status de APROVADO para PENDENTE
              // O contador perde acesso imediato e precisa solicitar novamente ao novo dono.
              await tx.contadorVinculo.updateMany({
                  where: { empresaId: empresaExistente.id, status: 'APROVADO' },
                  data: { status: 'PENDENTE' }
              });
          }
      }

      // B. Executa a Gravação no Banco (Upsert) garantindo o DONO
      const empresa = await tx.empresa.upsert({
        where: { documento: docLimpo },
        update: {
            razaoSocial: dadosFinais.razaoSocial!,
            nomeFantasia: dadosFinais.nomeFantasia,
            email: dadosFinais.email,
            cep: dadosFinais.cep,
            logradouro: dadosFinais.logradouro,
            numero: dadosFinais.numero,
            bairro: dadosFinais.bairro,
            cidade: dadosFinais.cidade,
            uf: dadosFinais.uf,
            codigoIbge: dadosFinais.codigoIbge, 
            inscricaoMunicipal: dadosFinais.inscricaoMunicipal,
            lastApiCheck: new Date(),
            donoUser: { connect: { id: userId } }, // <--- VINCULA PROPRIEDADE
            ...(cnaesUnicos.length > 0 && {
                atividades: { deleteMany: {}, create: cnaesUnicos }
            })
        },
        create: {
            documento: docLimpo,
            razaoSocial: dadosFinais.razaoSocial!,
            nomeFantasia: dadosFinais.nomeFantasia,
            email: dadosFinais.email,
            cep: dadosFinais.cep,
            logradouro: dadosFinais.logradouro,
            numero: dadosFinais.numero,
            bairro: dadosFinais.bairro,
            cidade: dadosFinais.cidade,
            uf: dadosFinais.uf,
            codigoIbge: dadosFinais.codigoIbge, 
            inscricaoMunicipal: dadosFinais.inscricaoMunicipal,
            lastApiCheck: new Date(),
            donoUser: { connect: { id: userId } }, // <--- VINCULA PROPRIEDADE
            atividades: { create: cnaesUnicos }
        }
      });

      // C. Garante o vínculo UserCliente (para acesso ao dashboard)
      await tx.userCliente.upsert({
          where: { userId_empresaId: { userId, empresaId: empresa.id } },
          update: {},
          create: {
              userId,
              empresaId: empresa.id,
              apelido: dadosFinais.nomeFantasia || dadosFinais.razaoSocial
          }
      });

      // D. Atualiza o ID da empresa principal no perfil do User
      await tx.user.update({
          where: { id: userId },
          data: { empresaId: empresa.id }
      });

      return empresa;
  });

  // 6. Sincronização Global de CNAEs (Fora da transação para não travar)
  if (cnaesUnicos.length > 0 && dadosFinais.codigoIbge) {
      await syncCnaesGlobalmente(cnaesUnicos, dadosFinais.codigoIbge);
  }
  
  return empresaProcessada;
}