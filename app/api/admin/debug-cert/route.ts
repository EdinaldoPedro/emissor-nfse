import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import https from 'https';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';
import { decrypt } from '@/app/utils/crypto'; // <--- IMPORTANTE: Importa a função de desbloqueio

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  if (!['MASTER', 'ADMIN', 'SUPORTE_TI'].includes(user.role)) return forbidden();
  
  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get('id');

  if (!empresaId) return NextResponse.json({ error: "ID da empresa necessário" }, { status: 400 });

  try {
    const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa || !empresa.certificadoA1) return NextResponse.json({ error: "Sem certificado" }, { status: 404 });

    const logs = [];
    
    // === DESCRIPTOGRAFIA PARA DEBUG ===
    // O sistema tenta abrir o cadeado. Se o dado for antigo (sem criptografia), ele lê normal.
    const pfxReal = decrypt(empresa.certificadoA1);
    const senhaReal = decrypt(empresa.senhaCertificado);

    logs.push(`Tamanho do arquivo (No Banco): ${empresa.certificadoA1.length} chars`);
    logs.push(`Tamanho do arquivo (Descriptografado): ${pfxReal?.length || 0} chars`);
    
    if (!pfxReal) {
        return NextResponse.json({ logs, status: 'EMPTY_CERT', error: "Certificado vazio após descriptografia" });
    }

    // Tenta criar Buffer com o valor REAL (Descriptografado)
    let pfxBuffer;
    try {
        pfxBuffer = Buffer.from(pfxReal, 'base64');
        logs.push("✅ Buffer criado com sucesso");
    } catch (e: any) {
        logs.push("❌ Erro ao criar Buffer: " + e.message);
        return NextResponse.json({ logs, status: 'BUFFER_ERROR' });
    }

    // TESTE 1: Tenta criar o Agent HTTPS (Simulação real do que o sistema faz)
    try {
        new https.Agent({
            pfx: pfxBuffer,
            // Usa a senha real (descriptografada) ou undefined se for nula
            passphrase: senhaReal || undefined 
        });
        logs.push("✅ HTTPS Agent criado com sucesso! (Senha e Arquivo OK)");
    } catch (e: any) {
        logs.push("❌ HTTPS Agent falhou: " + e.message);
        if (e.message.includes('mac verify failure')) {
            logs.push("⚠️ DIAGNÓSTICO: A SENHA ESTÁ INCORRETA.");
        }
        else if (e.message.includes('asn1') || e.message.includes('bad decrypt')) {
            logs.push("⚠️ DIAGNÓSTICO: O ARQUIVO ESTÁ CORROMPIDO OU A CRIPTOGRAFIA FALHOU.");
        }
        return NextResponse.json({ logs, status: 'CERT_ERROR' });
    }

    return NextResponse.json({ logs, status: 'OK' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}