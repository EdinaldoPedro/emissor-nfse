import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
import { EmissorFactory } from '@/app/services/emissor/factories/EmissorFactory';
import { processarCancelamentoNota } from '@/app/services/notaProcessor';
import { checkPlanLimits } from '@/app/services/planService'; // <--- IMPORTADO

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    // 1. Identificação do Usuário (Necessário para verificar plano)
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

    const { acao, vendaId, motivo } = await request.json();

    // === TRAVA DE SEGURANÇA (PLANO) ===
    // Se a ação for CANCELAR, exige plano ativo (Regra 'EMITIR' é rigorosa)
    if (acao === 'CANCELAR') {
        const planCheck = await checkPlanLimits(userId, 'EMITIR');
        if (!planCheck.allowed) {
            return NextResponse.json({ 
                error: `Ação bloqueada: ${planCheck.reason}`,
                code: planCheck.status
            }, { status: 403 });
        }
    }
    // ===================================

    const venda = await prisma.venda.findUnique({
      where: { id: vendaId },
      include: { notas: true, empresa: true }
    });

    if (!venda) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });

    // === CANCELAMENTO REAL (COM SINCRONIZAÇÃO INTELIGENTE) ===
    if (acao === 'CANCELAR') {
        const notaAtiva = venda.notas.find(n => n.status === 'AUTORIZADA' || n.status === 'CANCELADA');
        
        if (!notaAtiva || !notaAtiva.chaveAcesso) {
            return NextResponse.json({ error: 'Não há nota autorizada válida para processar.' }, { status: 400 });
        }

        const strategy = EmissorFactory.getStrategy(venda.empresa);
        let protocoloParaCancelar = notaAtiva.protocolo;

        // 1. CONSULTA PRÉVIA (Auto-Cura)
        const consulta = await strategy.consultar(notaAtiva.chaveAcesso, venda.empresa);

        if (consulta.sucesso && consulta.protocolo && !protocoloParaCancelar) {
            protocoloParaCancelar = consulta.protocolo;
            await prisma.notaFiscal.update({ where: { id: notaAtiva.id }, data: { protocolo: protocoloParaCancelar } });
        }

        if (consulta.sucesso && consulta.situacao === 'CANCELADA') {
            await prisma.notaFiscal.update({ where: { id: notaAtiva.id }, data: { status: 'CANCELADA' } });
            await prisma.venda.update({ where: { id: vendaId }, data: { status: 'CANCELADA' } });
            await processarCancelamentoNota(notaAtiva.id, venda.empresaId, venda.id);
            return NextResponse.json({ success: true, message: 'Nota sincronizada! Status atualizado para Cancelada.' });
        }

        if (!protocoloParaCancelar) {
            return NextResponse.json({ error: 'Erro: Protocolo não encontrado e status não é cancelado.' }, { status: 400 });
        }

        const justificativa = motivo || "Erro na emissão";
        const resultado = await strategy.cancelar(
            notaAtiva.chaveAcesso, 
            protocoloParaCancelar, 
            justificativa, 
            venda.empresa
        );

        if (!resultado.sucesso) {
             return NextResponse.json({ error: 'Erro Sefaz: ' + resultado.motivo }, { status: 400 });
        }

        await prisma.notaFiscal.update({ where: { id: notaAtiva.id }, data: { status: 'CANCELADA' } });
        await prisma.venda.update({ where: { id: vendaId }, data: { status: 'CANCELADA' } });
        await processarCancelamentoNota(notaAtiva.id, venda.empresaId, venda.id);

        return NextResponse.json({ success: true, message: 'Nota cancelada com sucesso.' });
    }

    if (acao === 'CORRIGIR') {
        await prisma.venda.update({ where: { id: vendaId }, data: { status: 'PENDENTE' } });
        return NextResponse.json({ success: true, message: 'Venda liberada.' });
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}