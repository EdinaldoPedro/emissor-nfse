import { NextResponse } from 'next/server';
import { createLog } from '@/app/services/logger';
import { validateRequest } from '@/app/utils/api-security';
import { hasEmpresaAccess } from '@/app/utils/access-control';
import { prisma } from '@/app/utils/prisma';

export async function POST(request: Request) {
  const { user, targetId, errorResponse } = await validateRequest(request);
  if (errorResponse) return errorResponse;
  const userId = targetId;
  if (!userId || !user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  try {
    const { vendaId, dadosAtualizados } = await request.json();

    const venda = await prisma.venda.findUnique({
      where: { id: vendaId },
      include: { empresa: true, cliente: true },
    });

    if (!venda) throw new Error('Venda nÃ£o encontrada para reprocessamento.');

    const hasAccess = await hasEmpresaAccess(user, venda.empresaId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Acesso proibido' }, { status: 403 });
    }

    await createLog({
      level: 'INFO',
      action: 'REENVIO_MANUAL',
      message: 'SolicitaÃ§Ã£o de reenvio iniciada pelo painel administrativo.',
      empresaId: venda.empresaId,
      vendaId: venda.id,
    });

    await prisma.venda.update({
      where: { id: vendaId },
      data: {
        descricao: dadosAtualizados.descricao || venda.descricao,
        valor: dadosAtualizados.valor ? parseFloat(String(dadosAtualizados.valor)) : venda.valor,
        status: 'PROCESSANDO',
      },
    });

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.URL_API_LOCAL || `${protocol}://${host}`;

    const resEmissao = await fetch(`${baseUrl}/api/notas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') || '',
        'x-user-id': userId,
        'x-empresa-id': venda.empresaId,
      },
      body: JSON.stringify({
        vendaId: venda.id,
        clienteId: venda.clienteId,
        valor: dadosAtualizados.valor || venda.valor,
        descricao: dadosAtualizados.descricao || venda.descricao,
        codigoCnae: dadosAtualizados.cnae,
        numeroDPS: dadosAtualizados.numeroDPS,
        serieDPS: dadosAtualizados.serieDPS,
      }),
    });

    const resultado = await resEmissao.json();

    if (!resEmissao.ok) {
      await prisma.venda.update({ where: { id: vendaId }, data: { status: 'ERRO_EMISSAO' } });
      return NextResponse.json(resultado, { status: resEmissao.status });
    }

    return NextResponse.json({ success: true, message: 'Reenvio processado com sucesso!' });
  } catch (error: any) {
    console.error('[RETRY ERROR]', error);
    return NextResponse.json({ error: error.message || 'Erro interno no reenvio.' }, { status: 500 });
  }
}
