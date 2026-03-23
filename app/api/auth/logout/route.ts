import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    // Apaga o cookie de autenticação definindo a expiração para o passado
    cookies().set({
        name: 'auth_token',
        value: '',
        httpOnly: true,
        path: '/',
        maxAge: 0 // <--- Isto faz o navegador apagar o cookie imediatamente
    });

    return NextResponse.json({ success: true, message: 'Sessão terminada' });
}