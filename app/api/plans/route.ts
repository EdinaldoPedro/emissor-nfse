import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const total = await prisma.plan.count();
    
    // Seed automático (mantém essa lógica para instalações limpas)
    if (total === 0) {
       // ... (código de criação que já fizemos) ...
    }

    // === CORREÇÃO AQUI ===
    // Removemos o "where: { privado: false }"
    // O Admin deve ver TODOS os planos para poder editar
    const plans = await prisma.plan.findMany({
      orderBy: { priceMonthly: 'asc' }
    });

    return NextResponse.json(plans);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar planos' }, { status: 500 });
  }
}

// ... (Resto do arquivo POST, PUT, DELETE mantém igual)