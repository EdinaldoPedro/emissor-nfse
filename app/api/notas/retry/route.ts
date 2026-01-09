import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

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

    const baseUrl = process.env.URL_API_LOCAL || 'http://localhost:3000';
    
    // Chama a API de emissão PASSANDO O vendaId para que ela saiba que é REENVIO
    const resEmissao = await fetch(`${baseUrl}/api/notas`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-user-id': userId || '', 
            'x-empresa-id': venda.empresaId 
        },
        body: JSON.stringify({
            vendaId: venda.id, // <--- CAMPO CHAVE PARA REUTILIZAR A VENDA
            clienteId: venda.clienteId,
            valor: dadosAtualizados.valor || venda.valor,
            descricao: dadosAtualizados.descricao || venda.descricao,
            codigoCnae: dadosAtualizados.cnae 
        })
    });

    const resultado = await resEmissao.json();

    if (!resEmissao.ok) {
        return NextResponse.json(resultado, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Reenvio processado!" });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}