import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { syncCnaesGlobalmente } from '@/app/services/syncService'; 
import forge from 'node-forge';

const prisma = new PrismaClient();

// GET
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  const contextEmpresaId = request.headers.get('x-empresa-id');

  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  // 1. Busca o usuário logado
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { empresa: true }
  });

  if (!user) return NextResponse.json({ error: 'User não encontrado' }, { status: 404 });

  // === NOVA IMPLEMENTAÇÃO: LÓGICA DE PLANOS E STAFF ===
  const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role);
  let planoDetalhado = null;

  if (isStaff) {
      // Se for ADMIN, gera um plano "virtual" ilimitado
      planoDetalhado = {
          nome: 'Acesso Administrativo',
          slug: 'ADMIN_ACCESS',
          status: 'ATIVO',
          dataInicio: user.createdAt,
          dataFim: null, // Vitalício
          usoEmissoes: 0,
          limiteEmissoes: 0, // 0 = Ilimitado
          diasTeste: 0
      };
  } else {
      // Se for CLIENTE, busca o plano real no histórico
      const planoAtivo = await prisma.planHistory.findFirst({
          where: { userId: user.id, status: 'ATIVO' },
          include: { plan: true },
          orderBy: { createdAt: 'desc' }
      });

      planoDetalhado = planoAtivo ? {
          nome: planoAtivo.plan.name,
          slug: planoAtivo.plan.slug,
          status: planoAtivo.status,
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
  // ====================================================

  // 2. Lógica de Contexto
  let empresaAlvoId = null;

  if (contextEmpresaId && contextEmpresaId !== 'null' && contextEmpresaId !== 'undefined') {
      // Se for STAFF, permite acesso direto (bypass)
      if (isStaff) {
          empresaAlvoId = contextEmpresaId;
      } else {
          // Se for cliente/contador, valida o vínculo
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
    // Dados da Empresa
    ...restEmpresa,
    emailComercial: emailEmpresa,
    temCertificado: !!certificadoA1,
    vencimentoCertificado: dadosEmpresa.certificadoVencimento,
    cadastroCompleto: dadosEmpresa.cadastroCompleto || false,
    atividades: atividadesEnriquecidas,

    // Dados do Usuário
    role: user.role,
    nome: user.nome,
    email: user.email,
    cpf: user.cpf,
    telefone: user.telefone,
    tutorialStep: user.tutorialStep, 
    
    configuracoes: {
        darkMode: user.darkMode,
        idioma: user.idioma,
        notificacoesEmail: user.notificacoesEmail
    },
    
    // === DETALHES DO PLANO (IMPLEMENTADO) ===
    planoDetalhado,

    // Campos legados para compatibilidade
    planoSlug: user.plano, 
    planoCiclo: user.planoCiclo,
    
    isContextMode: empresaAlvoId !== user.empresaId
  });
}

// PUT
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
        telefone: body.telefone
    };

    if (body.configuracoes) {
        userDataToUpdate.darkMode = body.configuracoes.darkMode;
        userDataToUpdate.idioma = body.configuracoes.idioma;
        userDataToUpdate.notificacoesEmail = body.configuracoes.notificacoesEmail;
    }

    await prisma.user.update({ where: { id: userId }, data: userDataToUpdate });

    if (body.documento) {
      const cnpjLimpo = body.documento.replace(/\D/g, '');
      
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
          codigoIbge: body.codigoIbge,
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
              await syncCnaesGlobalmente(body.cnaes, empresaSalva.codigoIbge);
          }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}