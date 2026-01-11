import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
import { EmissorFactory } from '@/app/services/emissor/factories/EmissorFactory';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { acao, vendaId, motivo } = await request.json();

    const venda = await prisma.venda.findUnique({
      where: { id: vendaId },
      include: { notas: true, empresa: true }
    });

    if (!venda) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });

    // === CANCELAMENTO REAL ===
    if (acao === 'CANCELAR') {
        const notaAtiva = venda.notas.find(n => n.status === 'AUTORIZADA');
        
        if (!notaAtiva || !notaAtiva.chaveAcesso) {
            return NextResponse.json({ error: 'Não há nota autorizada válida para cancelar.' }, { status: 400 });
        }

        const justificativa = motivo || "Erro na emissão";
        if (justificativa.length < 15) return NextResponse.json({ error: 'Justificativa deve ter no mínimo 15 caracteres.' }, { status: 400 });

        // 1. Chama a Estratégia para Cancelar na Sefaz
        const strategy = EmissorFactory.getStrategy(venda.empresa);
        const resultado = await strategy.cancelar(notaAtiva.chaveAcesso, justificativa, venda.empresa);

        if (!resultado.sucesso) {
             return NextResponse.json({ error: 'Erro ao cancelar na Sefaz: ' + resultado.motivo }, { status: 400 });
        }

        // 2. Sucesso na Sefaz -> Atualiza Banco
        await prisma.notaFiscal.update({ where: { id: notaAtiva.id }, data: { status: 'CANCELADA' } });
        await prisma.venda.update({ where: { id: vendaId }, data: { status: 'CANCELADA' } });

        await createLog({
            level: 'INFO', action: 'NOTA_CANCELADA',
            message: `Nota ${notaAtiva.numero} cancelada com sucesso na Sefaz.`,
            empresaId: venda.empresaId,
            vendaId: vendaId,
            details: { xmlEvento: resultado.xmlEvento }
        });

        return NextResponse.json({ success: true, message: 'Nota cancelada na Sefaz com sucesso.' });
    }

    // === CORREÇÃO (RESET) ===
    if (acao === 'CORRIGIR') {
        await prisma.venda.update({ where: { id: vendaId }, data: { status: 'PENDENTE' } });
        return NextResponse.json({ success: true, message: 'Venda liberada para reprocessamento.' });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}