import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const userId = request.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Acesso negado' }, { status: 401 });

  try {
    const venda = await prisma.venda.findUnique({
      where: { id: params.id },
      include: { 
          cliente: true,
          // Precisamos do CNAE usado, mas ele só é salvo na nota. 
          // Se falhou antes de criar a nota, usamos a lógica do cliente.
          // Aqui retornamos o básico para preencher o form.
          notas: true 
      }
    });

    if (!venda) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });

    // Verifica se pertence à empresa do usuário (segurança básica)
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { empresa: true }});
    if (venda.empresaId !== user?.empresa?.id) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }

    return NextResponse.json(venda);

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar venda' }, { status: 500 });
  }
}