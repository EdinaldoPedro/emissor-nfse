import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function extractTag(xml: string, tag: string) {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`));
    return match ? match[1] : null;
}

function extractFullTag(xml: string, tag: string) {
    const match = xml.match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\/${tag}>`));
    return match ? match[0] : null;
}

export async function POST(request: Request) {
    try {
        const { vendaId } = await request.json();

        const venda = await prisma.venda.findUnique({
            where: { id: vendaId },
            include: { logs: { orderBy: { createdAt: 'desc' }, take: 10 } }
        });

        if (!venda) return NextResponse.json({ error: "Venda não encontrada" });

        let xml = '';
        const logComXml = venda.logs.find(l => 
            l.details && typeof l.details === 'string' && l.details.includes('<DPS')
        );

        if (logComXml) {
            if (logComXml.details.startsWith('{')) {
                try {
                    const json = JSON.parse(logComXml.details);
                    xml = json.xmlGerado || json.xml || '';
                } catch (e) { if (logComXml.details.includes('<DPS')) xml = logComXml.details; }
            } else {
                xml = logComXml.details;
            }
        }

        if (!xml) return NextResponse.json({ error: "XML não encontrado." });

        const signatureValueBase64 = extractTag(xml, 'SignatureValue');
        const x509Certificate = extractTag(xml, 'X509Certificate');
        const signedInfoBlock = extractFullTag(xml, 'SignedInfo');
        const infDpsBlock = extractFullTag(xml, 'infDPS');

        if (!signatureValueBase64 || !x509Certificate || !signedInfoBlock) {
            return NextResponse.json({ error: "Dados incompletos." });
        }

        const certPem = `-----BEGIN CERTIFICATE-----\n${x509Certificate}\n-----END CERTIFICATE-----`;
        const signatureBuffer = Buffer.from(signatureValueBase64, 'base64');

        // === SIMULAÇÃO DE INJEÇÃO VIRTUAL NO SIGNED INFO ===
        // O XML salvo não tem xmlns no SignedInfo, mas o cálculo da assinatura teve.
        // Precisamos injetar para validar.
        let signedInfoToVerify = signedInfoBlock;
        if (!signedInfoToVerify.includes('xmlns="http://www.w3.org/2000/09/xmldsig#"')) {
            signedInfoToVerify = signedInfoToVerify.replace('<SignedInfo>', '<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">');
        }

        const verify = crypto.createVerify('RSA-SHA1');
        verify.update(signedInfoToVerify);
        
        const isValid = verify.verify(certPem, signatureBuffer);

        // === DIAGNÓSTICO DO HASH DE CONTEÚDO ===
        let hashCalculado = '';
        if (infDpsBlock) {
            let nodeToHash = infDpsBlock;
            if (!nodeToHash.includes('xmlns="http://www.sped.fazenda.gov.br/nfse"')) {
                nodeToHash = nodeToHash.replace('<infDPS', '<infDPS xmlns="http://www.sped.fazenda.gov.br/nfse"');
            }
            const shasum = crypto.createHash('sha1');
            shasum.update(nodeToHash, 'utf8');
            hashCalculado = shasum.digest('base64');
        }
        
        const digestNoXml = extractTag(xml, 'DigestValue');

        return NextResponse.json({
            status: isValid ? 'SUCESSO_LOCAL' : 'FALHA_LOCAL',
            mensagem: isValid 
                ? "SUCESSO: Assinatura Válida com Injeção Virtual!" 
                : "FALHA: Assinatura inválida.",
            diagnostico: {
                hash_Calculado: hashCalculado,
                hash_Xml: digestNoXml,
                match_hash: hashCalculado === digestNoXml,
                algoritmo: 'RSA-SHA1'
            }
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}