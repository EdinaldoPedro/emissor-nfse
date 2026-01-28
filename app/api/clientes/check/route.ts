import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthenticatedUser, unauthorized } from "@/app/utils/api-middleware";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const docLimpo = body.documento.replace(/\D/g, '');

    if (!docLimpo) return NextResponse.json(null, { status: 400 });

    const empresa = await prisma.empresa.findUnique({
      where: { documento: docLimpo }
    });

    if (empresa) {
        return NextResponse.json({
            ...empresa,
            nome: empresa.razaoSocial
        });
    }

    return NextResponse.json(null, { status: 404 });
  } catch (error) {
    return NextResponse.json(null, { status: 500 });
  }
}