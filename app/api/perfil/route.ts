import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Pega dados do usuário + dados da empresa dele
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { empresa: { include: { atividades: true } } }
  });

  if (!user) return NextResponse.json({ error: 'User não encontrado' }, { status: 404 });

  // Achata os dados para o frontend (facilita para não quebrar a tela existente)
  const dados = {
    nome: user.nome,
    email: user.email,
    cpf: user.cpf,
    telefone: user.telefone,
    plano: user.plano,
    // Dados da Empresa (se houver)
    documento: user.empresa?.documento || '',
    razaoSocial: user.empresa?.razaoSocial || '',
    nomeFantasia: user.empresa?.nomeFantasia || '',
    inscricaoMunicipal: user.empresa?.inscricaoMunicipal || '',
    regimeTributario: user.empresa?.regimeTributario || 'MEI',
    cep: user.empresa?.cep || '',
    logradouro: user.empresa?.logradouro || '',
    numero: user.empresa?.numero || '',
    bairro: user.empresa?.bairro || '',
    cidade: user.empresa?.cidade || '',
    uf: user.empresa?.uf || '',
    codigoIbge: user.empresa?.codigoIbge || '',
    atividades: user.empresa?.atividades || []
  };

  return NextResponse.json(dados);
}

// PUT: Atualiza User e cria/atualiza Empresa
export async function PUT(request: Request) {
  const userId = request.headers.get('x-user-id');
  const body = await request.json();

  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  // 1. Atualiza dados pessoais
  await prisma.user.update({
    where: { id: userId },
    data: { nome: body.nome, cpf: body.cpf, telefone: body.telefone }
  });

  // 2. Se vier dados de empresa (CNPJ), atualiza/cria a empresa
  if (body.documento) {
    const cnpjLimpo = body.documento.replace(/\D/g, '');
    
    // Upsert na empresa
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
            codigoIbge: body.codigoIbge
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
            codigoIbge: body.codigoIbge
        }
    });

    // Conecta a empresa ao usuário (Dono)
    await prisma.user.update({
        where: { id: userId },
        data: { empresaId: empresa.id }
    });

    // Atualiza CNAEs (apaga antigos e cria novos para simplificar)
    if (body.cnaes && Array.isArray(body.cnaes)) {
        await prisma.cnae.deleteMany({ where: { empresaId: empresa.id } });
        if (body.cnaes.length > 0) {
            await prisma.cnae.createMany({
                data: body.cnaes.map((c: any) => ({
                    empresaId: empresa.id,
                    codigo: c.codigo,
                    descricao: c.descricao,
                    principal: c.principal
                }))
            });
        }
    }
  }

  return NextResponse.json({ success: true });
}