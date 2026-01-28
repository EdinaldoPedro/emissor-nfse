import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { validateRequest } from '@/app/utils/api-security';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    // SEGURANÇA
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    try {
        const body = await request.json();
        
        const pedido = await prisma.pedido.create({
            data: {
                userId: targetId, // Usa o ID validado do token
                planoSlug: body.planoSlug,
                ciclo: body.ciclo,
                notasAdicionais: body.notasAdicionais,
                valorPlano: 0, 
                valorAdicionais: 0, 
                valorTotal: body.valorTotal,
                formaPagamento: body.metodo,
                status: 'PENDENTE'
            }
        });

        return NextResponse.json(pedido);
    } catch (e: any) {
        return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 });
    }
}