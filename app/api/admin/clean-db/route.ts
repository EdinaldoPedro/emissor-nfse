import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const logs = [];

    // === 1. LIMPAR TABELA 'Cnae' (CNAEs das Empresas) ===
    const allCnaes = await prisma.cnae.findMany();
    const vistosCnae = new Set();
    const delCnae = [];

    for (const item of allCnaes) {
      // Chave única: Empresa + Código
      const chave = `${item.empresaId}-${item.codigo.replace(/\D/g, '')}`;
      if (vistosCnae.has(chave)) {
        delCnae.push(item.id);
      } else {
        vistosCnae.add(chave);
      }
    }
    
    if (delCnae.length > 0) {
      await prisma.cnae.deleteMany({ where: { id: { in: delCnae } } });
      logs.push(`✅ Cnae (Empresas): ${delCnae.length} duplicatas removidas.`);
    } else {
      logs.push(`👍 Cnae (Empresas): Nenhum duplicado.`);
    }

    // === 2. LIMPAR TABELA 'GlobalCnae' (Admin) ===
    const allGlobal = await prisma.globalCnae.findMany();
    const vistosGlobal = new Set();
    const delGlobal = [];

    for (const item of allGlobal) {
      // Chave única: Código
      const chave = item.codigo.replace(/\D/g, '');
      if (vistosGlobal.has(chave)) {
        delGlobal.push(item.id);
      } else {
        vistosGlobal.add(chave);
      }
    }

    if (delGlobal.length > 0) {
      await prisma.globalCnae.deleteMany({ where: { id: { in: delGlobal } } });
      logs.push(`✅ GlobalCnae: ${delGlobal.length} duplicatas removidas.`);
    } else {
      logs.push(`👍 GlobalCnae: Nenhum duplicado.`);
    }

    // === 3. LIMPAR TABELA 'TributacaoMunicipal' ===
    const allTrib = await prisma.tributacaoMunicipal.findMany();
    const vistosTrib = new Set();
    const delTrib = [];

    for (const item of allTrib) {
      // Chave única: CNAE + Cidade + Código Municipal
      const chave = `${item.cnae}-${item.codigoIbge}-${item.codigoTributacaoMunicipal}`;
      if (vistosTrib.has(chave)) {
        delTrib.push(item.id);
      } else {
        vistosTrib.add(chave);
      }
    }

    if (delTrib.length > 0) {
      await prisma.tributacaoMunicipal.deleteMany({ where: { id: { in: delTrib } } });
      logs.push(`✅ TributacaoMunicipal: ${delTrib.length} duplicatas removidas.`);
    } else {
      logs.push(`👍 TributacaoMunicipal: Nenhum duplicado.`);
    }

    return NextResponse.json({ success: true, logs });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao limpar banco.' }, { status: 500 });
  }
}