import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Busca configs
export async function GET() {
  let config = await prisma.configuracaoSistema.findUnique({ where: { id: 'config' } });
  
  if (!config) {
    // Cria default se não existir
    config = await prisma.configuracaoSistema.create({
      data: {
        id: 'config',
        modeloDpsJson: JSON.stringify({ versao: "1.00", ambiente: "homologacao", tags: [] }, null, 2)
      }
    });
  }
  return NextResponse.json(config);
}

// PUT: Salva configs
export async function PUT(request: Request) {
  const body = await request.json();
  try {
    // Valida se é um JSON válido antes de salvar para não quebrar o sistema
    JSON.parse(body.modeloDpsJson); 
    
    const updated = await prisma.configuracaoSistema.update({
      where: { id: 'config' },
      data: {
        modeloDpsJson: body.modeloDpsJson,
        versaoApi: body.versaoApi,
        ambiente: body.ambiente
      }
    });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'JSON Inválido ou Erro no Banco' }, { status: 400 });
  }
}