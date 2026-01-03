import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET Ticket Detalhado
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: {
        solicitante: { 
            select: { nome: true, email: true, empresa: { select: { razaoSocial: true, documento: true } } } 
        },
        atendente: { select: { nome: true, id: true } },
        catalogItem: true, // <--- Importante: Traz as instruções
        mensagens: {
            include: { usuario: { select: { nome: true, role: true } } },
            orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    if (!ticket) return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 });
    
    return NextResponse.json(ticket);
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// PUT: Atualizar Status/Atendente
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  try {
      const updated = await prisma.ticket.update({
          where: { id: params.id },
          data: {
              ...body,
              updatedAt: new Date() // Força atualização de data para o cronômetro
          }
      });
      return NextResponse.json(updated);
  } catch (e) {
      return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
  }
}