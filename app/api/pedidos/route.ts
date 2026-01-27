import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if(!userId) return NextResponse.json({error:'Auth'}, {status:401});

        const body = await request.json();
        
        // Cria o registro PENDENTE
        const pedido = await prisma.pedido.create({
            data: {
                userId: userId,
                planoSlug: body.planoSlug,
                ciclo: body.ciclo,
                notasAdicionais: body.notasAdicionais,
                valorPlano: 0, // Simplificação: você pode buscar do banco se quiser precisão
                valorAdicionais: 0, 
                valorTotal: body.valorTotal,
                formaPagamento: body.metodo,
                status: 'PENDENTE'
            }
        });

        return NextResponse.json(pedido);

    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: 'Erro ao criar pedido' }, { status: 500 });
    }
}