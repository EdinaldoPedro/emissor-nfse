import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
import { EmissorFactory } from '@/app/services/emissor/factories/EmissorFactory';
import { processarCancelamentoNota } from '@/app/services/notaProcessor';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { acao, vendaId, motivo } = await request.json();

    const venda = await prisma.venda.findUnique({
      where: { id: vendaId },
      include: { notas: true, empresa: true }
    });

    if (!venda) return NextResponse.json({ error: 'Venda não encontrada' }, { status: 404 });

    // === CANCELAMENTO REAL (COM SINCRONIZAÇÃO INTELIGENTE) ===
    if (acao === 'CANCELAR') {
        const notaAtiva = venda.notas.find(n => n.status === 'AUTORIZADA' || n.status === 'CANCELADA'); // Pega também se já estiver cancelada no banco mas arquivos desatualizados
        
        if (!notaAtiva || !notaAtiva.chaveAcesso) {
            return NextResponse.json({ error: 'Não há nota autorizada válida para processar.' }, { status: 400 });
        }

        const strategy = EmissorFactory.getStrategy(venda.empresa);
        let protocoloParaCancelar = notaAtiva.protocolo;

        // 1. CONSULTA PRÉVIA (Auto-Cura e Verificação de Status)
        // Isso resolve o problema de "Nota já cancelada na Sefaz mas não no sistema"
        console.log(`[GERENCIAR] Consultando status atual da nota na Sefaz...`);
        const consulta = await strategy.consultar(notaAtiva.chaveAcesso, venda.empresa);

        // Se recuperou protocolo, salva
        if (consulta.sucesso && consulta.protocolo && !protocoloParaCancelar) {
            protocoloParaCancelar = consulta.protocolo;
            await prisma.notaFiscal.update({ where: { id: notaAtiva.id }, data: { protocolo: protocoloParaCancelar } });
        }

        // SE JÁ ESTIVER CANCELADA NA SEFAZ -> APENAS ATUALIZA O BANCO E ARQUIVOS
        if (consulta.sucesso && consulta.situacao === 'CANCELADA') {
            console.log(`[GERENCIAR] Nota já consta como CANCELADA na Sefaz. Sincronizando...`);
            
            await prisma.notaFiscal.update({ where: { id: notaAtiva.id }, data: { status: 'CANCELADA' } });
            await prisma.venda.update({ where: { id: vendaId }, data: { status: 'CANCELADA' } });

            await createLog({
                level: 'INFO', action: 'NOTA_SINCRONIZADA',
                message: `Nota ${notaAtiva.numero} detectada como já cancelada na Sefaz. Status sincronizado.`,
                empresaId: venda.empresaId, vendaId: vendaId
            });

            // Dispara atualização de arquivos
            await processarCancelamentoNota(notaAtiva.id, venda.empresaId, venda.id);
            return NextResponse.json({ success: true, message: 'Nota sincronizada! Status atualizado para Cancelada.' });
        }

        // SE AINDA ESTIVER AUTORIZADA -> TENTA CANCELAR
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

        // Sucesso no Cancelamento
        await prisma.notaFiscal.update({ where: { id: notaAtiva.id }, data: { status: 'CANCELADA' } });
        await prisma.venda.update({ where: { id: vendaId }, data: { status: 'CANCELADA' } });

        await createLog({
            level: 'INFO', action: 'NOTA_CANCELADA',
            message: `Nota ${notaAtiva.numero} cancelada com sucesso.`,
            empresaId: venda.empresaId, vendaId: vendaId, details: { xmlEvento: resultado.xmlEvento }
        });

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