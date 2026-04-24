import { NextResponse } from 'next/server';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';
import { isAdminRole } from '@/app/utils/access-control';
import { prisma } from '@/app/utils/prisma';

async function ensureAdmin(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  if (!isAdminRole(user.role)) return forbidden();
  return null;
}

export async function GET(request: Request) {
  const authError = await ensureAdmin(request);
  if (authError) return authError;

  try {
    const cupons = await prisma.cupom.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { logs: true } },
        logs: {
          include: {
            user: {
              select: { nome: true, email: true },
            },
            fatura: {
              select: { id: true, status: true, valorTotal: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return NextResponse.json(cupons);
  } catch (error) {
    console.error('Erro ao buscar cupons:', error);
    return NextResponse.json({ error: 'Erro ao listar cupons' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await ensureAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      codigo,
      tipoDesconto,
      valorDesconto,
      aplicarEm,
      maxCiclos,
      limiteUsos,
      validade,
      parceiroNome,
      planosValidos,
      apenasPrimeiraCompra,
    } = body;

    const novoCupom = await prisma.cupom.create({
      data: {
        codigo: codigo.toUpperCase().trim(),
        tipoDesconto,
        valorDesconto: parseFloat(valorDesconto),
        aplicarEm,
        maxCiclos: maxCiclos ? parseInt(maxCiclos) : null,
        limiteUsos: limiteUsos ? parseInt(limiteUsos) : null,
        validade: validade ? new Date(validade) : null,
        parceiroNome,
        planosValidos,
        apenasPrimeiraCompra: apenasPrimeiraCompra || false,
      },
    });

    return NextResponse.json(novoCupom);
  } catch (error) {
    console.error('Erro ao criar cupom:', error);
    return NextResponse.json(
      { error: 'Erro ao criar cupom. Verifique se o cÃ³digo jÃ¡ existe.' },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const authError = await ensureAdmin(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do cupom nÃ£o fornecido' }, { status: 400 });
    }

    await prisma.cupom.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Cupom apagado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar cupom:', error);
    return NextResponse.json({ error: 'Erro ao apagar cupom' }, { status: 500 });
  }
}
