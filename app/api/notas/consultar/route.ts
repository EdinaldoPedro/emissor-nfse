import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { EmissorFactory } from '@/app/services/emissor/factories/EmissorFactory';
import { createLog } from '@/app/services/logger';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const { notaId } = await request.json();
        
        // 1. Busca a nota no banco
        const nota = await prisma.notaFiscal.findUnique({
            where: { id: notaId },
            include: { empresa: true }
        });

        if (!nota || !nota.chaveAcesso) {
            return NextResponse.json({ error: 'Nota sem chave de acesso para consulta.' }, { status: 400 });
        }

        // 2. Instancia a estratégia
        const strategy = EmissorFactory.getStrategy(nota.empresa);

        // 3. Executa a consulta na Sefaz
        const resultado = await strategy.consultar(nota.chaveAcesso, nota.empresa);

        if (resultado.sucesso && resultado.situacao === 'AUTORIZADA') {
            
            const dadosAtualizacao: any = {
                status: 'AUTORIZADA',
                xmlBase64: resultado.xmlDistribuicao, // Salva o XML oficial
                pdfBase64: resultado.pdfBase64 // Se vier null, o front lida
            };

            // Se recuperou o número real (que estava 0), atualiza
            if (resultado.numeroNota) {
                dadosAtualizacao.numero = parseInt(resultado.numeroNota);
            }

            const notaAtualizada = await prisma.notaFiscal.update({
                where: { id: notaId },
                data: dadosAtualizacao
            });

            await createLog({
                level: 'INFO',
                action: 'CONSULTA_SEFAZ',
                message: `Consulta realizada. Nota ${dadosAtualizacao.numero || nota.numero} atualizada.`,
                empresaId: nota.empresaId,
                details: { numeroRecuperado: resultado.numeroNota }
            });

            return NextResponse.json({ 
                success: true, 
                nota: notaAtualizada,
                message: 'Nota consultada e atualizada com sucesso.' 
            });
        }

        return NextResponse.json({ error: 'Consulta não retornou autorização válida.', detalhes: resultado }, { status: 400 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}