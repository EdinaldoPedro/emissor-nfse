import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  if (!['MASTER', 'ADMIN'].includes(user.role)) return forbidden();

  try {
    // 1. Pega todos os CNAEs do sistema
    const allCnaes = await prisma.cnae.findMany();
    
    const vistos = new Set();
    const paraDeletar = [];

    // 2. Identifica duplicatas
    for (const cnae of allCnaes) {
      // Cria uma chave única: ID da Empresa + Código do CNAE
      const chaveUnica = `${cnae.empresaId}-${cnae.codigo.replace(/\D/g, '')}`;

      if (vistos.has(chaveUnica)) {
        // Se já vimos essa chave, esse registro é duplicado. Marca para deletar.
        paraDeletar.push(cnae.id);
      } else {
        vistos.add(chaveUnica);
      }
    }

    // 3. Deleta as duplicatas
    if (paraDeletar.length > 0) {
      await prisma.cnae.deleteMany({
        where: {
          id: { in: paraDeletar }
        }
      });
    }

    return NextResponse.json({
      message: "Limpeza concluída",
      totalAnalisado: allCnaes.length,
      duplicatasRemovidas: paraDeletar.length
    });

  } catch (error) {
    return NextResponse.json({ error: 'Erro ao limpar' }, { status: 500 });
  }
}