import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    const userAuth = await getAuthenticatedUser(request);
    if (!userAuth) return unauthorized();

    try {
        const { code } = await request.json();

        const user = await prisma.user.findUnique({ where: { id: userAuth.id } });
        if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

        // 1. Validações
        if (user.verificationCode !== code) {
            return NextResponse.json({ error: "Código incorreto." }, { status: 400 });
        }
        if (!user.verificationExpires || new Date() > user.verificationExpires) {
            return NextResponse.json({ error: "Código expirado. Solicite outro." }, { status: 400 });
        }
        if (!user.tempEmail) {
            return NextResponse.json({ error: "Nenhum e-mail pendente." }, { status: 400 });
        }

        // 2. Efetiva a Troca
        await prisma.user.update({
            where: { id: user.id },
            data: {
                email: user.tempEmail, // E-mail oficial atualizado
                tempEmail: null,
                verificationCode: null,
                verificationExpires: null
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}