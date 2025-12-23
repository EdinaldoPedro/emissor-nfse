import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Busca dados do usuário E AS ATIVIDADES (CNAEs)
export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        atividades: true // <--- O SEGREDO: Traz os CNAEs salvos junto
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const { senha, ...dadosSeguros } = user;
    return NextResponse.json(dadosSeguros);
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// PUT: Atualiza perfil e lista de CNAEs
export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();

    const usuarioAtualizado = await prisma.$transaction(async (tx) => {
      
      // 1. Atualiza dados básicos
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          documento: body.documento,
          razaoSocial: body.razaoSocial,
          nomeFantasia: body.nomeFantasia,
          inscricaoMunicipal: body.inscricaoMunicipal,
          regimeTributario: body.regimeTributario,
          cep: body.cep,
          logradouro: body.logradouro,
          numero: body.numero,
          complemento: body.complemento,
          bairro: body.bairro,
          cidade: body.cidade,
          uf: body.uf,
          codigoIbge: body.codigoIbge ? `${body.codigoIbge}` : null,
          // Atualiza dados pessoais se vierem
          nome: body.nome,
          cpf: body.cpf,
          telefone: body.telefone
        }
      });

      // 2. Atualiza a tabela de Atividades (CNAEs) se vier uma lista nova
      if (body.cnaes && Array.isArray(body.cnaes)) {
        // Remove os antigos
        await tx.cnae.deleteMany({
            where: { userId: userId }
        });

        // Insere os novos (se a lista não estiver vazia)
        if (body.cnaes.length > 0) {
            await tx.cnae.createMany({
                data: body.cnaes.map((c: any) => ({
                    codigo: `${c.codigo}`,
                    descricao: c.descricao,
                    principal: c.principal,
                    userId: userId
                }))
            });
        }
      }

      return user;
    });

    return NextResponse.json(usuarioAtualizado);

  } catch (error) {
    console.error("Erro ao atualizar:", error);
    return NextResponse.json({ error: 'Erro ao atualizar dados' }, { status: 500 });
  }
}