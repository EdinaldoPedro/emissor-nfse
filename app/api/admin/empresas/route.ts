import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Lista todas
export async function GET() {
  try {
    const empresas = await prisma.empresa.findMany({
      include: { donoUser: { select: { nome: true, email: true } } },
      orderBy: { updatedAt: 'desc' }
    });
    return NextResponse.json(empresas);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar empresas' }, { status: 500 });
  }
}

// PUT: Atualiza dados (INCLUINDO AMBIENTE)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    
    const updated = await prisma.empresa.update({
      where: { id: body.id },
      data: {
        razaoSocial: body.razaoSocial,
        nomeFantasia: body.nomeFantasia,
        regimeTributario: body.regimeTributario,
        inscricaoMunicipal: body.inscricaoMunicipal,
        cep: body.cep,
        cidade: body.cidade,
        uf: body.uf,
        codigoIbge: body.codigoIbge,
        ambiente: body.ambiente // <--- GARANTA QUE ESTA LINHA EXISTA
      }
    });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao atualizar empresa.' }, { status: 500 });
  }
}