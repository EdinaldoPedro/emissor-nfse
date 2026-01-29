import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { syncCnaesGlobalmente } from '@/app/services/syncService'; 
import forge from 'node-forge';
import { validateRequest } from '@/app/utils/api-security';

const prisma = new PrismaClient();

// === HELPER: BUSCA IBGE NO BACKEND (SEGURANÇA) ===
async function buscarIbgePorCep(cep: string): Promise<string | null> {
    try {
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return null;
        
        // Busca silenciosa no ViaCEP
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, { next: { revalidate: 3600 } });
        const data = await res.json();
        
        if (!data.erro && data.ibge) {
            return data.ibge;
        }
        return null;
    } catch (e) {
        console.error("Erro ao buscar IBGE (Backend Perfil):", e);
        return null;
    }
}

// GET
export async function GET(request: Request) {
  const { targetId, errorResponse } = await validateRequest(request);
  if (errorResponse) return errorResponse;

  const userId = targetId;
  const contextEmpresaId = request.headers.get('x-empresa-id');

  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  // 1. Busca o usuário logado
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { empresa: true }
  });

  if (!user) return NextResponse.json({ error: 'User não encontrado' }, { status: 404 });

  // === LÓGICA DE PLANOS E STAFF ===
  const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role);
  let planoDetalhado = null;

  if (isStaff) {
      planoDetalhado = {
          nome: 'Acesso Administrativo',
          slug: 'ADMIN_ACCESS',
          status: 'ATIVO',
          dataInicio: user.createdAt,
          dataFim: null, 
          usoEmissoes: 0,
          limiteEmissoes: 0, 
          diasTeste: 0
      };
  } else {
        const planoAtivo = await prisma.planHistory.findFirst({
            where: { userId: user.id, status: 'ATIVO' },
            include: { plan: true },
            orderBy: { createdAt: 'desc' }
        });

        let statusVisual = planoAtivo?.status || 'INATIVO';
        if (planoAtivo && planoAtivo.plan.maxNotasMensal > 0 && planoAtivo.notasEmitidas >= planoAtivo.plan.maxNotasMensal) {
            statusVisual = 'LIMITE_ATINGIDO';
        }

        if (planoAtivo && planoAtivo.dataFim && new Date() > planoAtivo.dataFim) {
            statusVisual = 'EXPIRADO';
        }

        planoDetalhado = planoAtivo ? {
            nome: planoAtivo.plan.name,
            slug: planoAtivo.plan.slug,
            status: statusVisual,
            dataInicio: planoAtivo.dataInicio,
            dataFim: planoAtivo.dataFim,
            usoEmissoes: planoAtivo.notasEmitidas,
            limiteEmissoes: planoAtivo.plan.maxNotasMensal,
            diasTeste: planoAtivo.plan.diasTeste
        } : { 
            nome: 'Sem Plano Ativo', 
            slug: 'FREE', 
            status: 'INATIVO', 
            usoEmissoes: 0, 
            limiteEmissoes: 0 
        };
  }

  // 2. Lógica de Contexto
  let empresaAlvoId = null;

  if (contextEmpresaId && contextEmpresaId !== 'null' && contextEmpresaId !== 'undefined') {
      if (isStaff) {
          empresaAlvoId = contextEmpresaId;
      } else {
          const vinculo = await prisma.contadorVinculo.findUnique({
              where: {
                  contadorId_empresaId: { contadorId: userId, empresaId: contextEmpresaId }
              }
          });
          if (vinculo && vinculo.status === 'APROVADO') {
              empresaAlvoId = contextEmpresaId; 
          }
      }
  }

  if (!empresaAlvoId) {
      empresaAlvoId = user.empresaId;
  }

  // 3. Busca os dados da empresa ALVO
  let dadosEmpresa: any = {};
  
  if (empresaAlvoId) {
      const emp = await prisma.empresa.findUnique({
          where: { id: empresaAlvoId },
          include: { atividades: true }
      });
      if (emp) dadosEmpresa = emp;
  }

  let atividadesEnriquecidas = dadosEmpresa.atividades || [];
  
  if (atividadesEnriquecidas.length > 0) {
      const codigos = atividadesEnriquecidas.map((c: any) => c.codigo);
      const globais = await prisma.globalCnae.findMany({
          where: { codigo: { in: codigos } }
      });

      atividadesEnriquecidas = atividadesEnriquecidas.map((local: any) => {
          const global = globais.find((g: any) => g.codigo === local.codigo);
          return {
              ...local,
              temRetencaoInss: global ? global.temRetencaoInss : local.temRetencaoInss,
              codigoNbs: global?.codigoNbs || local.codigoNbs
          };
      });
  }

  // @ts-ignore
  const { certificadoA1, senhaCertificado, email: emailEmpresa, ...restEmpresa } = dadosEmpresa;

  return NextResponse.json({
    ...restEmpresa,
    emailComercial: emailEmpresa,
    temCertificado: !!certificadoA1,
    vencimentoCertificado: dadosEmpresa.certificadoVencimento,
    cadastroCompleto: dadosEmpresa.cadastroCompleto || false,
    atividades: atividadesEnriquecidas,

    role: user.role,
    nome: user.nome,
    email: user.email,
    cpf: user.cpf,
    telefone: user.telefone,
    cargo: user.cargo,
    tutorialStep: user.tutorialStep, 
    
    configuracoes: {
        darkMode: user.darkMode,
        idioma: user.idioma,
        notificacoesEmail: user.notificacoesEmail
    },
    
    planoDetalhado,
    planoSlug: user.plano, 
    planoCiclo: user.planoCiclo,
    
    isContextMode: empresaAlvoId !== user.empresaId
  });
}

