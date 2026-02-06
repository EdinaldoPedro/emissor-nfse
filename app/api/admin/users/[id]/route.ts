import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

// GET: Buscar detalhes do usuário (Para o Admin ver e editar)
export async function GET(request: Request, { params }: { params: { id: string } }) {
    const admin = await getAuthenticatedUser(request);
    if (!admin) return unauthorized();
    if (!['MASTER', 'ADMIN'].includes(admin.role)) return forbidden();

    try {
        const userId = params.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                empresa: true, // Dados da empresa própria (se tiver)
                _count: {
                    select: {
                        empresasContabeis: true // Contagem de empresas vinculadas (se for contador)
                    }
                }
            }
        });

        if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

        return NextResponse.json(user);
    } catch (error) {
        console.error("Erro GET User:", error);
        return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 });
    }
}

// PATCH: Atualizar usuário (AQUI ENTRA O LIMITE DE EMPRESAS)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    const admin = await getAuthenticatedUser(request);
    if (!admin) return unauthorized();
    if (!['MASTER', 'ADMIN'].includes(admin.role)) return forbidden();

    try {
        const userId = params.id;
        const body = await request.json();
        
        // Extraímos os campos permitidos para edição
        const { nome, email, role, plano, limiteEmpresas } = body;

        const dataToUpdate: any = {};
        
        if (nome) dataToUpdate.nome = nome;
        if (email) dataToUpdate.email = email;
        if (role) dataToUpdate.role = role;
        if (plano) dataToUpdate.plano = plano;

        // === NOVO: Atualiza o limite de empresas ===
        if (limiteEmpresas !== undefined && limiteEmpresas !== null) {
            dataToUpdate.limiteEmpresas = parseInt(limiteEmpresas);
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: dataToUpdate
        });

        // Log de auditoria (Opcional, mas recomendado)
        await prisma.systemLog.create({
            data: {
                level: 'INFO',
                action: 'USER_UPDATE_ADMIN',
                message: `Usuário ${updatedUser.email} atualizado por ${admin.email}`,
                details: JSON.stringify(dataToUpdate)
            }
        });

        return NextResponse.json(updatedUser);

    } catch (error) {
        console.error("Erro PATCH User:", error);
        return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 });
    }
}

// DELETE: Remover usuário
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const admin = await getAuthenticatedUser(request);
    if (!admin) return unauthorized();
    if (!['MASTER', 'ADMIN'].includes(admin.role)) return forbidden();

    try {
        // Remove vínculos primeiro para evitar erro de FK (Cascade geralmente resolve, mas é bom garantir)
        await prisma.user.delete({ where: { id: params.id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erro DELETE User:", error);
        return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: 500 });
    }
}