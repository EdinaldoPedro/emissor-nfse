import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // DEFINIÇÃO DOS 5 PLANOS SOLICITADOS
    const planosDefinidos = [
      // 1. PERÍODO DE AVALIAÇÃO (TRIAL)
      { 
        name: 'Período de Avaliação', 
        slug: 'TRIAL', 
        description: 'Teste grátis por 7 dias', 
        priceMonthly: 0, 
        priceYearly: 0, 
        features: 'Validade de 7 dias,Máximo 3 Emissões,Suporte Básico', 
        active: true,
        maxNotasMensal: 3, // Limite de 3 notas
        diasTeste: 7,      // Expira em 7 dias
        privado: true      // Oculto da loja
      },
      
      // 2. PARCEIRO (CONTROLE INTERNO)
      { 
        name: 'Parceiro', 
        slug: 'PARCEIRO', 
        description: 'Acesso total irrestrito', 
        priceMonthly: 0, 
        priceYearly: 0, 
        features: 'Emissões Ilimitadas,Prioridade Total,API Liberada', 
        active: true,
        maxNotasMensal: 0, // 0 = Ilimitado
        diasTeste: 0,
        privado: true      // Oculto da loja (Só equipe interna atribui)
      },

      // 3. PLANO INICIAL (R$ 24,99)
      { 
        name: 'Plano Inicial', 
        slug: 'INICIAL', 
        description: 'Para quem está começando', 
        priceMonthly: 24.99, 
        priceYearly: 249.90, 
        features: 'Até 5 Emissões/mês,Suporte por Email,Certificado A1', 
        active: true,
        maxNotasMensal: 5, // Limite de 5 notas
        diasTeste: 0,
        privado: false     // Visível na loja
      },

      // 4. PLANO INTERMEDIÁRIO (R$ 45,99)
      { 
        name: 'Plano Intermediário', 
        slug: 'INTERMEDIARIO', 
        description: 'Para pequenos negócios em crescimento', 
        priceMonthly: 45.99, 
        priceYearly: 459.90, 
        features: 'Até 15 Emissões/mês,Suporte WhatsApp,Certificado A1', 
        active: true,
        maxNotasMensal: 15, // Limite de 15 notas
        diasTeste: 0,
        privado: false      // Visível na loja
      },

      // 5. PLANO LIVRE (ILIMITADO)
      { 
        name: 'Plano Livre', 
        slug: 'LIVRE', 
        description: 'Liberdade total para emitir', 
        priceMonthly: 89.90, // Preço sugerido para o ilimitado
        priceYearly: 899.00, 
        features: 'Emissões Ilimitadas,Suporte VIP,Múltiplos Usuários', 
        active: true,
        maxNotasMensal: 0, // 0 = Ilimitado
        diasTeste: 0,
        privado: false     // Visível na loja
      },
    ];

    // === SINCRONIZAÇÃO (UPSERT) ===
    // Percorre a lista e atualiza (se existir) ou cria (se não existir)
    for (const plano of planosDefinidos) {
      await prisma.plan.upsert({
        where: { slug: plano.slug },
        update: {
            name: plano.name,
            description: plano.description,
            priceMonthly: plano.priceMonthly,
            priceYearly: plano.priceYearly,
            features: plano.features,
            maxNotasMensal: plano.maxNotasMensal,
            diasTeste: plano.diasTeste,
            privado: plano.privado,
            active: plano.active
        },
        create: plano
      });
    }

    // Retorna a lista atualizada do banco ordenando por preço
    const plans = await prisma.plan.findMany({
      orderBy: { priceMonthly: 'asc' }
    });

    return NextResponse.json(plans);

  } catch (error) {
    console.error("Erro ao sincronizar planos:", error);
    return NextResponse.json({ error: 'Erro ao buscar planos' }, { status: 500 });
  }
}

// ... (Mantenha o resto do arquivo: POST, PUT, DELETE igual) ...
// Se não tiver o restante, me avise que mando completo.