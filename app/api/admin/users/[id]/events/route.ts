import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

// GET: Buscar a linha do tempo (eventos) do utilizador
export async function GET(request: Request, { params }: { params: { id: string } }) {
    const admin = await getAuthenticatedUser(request);
    if (!admin || !['MASTER', 'ADMIN'].includes(admin.role)) return forbidden();

    try {
        const eventos = await prisma.userEvent.findMany({
            where: { userId: params.id },
            orderBy: { createdAt: 'desc' } // Mostra do mais recente para o mais antigo
        });
        
        return NextResponse.json(eventos);
    } catch (error) {
        console.error("Erro ao buscar eventos CRM:", error);
        return NextResponse.json({ error: 'Erro ao buscar linha do tempo' }, { status: 500 });
    }
}

// POST: Criar um novo evento manualmente (Anotação de Venda/Suporte)
export async function POST(request: Request, { params }: { params: { id: string } }) {
    const admin = await getAuthenticatedUser(request);
    if (!admin || !['MASTER', 'ADMIN'].includes(admin.role)) return forbidden();

    try {
        const body = await request.json();
        // O tipo padrão será 'MANUAL' caso o vendedor não especifique
        const { titulo, descricao, tipo = 'MANUAL' } = body;

        if (!titulo) {
            return NextResponse.json({ error: 'O título é obrigatório.' }, { status: 400 });
        }

        const novoEvento = await prisma.userEvent.create({
            data: {
                userId: params.id,
                tipo: tipo,
                titulo: titulo,
                descricao: descricao
            }
        });

        return NextResponse.json(novoEvento, { status: 201 });
    } catch (error) {
        console.error("Erro ao registar anotação CRM:", error);
        return NextResponse.json({ error: 'Erro ao registar anotação' }, { status: 500 });
    }
}