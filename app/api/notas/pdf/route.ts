import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { NfsePortalDownloader } from '@/app/services/pdf/NfsePortalDownloader';
import zlib from 'zlib';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const { notaId } = await request.json();
        
        // 1. Busca a nota e dados da empresa (certificado)
        const nota = await prisma.notaFiscal.findUnique({
            where: { id: notaId },
            include: { empresa: true }
        });

        if (!nota || !nota.chaveAcesso) {
            return NextResponse.json({ error: 'Nota inválida ou sem chave.' }, { status: 400 });
        }

        // --- CENÁRIO A: PDF JÁ EXISTE NO BANCO ---
        if (nota.pdfBase64) {
            console.log(`[CACHE] Retornando PDF do banco para nota ${nota.numero}`);
            const bufferBanco = Buffer.from(nota.pdfBase64, 'base64');
            
            // Verifica se é Gzip (Magic Number 1F 8B)
            const isGzip = bufferBanco[0] === 0x1f && bufferBanco[1] === 0x8b;
            const pdfFinal = isGzip ? zlib.gunzipSync(bufferBanco) : bufferBanco;

            // CORREÇÃO: 'as any' para o TypeScript aceitar o Buffer
            return new NextResponse(pdfFinal as any, {
                headers: { 'Content-Type': 'application/pdf' }
            });
        }

        // --- CENÁRIO B: PRECISA BAIXAR DO PORTAL (ROBÔ) ---
        console.log(`[ROBÔ] Baixando PDF Oficial na Sefaz. Chave: ${nota.chaveAcesso}`);
        
        const empresa = nota.empresa;
        if (!empresa.certificadoA1 || !empresa.senhaCertificado) {
            return NextResponse.json({ error: 'Empresa sem certificado digital configurado.' }, { status: 400 });
        }

        const downloader = new NfsePortalDownloader();
        
        // Chama o Robô Playwright
        const pdfBuffer = await downloader.downloadPdfOficial(
            nota.chaveAcesso,
            empresa.certificadoA1,
            empresa.senhaCertificado
        );

        // --- COMPACTAÇÃO E SALVAMENTO ---
        // Compacta com Gzip para economizar espaço no banco (reduz ~60%)
        const pdfGzip = zlib.gzipSync(pdfBuffer);
        const pdfBase64 = pdfGzip.toString('base64');

        // Salva no banco assincronamente (não bloqueia o retorno)
        await prisma.notaFiscal.update({
            where: { id: notaId },
            data: { pdfBase64: pdfBase64 }
        });

        console.log(`[ROBÔ] PDF Salvo e Compactado (${pdfBuffer.length} -> ${pdfGzip.length} bytes)`);

        // CORREÇÃO: 'as any' para o TypeScript aceitar o Buffer
        return new NextResponse(pdfBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="NFSe-${nota.numero}.pdf"`,
                'Content-Length': pdfBuffer.length.toString()
            }
        });

    } catch (error: any) {
        console.error("[ERRO PDF]", error.message);
        // Fallback: Se o robô falhar, retorna o erro 500
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}