import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const docLimpo = body.documento.replace(/\D/g, '');

    if (!docLimpo) return NextResponse.json(null, { status: 400 });

    // Busca na tabela Global de Empresas
    const empresa = await prisma.empresa.findUnique({
      where: { documento: docLimpo }
    });

    if (empresa) {
        return NextResponse.json({
            ...empresa,
            // Normaliza campos para o front-end
            nome: empresa.razaoSocial,
            cidade: empresa.cidade,
            uf: empresa.uf
        });
    }

    return NextResponse.json(null, { status: 404 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(null, { status: 500 });
  }
}