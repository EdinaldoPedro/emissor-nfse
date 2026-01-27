import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import JSZip from 'jszip';
import zlib from 'zlib';
import { checkPlanLimits } from '@/app/services/planService';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

    const planCheck = await checkPlanLimits(userId, 'VISUALIZAR');
    if (!planCheck.allowed) {
        return NextResponse.json({ error: 'Acesso bloqueado: ' + planCheck.reason }, { status: 403 });
    }

    try {
        const { ids, formato } = await request.json(); // formato: 'XML' | 'PDF' | 'AMBOS'

        if (!ids || ids.length === 0) return NextResponse.json({ error: 'Nenhuma nota selecionada.' }, { status: 400 });

        // Busca as notas no banco
        const notas = await prisma.notaFiscal.findMany({
            where: { id: { in: ids } },
            include: { cliente: true }
        });

        const zip = new JSZip();
        const folderName = `Notas_Exportacao_${new Date().toISOString().split('T')[0]}`;
        const folder = zip.folder(folderName);

        if (!folder) throw new Error("Erro ao criar pasta no zip");

        for (const nota of notas) {
            const safeName = nota.numero 
                ? `NFSe_${nota.numero}` 
                : `NFSe_ID_${nota.id.substring(0,6)}`;
            
            // --- XML ---
            if ((formato === 'XML' || formato === 'AMBOS') && nota.xmlBase64) {
                // Tenta decodificar se estiver em base64 puro ou gzipado (depende de como salvou)
                // Assumindo que no banco está o XML puro em base64 (padrão do seu sistema anterior)
                // Se estiver gzipado como no processamento, precisa de zlib.gunzipSync
                try {
                     // Verifica magic number do Gzip (1F 8B)
                     const buffer = Buffer.from(nota.xmlBase64, 'base64');
                     let xmlContent = '';
                     if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
                         xmlContent = zlib.gunzipSync(buffer).toString('utf-8');
                     } else {
                         xmlContent = buffer.toString('utf-8');
                     }
                     folder.file(`${safeName}.xml`, xmlContent);
                } catch (e) { console.error(`Erro XML nota ${nota.numero}`, e); }
            }

            // --- PDF ---
            if ((formato === 'PDF' || formato === 'AMBOS') && nota.pdfBase64) {
                try {
                    const buffer = Buffer.from(nota.pdfBase64, 'base64');
                    let pdfContent: Buffer;
                    // Verifica Gzip
                    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
                        pdfContent = zlib.gunzipSync(buffer);
                    } else {
                        pdfContent = buffer;
                    }
                    folder.file(`${safeName}.pdf`, pdfContent);
                } catch (e) { console.error(`Erro PDF nota ${nota.numero}`, e); }
            }
        }

        const zipContent = await zip.generateAsync({ type: 'base64' });

        return NextResponse.json({ 
            success: true, 
            fileBase64: zipContent,
            fileName: `${folderName}.zip`
        });

    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ error: 'Erro ao gerar arquivo: ' + e.message }, { status: 500 });
    }
}