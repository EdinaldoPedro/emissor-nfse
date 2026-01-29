import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import https from 'https';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  if (!['MASTER', 'ADMIN', 'SUPORTE_TI'].includes(user.role)) return forbidden();
  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get('id');

  if (!empresaId) return NextResponse.json({ error: "ID da empresa necessário" });

  try {
    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa || !empresa.certificadoA1) return NextResponse.json({ error: "Sem certificado" });

    const logs = [];
    logs.push(`Tamanho do arquivo: ${empresa.certificadoA1.length} chars`);
    logs.push(`Senha salva (tamanho): ${empresa.senhaCertificado?.length || 0}`);
    
    // Tenta criar Buffer
    let pfxBuffer;
    try {
        pfxBuffer = Buffer.from(empresa.certificadoA1, 'base64');
        logs.push("✅ Buffer criado com sucesso");
    } catch (e: any) {
        logs.push("❌ Erro ao criar Buffer: " + e.message);
        return NextResponse.json({ logs, status: 'BUFFER_ERROR' });
    }

    // TESTE 1: Tenta criar o Agent HTTPS (Simulação real do que o sistema faz)
    try {
        new https.Agent({
            pfx: pfxBuffer,
            // CORREÇÃO: O '|| undefined' converte o 'null' do banco para 'undefined' que o TypeScript aceita
            passphrase: empresa.senhaCertificado || undefined
        });
        logs.push("✅ HTTPS Agent criado com sucesso! (Senha Correta)");
    } catch (e: any) {
        logs.push("❌ HTTPS Agent falhou: " + e.message);
        if (e.message.includes('mac verify failure')) {
            logs.push("⚠️ DIAGNÓSTICO: A SENHA ESTÁ INCORRETA.");
        }
        if (e.message.includes('asn1')) {
            logs.push("⚠️ DIAGNÓSTICO: O ARQUIVO ESTÁ CORROMPIDO.");
        }
        return NextResponse.json({ logs, status: 'CERT_ERROR' });
    }

    return NextResponse.json({ logs, status: 'OK' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}