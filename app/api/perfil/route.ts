import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
// === ADICIONE O IMPORT QUE FALTAVA ===
import { syncCnaesGlobalmente } from '@/app/services/syncService'; 

const prisma = new PrismaClient();

// GET: Retorna o perfil completo
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { empresa: { include: { atividades: true } } }
  });

  if (!user) return NextResponse.json({ error: 'User não encontrado' }, { status: 404 });

  const empresa = user.empresa || {};
  const { email: emailEmpresa, ...dadosEmpresa } = empresa as any;

  const responseData = {
    ...dadosEmpresa,
    emailComercial: emailEmpresa,
    nome: user.nome,
    email: user.email,
    cpf: user.cpf,
    telefone: user.telefone,
    plano: {
      tipo: user.plano || 'Gratuito',
      status: user.planoStatus || 'active',
      expiresAt: user.planoExpiresAt
    },
    perfil: {
      cargo: user.cargo || '',
      empresa: empresa.razaoSocial || empresa.nomeFantasia || 'Sem Empresa',
      avatarUrl: user.avatarUrl || ''
    },
    configuracoes: {
      darkMode: user.darkMode,
      idioma: user.idioma,
      notificacoesEmail: user.notificacoesEmail
    },
    metadata: {
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      ipOrigem: user.ipOrigem
    },
    empresaDados: empresa
  };

  return NextResponse.json(responseData);
}

// PUT: Atualiza User e Empresa
export async function PUT(request: Request) {
  const userId = request.headers.get('x-user-id');
  const body = await request.json();

  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  try {
    // 1. Atualiza dados do USUÁRIO
    await prisma.user.update({
      where: { id: userId },
      data: {
        nome: body.nome,
        telefone: body.telefone,
        cargo: body.perfil?.cargo,
        avatarUrl: body.perfil?.avatarUrl,
        darkMode: body.configuracoes?.darkMode,
        idioma: body.configuracoes?.idioma,
        notificacoesEmail: body.configuracoes?.notificacoesEmail,
      }
    });

    // 2. Se vier dados de EMPRESA, atualiza
    if (body.documento) {
      const cnpjLimpo = body.documento.replace(/\D/g, '');
      
      const empresa = await prisma.empresa.upsert({
          where: { documento: cnpjLimpo },
          update: {
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
              email: body.emailComercial || body.email 
          },
          create: {
              documento: cnpjLimpo,
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
              email: body.emailComercial || body.email
          }
      });

      await prisma.user.update({
          where: { id: userId },
          data: { empresaId: empresa.id }
      });

      // Atualiza CNAEs e Sincroniza
      if (body.cnaes && Array.isArray(body.cnaes)) {
          await prisma.cnae.deleteMany({ where: { empresaId: empresa.id } });
          
          if (body.cnaes.length > 0) {
              await prisma.cnae.createMany({
                  data: body.cnaes.map((c: any) => ({
                      empresaId: empresa.id,
                      codigo: String(c.codigo).replace(/\D/g, ''),
                      descricao: c.descricao,
                      principal: c.principal
                  }))
              });

              // === SINCRONIZAÇÃO ===
              await syncCnaesGlobalmente(body.cnaes, empresa.codigoIbge);
          }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao atualizar perfil.' }, { status: 500 });
  }
}