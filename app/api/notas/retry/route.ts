import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger'; // Importando o logger explicitamente

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  
  try {
    const { vendaId, dadosAtualizados } = await request.json();

    const venda = await prisma.venda.findUnique({
        where: { id: vendaId },
        include: { empresa: true, cliente: true }
    });

    if (!venda) throw new Error("Venda não encontrada.");

    // --- NOVO: Grava log visual na timeline ---
    await createLog({
        level: 'INFO',
        action: 'REENVIO_MANUAL',
        message: 'Solicitação de reenvio iniciada pelo painel administrativo.',
        empresaId: venda.empresaId,
        vendaId: venda.id
    });

    // Atualiza dados
    await prisma.venda.update({
        where: { id: vendaId },
        data: {
            descricao: dadosAtualizados.descricao,
            valor: dadosAtualizados.valor ? parseFloat(String(dadosAtualizados.valor)) : venda.valor,
            status: 'PROCESSANDO'
        }
    });

    const baseUrl = process.env.URL_API_LOCAL || 'http://localhost:3000';
    
    // Chama a API de emissão
    const resEmissao = await fetch(`${baseUrl}/api/notas`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-user-id': userId || '', 
            'x-empresa-id': venda.empresaId 
        },
        body: JSON.stringify({
            clienteId: venda.clienteId,
            valor: dadosAtualizados.valor || venda.valor,
            descricao: dadosAtualizados.descricao || venda.descricao,
            codigoCnae: dadosAtualizados.cnae 
        })
    });

    const resultado = await resEmissao.json();

    if (!resEmissao.ok) {
        await prisma.venda.update({ where: { id: vendaId }, data: { status: 'ERRO_EMISSAO' } });
        return NextResponse.json(resultado, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Reenvio processado!" });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}