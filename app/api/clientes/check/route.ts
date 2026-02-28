import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthenticatedUser, unauthorized } from "@/app/utils/api-middleware";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const docLimpo = body.documento?.replace(/\D/g, '');

    if (!docLimpo) return NextResponse.json(null, { status: 400 });

    // === NOVA LÓGICA: INTELIGÊNCIA COLETIVA GLOBAL ===
    // Em vez de buscar apenas nos vínculos da empresa, buscamos em todo o SaaS.
    // Pegamos sempre o cadastro que foi atualizado por último (o mais recente).
    const clienteGlobal = await prisma.cliente.findFirst({
      where: { documento: docLimpo },
      orderBy: { updatedAt: 'desc' }
    });

    if (clienteGlobal) {
        // Removemos o 'id' e datas para evitar que o frontend tente fazer um PUT indevido.
        // Assim, o frontend entende os dados como "novos" para esta empresa, 
        // preenche o formulário automaticamente, e a rota de salvar (POST) 
        // cuidará de atualizar o global e criar o vínculo corretamente.
        const { id, createdAt, updatedAt, ...dadosParaPreencher } = clienteGlobal as any;
        return NextResponse.json(dadosParaPreencher);
    }

    return NextResponse.json(null); // Retorna null se o CPF/CNPJ for inédito no SaaS
  } catch (error) {
    return NextResponse.json(null, { status: 500 });
  }
}