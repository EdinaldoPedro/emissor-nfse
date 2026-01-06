// ARQUIVO: app/api/admin/vendas/[id]/route.ts

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Buscar Detalhes (Mantido e melhorado)
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const venda = await prisma.venda.findUnique({
      where: { id: params.id },
      include: {
        empresa: true, // Prestador
        cliente: true, // Tomador
        notas: true,   // Se gerou nota
        logs: {        // Histórico completo
            orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!venda) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });

    // Tenta encontrar o JSON do DPS nos logs
    const logDps = venda.logs.find(l => l.action === 'DPS_GERADA');
    
    // Tenta encontrar XML de retorno (se houver nota ou log de erro com XML)
    // As vezes o retorno de erro vem no log
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

// PUT: Atualizar Dados da Venda (Correção)
export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const body = await request.json();
        
        // Atualiza apenas campos permitidos para correção
        const updated = await prisma.venda.update({
            where: { id: params.id },
            data: {
                valor: body.valor ? parseFloat(body.valor) : undefined,
                descricao: body.descricao,
                // Se precisar atualizar o CNAE, normalmente ele fica na Nota ou no Payload, 
                // mas podemos salvar no log de "Correção" se não houver campo direto na Venda.
                // Aqui assumimos que a descrição e valor são os principais.
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: 'Erro ao atualizar venda.' }, { status: 500 });
    }
}

// DELETE: Apagar Venda e Rastro (Zona de Perigo)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params;

        // 1. Verifica se tem nota autorizada (Evitar apagar nota fiscal válida sem cancelar antes)
        const temNotaAutorizada = await prisma.notaFiscal.findFirst({
            where: { vendaId: id, status: 'AUTORIZADA' }
        });

        if (temNotaAutorizada) {
            return NextResponse.json({ error: 'Não é possível excluir uma venda com Nota Autorizada. Cancele a nota primeiro.' }, { status: 403 });
        }

        // 2. Apaga Logs relacionados
        await prisma.systemLog.deleteMany({ where: { vendaId: id } });

        // 3. Apaga Notas (Rascunho/Erro/Cancelada)
        await prisma.notaFiscal.deleteMany({ where: { vendaId: id } });

        // 4. Apaga a Venda
        await prisma.venda.delete({ where: { id } });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Erro ao excluir venda.' }, { status: 500 });
    }
}