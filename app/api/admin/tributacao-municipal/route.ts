import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || ''; // <--- Novo parâmetro
  
  const skip = (page - 1) * limit;

  // Monta o filtro de busca (se houver texto)
  const whereClause = search ? {
    OR: [
        { cnae: { contains: search } },
        { codigoIbge: { contains: search } },
        { codigoTributacaoMunicipal: { contains: search } }
    ]
  } : {};

  try {
    const [lista, total] = await prisma.$transaction([
      prisma.tributacaoMunicipal.findMany({
        where: whereClause, // <--- Aplica o filtro
        skip: skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.tributacaoMunicipal.count({ where: whereClause }) // <--- Conta só os filtrados
    ]);

    return NextResponse.json({
      data: lista,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar dados.' }, { status: 500 });
  }
}

// POST: Cria Nova Regra
export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) return forbidden();
  try {
    const body = await request.json();

    // 1. Validação de Duplicidade (TRIPLA)
    // Verifica se JÁ EXISTE essa combinação exata de 3 campos
    const existe = await prisma.tributacaoMunicipal.findUnique({
      where: {
        cnae_codigoIbge_codigoTributacaoMunicipal: { // O Prisma cria esse nome composto automaticamente
            cnae: body.cnae,
            codigoIbge: body.codigoIbge,
            codigoTributacaoMunicipal: body.codigoTributacaoMunicipal
        }
      }
    });

    if (existe) {
      return NextResponse.json(
        { error: 'Esta regra exata (CNAE + Cidade + Cód. Municipal) já existe.' }, 
        { status: 409 } 
      );
    }

    // 2. Se não existe a trinca, cria (mesmo que CNAE e Cidade repitam)
    const novo = await prisma.tributacaoMunicipal.create({
      data: {
        cnae: body.cnae,
        codigoIbge: body.codigoIbge,
        codigoTributacaoMunicipal: body.codigoTributacaoMunicipal,
        descricaoServicoMunicipal: body.descricaoServicoMunicipal
      }
    });

    return NextResponse.json(novo, { status: 201 });

  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Erro ao processar requisição.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user || !['MASTER', 'ADMIN'].includes(user.role)) return forbidden();
  try {
    const body = await request.json();
    
    // Na edição, permitimos mudar o código municipal, mas precisamos garantir
    // que não vai bater com outra regra já existente
    if (body.codigoTributacaoMunicipal) {
        const conflito = await prisma.tributacaoMunicipal.findFirst({
            where: {
                cnae: body.cnae,
                codigoIbge: body.codigoIbge,
                codigoTributacaoMunicipal: body.codigoTributacaoMunicipal,
                NOT: { id: body.id } // Ignora o próprio registro que está sendo editado
            }
        });

        if (conflito) {
            return NextResponse.json({ error: 'Já existe outra regra com este Código Municipal.' }, { status: 409 });
        }
    }

    const atualizado = await prisma.tributacaoMunicipal.update({
        where: { id: body.id },
        data: {
            codigoTributacaoMunicipal: body.codigoTributacaoMunicipal,
            descricaoServicoMunicipal: body.descricaoServicoMunicipal
        }
    });
    return NextResponse.json(atualizado);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
    const user = await getAuthenticatedUser(request);
    if (!user || !['MASTER', 'ADMIN'].includes(user.role)) return forbidden();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if(id) {
        await prisma.tributacaoMunicipal.delete({ where: { id }});
        return NextResponse.json({success: true});
    }
    return NextResponse.json({error: "ID required"}, { status: 400 });
}