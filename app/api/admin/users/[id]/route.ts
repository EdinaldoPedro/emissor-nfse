import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

// GET: Buscar detalhes completos (incluindo empresas vinculadas se for contador)
export async function GET(request: Request, { params }: { params: { id: string } }) {
    const admin = await getAuthenticatedUser(request);
    if (!admin || !['MASTER', 'ADMIN'].includes(admin.role)) return forbidden();

    try {
        const user = await prisma.user.findUnique({
            where: { id: params.id },
            include: {
                empresa: true,
                // TRAZ A LISTA DE EMPRESAS VINCULADAS
                empresasContabeis: {
                    include: { empresa: true }
                }
            }
        });
        
        if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
        
        // @ts-ignore
        const { senha, ...safeUser } = user;
        return NextResponse.json(safeUser);
    } catch (error) {
        return NextResponse.json({ error: 'Erro ao buscar' }, { status: 500 });
    }
}

// PATCH: Atualizar dados específicos (Limite de Empresas, Cargo)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    const admin = await getAuthenticatedUser(request);
    if (!admin || !['MASTER', 'ADMIN'].includes(admin.role)) return forbidden();

    try {
        const body = await request.json();
        const { limiteEmpresas, role } = body;

        const data: any = {};
        if (role) data.role = role;
        // Atualiza o limite se enviado
        if (limiteEmpresas !== undefined) data.limiteEmpresas = parseInt(limiteEmpresas);

        const updated = await prisma.user.update({
            where: { id: params.id },
            data
        });

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: 'Erro ao atualizar' }, { status: 500 });
    }
}