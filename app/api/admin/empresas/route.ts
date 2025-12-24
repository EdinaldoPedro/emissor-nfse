import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Lista todas as empresas e seus donos
export async function GET() {
  const empresas = await prisma.empresa.findMany({
    include: {
      donoUser: { select: { nome: true, email: true } } // Traz quem é o dono
    },
    orderBy: { updatedAt: 'desc' }
  });
  return NextResponse.json(empresas);
}

// PUT: Edição "Cirúrgica" de dados da empresa
export async function PUT(request: Request) {
  const body = await request.json();
  
  try {
    const updated = await prisma.empresa.update({
      where: { id: body.id },
      data: {
        razaoSocial: body.razaoSocial,
        nomeFantasia: body.nomeFantasia,
        regimeTributario: body.regimeTributario,
        inscricaoMunicipal: body.inscricaoMunicipal,
        // Endereço
        cep: body.cep,
        cidade: body.cidade,
        uf: body.uf,
        codigoIbge: body.codigoIbge
      }
    });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao atualizar empresa.' }, { status: 500 });
  }
}