// PUT (AQUI ESTÁ A CORREÇÃO DE SEGURANÇA)
export async function PUT(request: Request) {
  const userId = request.headers.get('x-user-id');
  const contextEmpresaId = request.headers.get('x-empresa-id');
  const body = await request.json();

  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ 
        where: { id: userId },
        include: { empresa: true }
    });

    const userDataToUpdate: any = {
        nome: body.nome,
        telefone: body.telefone,
        cargo: body.perfil?.cargo || body.cargo
    };

    if (body.configuracoes) {
        userDataToUpdate.darkMode = body.configuracoes.darkMode;
        userDataToUpdate.idioma = body.configuracoes.idioma;
        userDataToUpdate.notificacoesEmail = body.configuracoes.notificacoesEmail;
    }

    await prisma.user.update({ where: { id: userId }, data: userDataToUpdate });

    if (body.documento) {
      const cnpjLimpo = body.documento.replace(/\D/g, '');
      
      // === CORREÇÃO: GARANTIA DE IBGE ===
      // Se o front mandou CEP mas não mandou IBGE (comum na atualização via Receita),
      // nós buscamos manualmente agora.
      if (body.cep && (!body.codigoIbge || body.codigoIbge.length < 7)) {
          console.log(`[PERFIL] Detectada falta de IBGE. Buscando para CEP: ${body.cep}`);
          const ibgeResgatado = await buscarIbgePorCep(body.cep);
          if (ibgeResgatado) {
              body.codigoIbge = ibgeResgatado;
              console.log(`[PERFIL] IBGE recuperado e salvo: ${ibgeResgatado}`);
          }
      }
      // ==================================

      const dadosEmpresa: any = {
          razaoSocial: body.razaoSocial,
          nomeFantasia: body.nomeFantasia,
          inscricaoMunicipal: body.inscricaoMunicipal,
          regimeTributario: body.regimeTributario,
          cep: body.cep,
          logradouro: body.logradouro,
          numero: body.numero,
          bairro: body.bairro,
          cidade: body.cidade,
          uf: body.uf,
          codigoIbge: body.codigoIbge, // Agora garantido pela lógica acima
          email: body.emailComercial || body.email,
          cadastroCompleto: true,
          serieDPS: body.serieDPS, 
          ultimoDPS: body.ultimoDPS ? parseInt(String(body.ultimoDPS)) : undefined,
          ambiente: body.ambiente
      };

      if (body.deletarCertificado) {
          dadosEmpresa.certificadoA1 = null;
          dadosEmpresa.senhaCertificado = null;
          dadosEmpresa.certificadoVencimento = null;
      } 
      else if (body.certificadoArquivo && body.certificadoSenha) {
          try {
              const p12Der = forge.util.decode64(body.certificadoArquivo);
              const p12Asn1 = forge.asn1.fromDer(p12Der);
              const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, body.certificadoSenha);
              let dataVencimento = null;
              const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
              // @ts-ignore
              const certBag = bags[forge.pki.oids.certBag]?.[0];
              if(certBag && certBag.cert) dataVencimento = certBag.cert.validity.notAfter;
              dadosEmpresa.certificadoA1 = body.certificadoArquivo;
              dadosEmpresa.senhaCertificado = body.certificadoSenha;
              dadosEmpresa.certificadoVencimento = dataVencimento;
          } catch (e) {
              return NextResponse.json({ error: 'Senha incorreta ou arquivo inválido.' }, { status: 400 });
          }
      }

      const empresaSalva = await prisma.empresa.upsert({
          where: { documento: cnpjLimpo },
          update: dadosEmpresa,
          create: { documento: cnpjLimpo, ...dadosEmpresa }
      });

      if (user?.empresaId !== empresaSalva.id && !contextEmpresaId) {
          await prisma.user.update({ where: { id: userId }, data: { empresaId: empresaSalva.id } });
      }

      if (body.cnaes && Array.isArray(body.cnaes)) {
          await prisma.cnae.deleteMany({ where: { empresaId: empresaSalva.id } });
          if (body.cnaes.length > 0) {
              await prisma.cnae.createMany({
                  data: body.cnaes.map((c: any) => ({
                      empresaId: empresaSalva.id,
                      codigo: String(c.codigo).replace(/\D/g, ''),
                      descricao: c.descricao,
                      principal: c.principal,
                      codigoNbs: c.codigoNbs,
                      temRetencaoInss: c.temRetencaoInss || false
                  }))
              });
              
              // Garante sincronia usando o IBGE que acabamos de salvar
              if (empresaSalva.codigoIbge) {
                  await syncCnaesGlobalmente(body.cnaes, empresaSalva.codigoIbge);
              }
          }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro no Profile PUT:", error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}