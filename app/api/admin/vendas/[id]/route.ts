import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const venda = await prisma.venda.findUnique({
      where: { id: params.id },
      include: {
        empresa: true, 
        cliente: true, 
        notas: true,   
        logs: {        
            orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!venda) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });

    // CORREÇÃO: Tenta encontrar o JSON do DPS nos logs usando o nome correto da ação
    const logDps = venda.logs.find(l => l.action === 'EMISSAO_INICIADA' || l.action === 'DPS_GERADA');
    
    const logErro = venda.logs.find(l => l.level === 'ERRO' && l.details?.includes('<'));

    return NextResponse.json({ 
        ...venda, 
        payloadJson: logDps ? logDps.details : null,
        xmlErro: logErro ? logErro.details : null
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const body = await request.json();
        const updated = await prisma.venda.update({
            where: { id: params.id },
            data: {
                valor: body.valor ? parseFloat(body.valor) : undefined,
                descricao: body.descricao,
            }
        });
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: 'Erro ao atualizar venda.' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        const temNotaAutorizada = await prisma.notaFiscal.findFirst({
            where: { vendaId: id, status: 'AUTORIZADA' }
        });

        if (temNotaAutorizada) {
            return NextResponse.json({ error: 'Não é possível excluir uma venda com Nota Autorizada. Cancele a nota primeiro.' }, { status: 403 });
        }

        await prisma.systemLog.deleteMany({ where: { vendaId: id } });
        await prisma.notaFiscal.deleteMany({ where: { vendaId: id } });
        await prisma.venda.delete({ where: { id } });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Erro ao excluir venda.' }, { status: 500 });
    }
}