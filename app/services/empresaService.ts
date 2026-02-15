import { PrismaClient } from '@prisma/client';
import { syncCnaesGlobalmente } from './syncService';
import { validarCPF } from '@/app/utils/cpf'; 

const prisma = new PrismaClient();

function safeString(val: any): string | null {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    return str === "" ? null : str;
}

// === HELPER NOVO: Fetch Seguro (Evita erro 403) ===
async function fetchSafe(url: string) {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (compatible; EmissorNFSe/1.0; +https://brasilapi.com.br)' 
            }
        });
        clearTimeout(id);
        return res;
    } catch (e) { return null; }
}

// Adicionado userRole para controlar a posse da empresa
export async function upsertEmpresaAndLinkUser(documento: string, userId: string, dadosManuais?: any, userRole: string = 'COMUM') {
  const docLimpo = documento.replace(/\D/g, '');
  
  console.log(`\n🔍 [SERVICE] Upsert: ${docLimpo} | Role: ${userRole}`);

  if (docLimpo.length !== 14 && docLimpo.length !== 11) throw new Error("Documento inválido.");
  if (docLimpo.length === 11 && !validarCPF(docLimpo)) throw new Error("CPF Inválido.");

  // === 1. CONSULTA API ===
  let dadosApi = null;
  if (docLimpo.length === 14) {
      console.log(`🌍 [SERVICE] Buscando dados na BrasilAPI...`);
      const res = await fetchSafe(`https://brasilapi.com.br/api/cnpj/v1/${docLimpo}`);
      
      if (res && res.ok) {
          const raw = await res.json();
          let ibgeValido = null;
          if (raw.codigo_municipio) {
              const cod = String(raw.codigo_municipio).replace(/\D/g, '');
              if (cod.length === 7) ibgeValido = cod;
          }
          dadosApi = {
              razaoSocial: raw.razao_social,
              nomeFantasia: raw.nome_fantasia || raw.razao_social,
              email: raw.email,
              cep: raw.cep,
              logradouro: raw.logradouro,
              numero: raw.numero,
              bairro: raw.bairro,
              cidade: raw.municipio,
              uf: raw.uf,
              codigoIbge: ibgeValido, 
              cnaes: []
          };
          if (raw.cnae_fiscal) dadosApi.cnaes.push({ codigo: String(raw.cnae_fiscal), descricao: raw.cnae_fiscal_descricao, principal: true });
          if (raw.cnaes_secundarios) {
              raw.cnaes_secundarios.forEach((c: any) => dadosApi.cnaes.push({ codigo: String(c.codigo), descricao: c.descricao, principal: false }));
          }
      }
  }

  // === MERGE ===
  const fontePrincipal = dadosApi || dadosManuais || {};
  const fonteSecundaria = dadosManuais || {};
  
  const ibgeP = safeString(fontePrincipal.codigoIbge);
  const ibgeS = safeString(fonteSecundaria.codigoIbge);
  let ibgeFinal = (ibgeP && ibgeP.length === 7) ? ibgeP : ((ibgeS && ibgeS.length ===7) ? ibgeS : null);

  const dadosFinais = {
      razaoSocial: safeString(fontePrincipal.razaoSocial || fontePrincipal.nome) || safeString(fonteSecundaria.razaoSocial || fonteSecundaria.nome) || `Empresa ${docLimpo}`,
      nomeFantasia: safeString(fontePrincipal.nomeFantasia) || safeString(fonteSecundaria.nomeFantasia) || safeString(fontePrincipal.razaoSocial),
      email: safeString(fontePrincipal.email) || safeString(fonteSecundaria.email),
      cep: safeString(fontePrincipal.cep) || safeString(fonteSecundaria.cep),
      logradouro: safeString(fontePrincipal.logradouro) || safeString(fonteSecundaria.logradouro),
      numero: safeString(fontePrincipal.numero) || safeString(fonteSecundaria.numero),
      bairro: safeString(fontePrincipal.bairro) || safeString(fonteSecundaria.bairro),
      cidade: safeString(fontePrincipal.cidade) || safeString(fonteSecundaria.cidade),
      uf: safeString(fontePrincipal.uf) || safeString(fonteSecundaria.uf),
      codigoIbge: ibgeFinal,
      inscricaoMunicipal: safeString(fontePrincipal.inscricaoMunicipal) || safeString(fonteSecundaria.inscricaoMunicipal),
      cadastroCompleto: !!(dadosApi || dadosManuais?.razaoSocial)
  };

  // Fallback ViaCEP
  if (!dadosFinais.codigoIbge && dadosFinais.cep && dadosFinais.cep.length >= 8) {
      const cepOnly = dadosFinais.cep.replace(/\D/g, '');
      const resCep = await fetchSafe(`https://viacep.com.br/ws/${cepOnly}/json/`);
      if (resCep && resCep.ok) {
          const dataCep = await resCep.json();
          if (!dataCep.erro && dataCep.ibge) {
              dadosFinais.codigoIbge = dataCep.ibge;
              if (!dadosFinais.uf) dadosFinais.uf = dataCep.uf;
              if (!dadosFinais.cidade) dadosFinais.cidade = dataCep.localidade;
          }
      }
  }

  const listaCnaesRaw = (dadosApi && dadosApi.cnaes) ? dadosApi.cnaes : (dadosManuais?.cnaes || []);
  let cnaesUnicos: any[] = [];
  if (Array.isArray(listaCnaesRaw)) {
      const mapUnicos = new Map();
      listaCnaesRaw.forEach((c: any) => {
          const cod = String(c.codigo).replace(/\D/g, '');
          mapUnicos.set(cod, { codigo: cod, descricao: c.descricao, principal: c.principal });
      });
      cnaesUnicos = Array.from(mapUnicos.values());
  }

  // === TRANSAÇÃO ===
  const empresaProcessada = await prisma.$transaction(async (tx) => {
      const empresaExistente = await tx.empresa.findUnique({
          where: { documento: docLimpo },
          include: { donoUser: true }
      });

      // >> CONTADOR <<
      if (userRole === 'CONTADOR') {
          // Verifica se já existe vínculo
          if (empresaExistente) {
             const vinculo = await tx.contadorVinculo.findUnique({
                  where: { contadorId_empresaId: { contadorId: userId, empresaId: empresaExistente.id } }
              });
              if (vinculo) throw new Error("Empresa já vinculada ou solicitação pendente.");
          }

          // === CORREÇÃO DE SEGURANÇA ===
          // Se tem dono = PENDENTE. Se não tem dono = APROVADO.
          const statusVinculo = (empresaExistente && empresaExistente.donoUser) ? 'PENDENTE' : 'APROVADO';

          const empresa = await tx.empresa.upsert({
              where: { documento: docLimpo },
              update: { ...dadosFinais, lastApiCheck: new Date() },
              create: { documento: docLimpo, ...dadosFinais, lastApiCheck: new Date() }
          });

          if (cnaesUnicos.length > 0 && (!empresaExistente || !empresaExistente.cadastroCompleto)) {
              await tx.cnae.deleteMany({ where: { empresaId: empresa.id } });
              await tx.cnae.createMany({ data: cnaesUnicos.map(c => ({ ...c, empresaId: empresa.id })) });
          }

          await tx.contadorVinculo.create({
              data: { contadorId: userId, empresaId: empresa.id, status: statusVinculo }
          });

          // Retorna com flag de status para o controller saber qual mensagem exibir
          return { ...empresa, _statusVinculo: statusVinculo };
      } 
      
      // >> CLIENTE <<
      else {
          if (empresaExistente && empresaExistente.donoUser && empresaExistente.donoUser.id !== userId) {
              throw new Error("Esta empresa já pertence a outro usuário.");
          }
          if (empresaExistente && !empresaExistente.donoUser) {
              await tx.contadorVinculo.updateMany({ where: { empresaId: empresaExistente.id, status: 'APROVADO' }, data: { status: 'PENDENTE' } });
          }

          const empresa = await tx.empresa.upsert({
              where: { documento: docLimpo },
              update: { ...dadosFinais, lastApiCheck: new Date(), donoUser: { connect: { id: userId } } },
              create: { documento: docLimpo, ...dadosFinais, lastApiCheck: new Date(), donoUser: { connect: { id: userId } } }
          });

          if (cnaesUnicos.length > 0) {
              await tx.cnae.deleteMany({ where: { empresaId: empresa.id } });
              await tx.cnae.createMany({ data: cnaesUnicos.map(c => ({ ...c, empresaId: empresa.id })) });
          }

          await tx.userCliente.upsert({
              where: { userId_empresaId: { userId, empresaId: empresa.id } },
              create: { userId, empresaId: empresa.id, apelido: dadosFinais.nomeFantasia },
              update: {}
          });
          await tx.user.update({ where: { id: userId }, data: { empresaId: empresa.id } });

          return empresa;
      }
  });

  if (cnaesUnicos.length > 0 && dadosFinais.codigoIbge) {
      await syncCnaesGlobalmente(cnaesUnicos, dadosFinais.codigoIbge);
  }
  
  return empresaProcessada;
}