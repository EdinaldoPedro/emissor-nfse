import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { acao, vendaId, motivo } = await request.json();

    const venda = await prisma.venda.findUnique({
      where: { id: vendaId },
      include: { notas: true }
    });

    if (!venda) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });

    // === AÇÃO: CANCELAR NOTA AUTORIZADA ===
    if (acao === 'CANCELAR') {
        const notaAtiva = venda.notas.find(n => n.status === 'AUTORIZADA');
        
        if (!notaAtiva) {
            return NextResponse.json({ error: 'Não há nota autorizada para cancelar nesta venda.' }, { status: 400 });
        }

        // 1. Atualiza Nota no Banco (Simulando o cancelamento na Sefaz)
        await prisma.notaFiscal.update({
            where: { id: notaAtiva.id },
            data: { status: 'CANCELADA' }
        });

        // 2. Atualiza Status da Venda
        await prisma.venda.update({
            where: { id: vendaId },
            data: { status: 'CANCELADA' }
        });

        // 3. Auditoria
        await createLog({
            level: 'ALERTA', action: 'NOTA_CANCELADA',
            message: `Nota ${notaAtiva.numero} cancelada via painel administrativo.`,
            empresaId: venda.empresaId,
            vendaId: vendaId,
            details: { motivo: motivo || 'Solicitação administrativa' }
        });

        return NextResponse.json({ success: true, message: 'Nota cancelada com sucesso.' });
    }

    // === AÇÃO: CORRIGIR (Resetar erro para tentar novamente) ===
    if (acao === 'CORRIGIR') {
        // Se a venda deu erro, voltamos ela para PENDENTE para permitir nova tentativa
        // ou análise sem a flag vermelha de erro.
        await prisma.venda.update({
            where: { id: vendaId },
            data: { status: 'PENDENTE' } 
        });

        await createLog({
            level: 'INFO', action: 'VENDA_RESETADA',
            message: `Status da venda reiniciado para correção manual.`,
            empresaId: venda.empresaId,
            vendaId: vendaId
        });

        return NextResponse.json({ success: true, message: 'Venda liberada para reprocessamento.' });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}