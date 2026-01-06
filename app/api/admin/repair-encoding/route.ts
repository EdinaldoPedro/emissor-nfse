import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 1. Limpa a tabela global corrompida
    await prisma.globalCnae.deleteMany({});
    
    const empresas = await prisma.empresa.findMany();
    const logs = [];
    const baseUrl = process.env.URL_API_LOCAL || 'http://localhost:3000';

    for (const emp of empresas) {
        // Rechama a API corrigida para cada empresa
        const res = await fetch(`${baseUrl}/api/external/cnpj`, {
            method: 'POST',
            body: JSON.stringify({ cnpj: emp.documento }),
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            const dados = await res.json();
            
            // Atualiza atividades da empresa
            await prisma.empresa.update({
                where: { id: emp.id },
                data: {
                    atividades: {
                        deleteMany: {},
                        create: dados.cnaes.map((c: any) => ({
                            codigo: c.codigo.replace(/\D/g, ''),
                            descricao: c.descricao, // Agora vem com acentos certos
                            principal: c.principal
                        }))
                    }
                }
            });

            // Repopula GlobalCnae
            for (const c of dados.cnaes) {
                const cod = c.codigo.replace(/\D/g, '');
                await prisma.globalCnae.upsert({
                    where: { codigo: cod },
                    update: { descricao: c.descricao },
                    create: { codigo: cod, descricao: c.descricao }
                });
            }
            logs.push(`✅ ${emp.razaoSocial}: Corrigido.`);
        } else {
            logs.push(`❌ ${emp.razaoSocial}: Falha na consulta.`);
        }
    }

    return NextResponse.json({ message: "Reparo concluído", logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}