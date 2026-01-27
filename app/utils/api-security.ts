import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from './api-middleware';
import { checkIsStaff } from './permissions';

export async function validateRequest(request: Request) {
    // 1. Quem é você de verdade? (Baseado no Token Seguro)
    const authenticatedUser = await getAuthenticatedUser(request);
    
    if (!authenticatedUser) {
        return { user: null, errorResponse: NextResponse.json({ error: 'Token inválido ou expirado.' }, { status: 401 }) };
    }

    // 2. Quem você diz ser? (Enviado pelo Frontend)
    const requestedUserId = request.headers.get('x-user-id');

    // 3. Regra de Ouro:
    // Se você não é Staff, você SÓ pode acessar seus próprios dados.
    const isStaff = checkIsStaff(authenticatedUser.role);
    
    if (!isStaff && requestedUserId && requestedUserId !== authenticatedUser.id) {
        return { 
            user: null, 
            errorResponse: NextResponse.json({ 
                error: 'Violação de Acesso: Você não pode acessar dados de outro usuário.' 
            }, { status: 403 }) 
        };
    }

    // Se for Staff acessando outro usuário (Impersonate), usamos o ID solicitado.
    // Se for usuário comum, usamos o ID do token (ignora o header se ele tentar burlar).
    const targetId = isStaff && requestedUserId ? requestedUserId : authenticatedUser.id;

    return { user: authenticatedUser, targetId, errorResponse: null };
}