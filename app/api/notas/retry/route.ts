import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  
  try {
    const { vendaId, dadosAtualizados } = await request.json();

    // 1. Busca a venda original para pegar os dados de contexto (Empresa/Cliente)
    const venda = await prisma.venda.findUnique({
        where: { id: vendaId },
        include: { empresa: true, cliente: true }
    });

    if (!venda) throw new Error("Venda não encontrada para reprocessamento.");

    // 2. Log de Auditoria
    await createLog({
        level: 'INFO',
        action: 'REENVIO_MANUAL',
        message: 'Solicitação de reenvio iniciada pelo painel administrativo.',
        empresaId: venda.empresaId,
        vendaId: venda.id
    });

    // 3. Atualiza os dados no banco antes de tentar emitir
    // Isso garante que se a emissão ler do banco, lerá os dados novos
    await prisma.venda.update({
        where: { id: vendaId },
        data: {
            descricao: dadosAtualizados.descricao || venda.descricao,
            valor: dadosAtualizados.valor ? parseFloat(String(dadosAtualizados.valor)) : venda.valor,
            status: 'PROCESSANDO'
        }
    });

    // 4. Define a URL Base Dinamicamente
    // Se estiver rodando localmente, tenta pegar o host da requisição original
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.URL_API_LOCAL || `${protocol}://${host}`;
    
    console.log(`[RETRY] Disparando para: ${baseUrl}/api/notas`);

    // 5. Chamada Interna para a API de Emissão
    const resEmissao = await fetch(`${baseUrl}/api/notas`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-user-id': userId || '', 
            'x-empresa-id': venda.empresaId 
        },
        body: JSON.stringify({
            vendaId: venda.id, // <--- CORREÇÃO CRUCIAL: Passa o ID para o controller saber que é atualização
            clienteId: venda.clienteId,
            valor: dadosAtualizados.valor || venda.valor,
            descricao: dadosAtualizados.descricao || venda.descricao,
            codigoCnae: dadosAtualizados.cnae // Mapeia o campo cnae do form para codigoCnae da API
        })
    });

    // 6. Tratamento da Resposta
    const resultado = await resEmissao.json();

    if (!resEmissao.ok) {
        // Se a emissão falhou, atualiza status para ERRO
        await prisma.venda.update({ where: { id: vendaId }, data: { status: 'ERRO_EMISSAO' } });
        return NextResponse.json(resultado, { status: resEmissao.status });
    }

    return NextResponse.json({ success: true, message: "Reenvio processado com sucesso!" });

  } catch (error: any) {
    console.error("[RETRY ERROR]", error);
    return NextResponse.json({ error: error.message || "Erro interno no reenvio." }, { status: 500 });
  }
}