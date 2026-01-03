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

  let empresaAlvoId = null;

  // 1. Busca o usuário logado
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { empresa: true }
  });

  if (!user) return NextResponse.json({ error: 'User não encontrado' }, { status: 404 });

  // 2. Lógica de Contexto
  if (contextEmpresaId && contextEmpresaId !== 'null' && contextEmpresaId !== 'undefined') {
      const vinculo = await prisma.contadorVinculo.findUnique({
          where: {
              contadorId_empresaId: { contadorId: userId, empresaId: contextEmpresaId }
          }
      });

      if (vinculo && vinculo.status === 'APROVADO') {
          empresaAlvoId = contextEmpresaId; 
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

  // @ts-ignore
  const { certificadoA1, senhaCertificado, email: emailEmpresa, ...restEmpresa } = dadosEmpresa;

  return NextResponse.json({
    // Dados da Empresa
    ...restEmpresa,
    emailComercial: emailEmpresa,
    temCertificado: !!certificadoA1,
    vencimentoCertificado: dadosEmpresa.certificadoVencimento,
    cadastroCompleto: dadosEmpresa.cadastroCompleto || false,
    atividades: dadosEmpresa.atividades || [],

    // Dados do Usuário
    role: user.role,
    nome: user.nome,
    email: user.email,
    cpf: user.cpf,
    telefone: user.telefone,
    
    // --- CORREÇÃO AQUI: AGRUPAR PREFERÊNCIAS ---
    // O frontend espera um objeto 'configuracoes', mas o banco tem campos soltos.
    configuracoes: {
        darkMode: user.darkMode,
        idioma: user.idioma,
        notificacoesEmail: user.notificacoesEmail
    },
    
    // Flag de contexto
    isContextMode: empresaAlvoId !== user.empresaId
  });
}

// PUT
export async function PUT(request: Request) {
  const userId = request.headers.get('x-user-id');
  const body = await request.json();

  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ 
        where: { id: userId },
        include: { empresa: true }
    });

    const isAdmin = ['ADMIN', 'MASTER', 'SUPORTE'].includes(user?.role || '');
    const empresaExistente = user?.empresa;

    if (empresaExistente?.cadastroCompleto && !isAdmin && body.documento) {
        const cnpjAtual = empresaExistente.documento;
        const cnpjNovo = body.documento.replace(/\D/g, '');
        if (cnpjAtual !== cnpjNovo) {
            return NextResponse.json({ error: 'CNPJ bloqueado.' }, { status: 403 });
        }
    }

    // 1. Atualiza User (Dados Pessoais + Configurações)
    const userDataToUpdate: any = {
        nome: body.nome,
        telefone: body.telefone
    };

    // --- CORREÇÃO AQUI: DESAGRUPAR PREFERÊNCIAS ---
    // Se vier o objeto 'configuracoes', salvamos nos campos individuais do banco
    if (body.configuracoes) {
        userDataToUpdate.darkMode = body.configuracoes.darkMode;
        userDataToUpdate.idioma = body.configuracoes.idioma;
        userDataToUpdate.notificacoesEmail = body.configuracoes.notificacoesEmail;
    }

    await prisma.user.update({
      where: { id: userId },
      data: userDataToUpdate
    });

    // 2. Atualiza Empresa (Se houver CNPJ)
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
          cadastroCompleto: true 
      };

      // Tratamento Certificado
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

      if (user?.empresaId !== empresaSalva.id) {
          const donoAtual = await prisma.user.findFirst({ where: { empresaId: empresaSalva.id } });
          if (donoAtual && donoAtual.id !== userId && !isAdmin) {
              return NextResponse.json({ error: 'CNPJ já pertence a outro usuário.' }, { status: 409 });
          }
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
                      principal: c.principal
                  }))
              });
              await syncCnaesGlobalmente(body.cnaes, empresaSalva.codigoIbge);
          }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}