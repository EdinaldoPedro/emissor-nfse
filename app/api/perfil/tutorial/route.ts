import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    const userId = request.headers.get('x-user-id');
    if(!userId) return NextResponse.json({error:'Auth'}, {status:401});
    
    const { step } = await request.json();
    
    await prisma.user.update({
        where: { id: userId },
        data: { tutorialStep: step }
    });
    
    return NextResponse.json({success: true});
}