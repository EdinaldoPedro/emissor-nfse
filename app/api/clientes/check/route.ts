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

    // Busca na tabela Cliente (vinculada à empresa do usuário)
    // Precisamos descobrir a empresa do usuário primeiro
    let empresaId = user.empresaId;
    
    // Se não tiver empresaId no user, tenta achar via dono
    if (!empresaId) {
         const empresaDono = await prisma.empresa.findFirst({ where: { donoUser: { id: user.id } } });
         if (empresaDono) empresaId = empresaDono.id;
    }

    if (!empresaId) return NextResponse.json(null); // Sem empresa, sem cliente

    const cliente = await prisma.cliente.findFirst({
      where: { 
          empresaId: empresaId,
          documento: docLimpo 
      }
    });

    if (cliente) {
        return NextResponse.json(cliente);
    }

    return NextResponse.json(null); // Retorna null (200 OK) se não achar
  } catch (error) {
    return NextResponse.json(null, { status: 500 });
  }
}