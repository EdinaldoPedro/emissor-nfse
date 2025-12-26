import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET existente...
export async function GET() {
  const users = await prisma.user.findMany({
    include: { empresa: true },
    orderBy: { createdAt: 'desc' }
  });
  const safeUsers = users.map(u => { const { senha, ...rest } = u; return rest; });
  return NextResponse.json(safeUsers);
}

// NOVO: PUT para editar usuário
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    
    const dataToUpdate: any = {};
    if (body.role) dataToUpdate.role = body.role;
    if (body.plano) dataToUpdate.plano = body.plano;
    if (body.planoCiclo) dataToUpdate.planoCiclo = body.planoCiclo; // <--- ADICIONADO

    const updated = await prisma.user.update({
        where: { id: body.id },
        data: dataToUpdate
    });
    
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Erro ao atualizar user' }, { status: 500 });
  }
}