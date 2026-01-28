import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    // 1. Usa o método seguro para pegar o usuário do Token
    const user = await getAuthenticatedUser(request);
    if(!user) return unauthorized();
    
    try {
        const { step } = await request.json();
        
        await prisma.user.update({
            where: { id: user.id }, // Usa o ID seguro do token
            data: { tutorialStep: step }
        });
        
        return NextResponse.json({success: true});
    } catch (error) {
        return NextResponse.json({ error: 'Erro ao atualizar tutorial' }, { status: 500 });
    }
}