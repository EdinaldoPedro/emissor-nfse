import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const [users, empresas, notas] = await prisma.$transaction([
      prisma.user.count(),
      prisma.empresa.count(),
      prisma.notaFiscal.count()
    ]);

    return NextResponse.json({ users, empresas, notas });
  } catch (error) {
    return NextResponse.json({ users: 0, empresas: 0, notas: 0 });
  }
}