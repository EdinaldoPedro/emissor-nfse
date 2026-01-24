import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const total = await prisma.plan.count();
    
    if (total === 0) {
      await prisma.plan.createMany({
        data: [
          // 1. PLANO DE TESTE (Padrão para novos)
          { 
            name: 'Teste Grátis', 
            slug: 'TRIAL', 
            description: 'Experimente por 7 dias', 
            priceMonthly: 0, 
            priceYearly: 0, 
            features: 'Até 3 Notas,Suporte Básico,7 Dias Grátis', 
            active: true,
            maxNotasMensal: 3, // Limite de 3 notas
            diasTeste: 7,      // Expira em 7 dias
            privado: true      // Não aparece para compra, só atribuição automática
          },
          // 2. PLANO PARCEIRO (Interno)
          { 
            name: 'Parceiro', 
            slug: 'PARCEIRO', 
            description: 'Acesso total para parceiros', 
            priceMonthly: 0, 
            priceYearly: 0, 
            features: 'Ilimitado,Suporte Prioritário,API Completa', 
            active: true,
            maxNotasMensal: 0, // Ilimitado
            privado: true      // Só ativado via banco/admin
          },
          // 3. PLANO PRO (Venda)
          { 
            name: 'Profissional', 
            slug: 'PRO', 
            description: 'Para MEIs e Pequenas Empresas', 
            priceMonthly: 49.90, 
            priceYearly: 499.00, 
            features: 'Notas Ilimitadas,Certificado A1,WhatsApp', 
            active: true, 
            recommended: true,
            maxNotasMensal: 0,
            privado: false 
          },
        ]
      });
    }

    // Retorna apenas planos públicos para a vitrine
    const plans = await prisma.plan.findMany({
      where: { active: true, privado: false },
      orderBy: { priceMonthly: 'asc' }
    });

    return NextResponse.json(plans);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar planos' }, { status: 500 });
  }
}