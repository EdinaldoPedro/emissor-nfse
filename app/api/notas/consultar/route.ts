import { NextResponse } from 'next/server';
import { EmissorFactory } from '@/app/services/emissor/factories/EmissorFactory';
import { createLog } from '@/app/services/logger';
import { forbidden, getAuthenticatedUser, unauthorized } from '@/app/utils/api-middleware';
import { hasEmpresaAccess } from '@/app/utils/access-control';
import { prisma } from '@/app/utils/prisma';

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();

  try {
    const { notaId } = await request.json();

    const nota = await prisma.notaFiscal.findUnique({
      where: { id: notaId },
      include: { empresa: true },
    });

    if (!nota || !nota.chaveAcesso) {
      return NextResponse.json({ error: 'Nota sem chave de acesso para consulta.' }, { status: 400 });
    }

    const hasAccess = await hasEmpresaAccess(user, nota.empresaId);
    if (!hasAccess) return forbidden();

    const strategy = EmissorFactory.getStrategy(nota.empresa);
    const resultado = await strategy.consultar(nota.chaveAcesso, nota.empresa);

    if (resultado.sucesso && resultado.situacao === 'AUTORIZADA') {
      const dadosAtualizacao: any = {
        status: 'AUTORIZADA',
        xmlBase64: resultado.xmlDistribuicao,
        pdfBase64: resultado.pdfBase64,
      };

      if (resultado.numeroNota) {
        dadosAtualizacao.numero = parseInt(resultado.numeroNota);
      }

      const notaAtualizada = await prisma.notaFiscal.update({
        where: { id: notaId },
        data: dadosAtualizacao,
      });

      await createLog({
        level: 'INFO',
        action: 'CONSULTA_SEFAZ',
        message: `Consulta realizada. Nota ${dadosAtualizacao.numero || nota.numero} atualizada.`,
        empresaId: nota.empresaId,
        details: { numeroRecuperado: resultado.numeroNota },
      });

      return NextResponse.json({
        success: true,
        nota: notaAtualizada,
        message: 'Nota consultada e atualizada com sucesso.',
      });
    }

    return NextResponse.json(
      { error: 'Consulta nÃ£o retornou autorizaÃ§Ã£o vÃ¡lida.', detalhes: resultado },
      { status: 400 },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
