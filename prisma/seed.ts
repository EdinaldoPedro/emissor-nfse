import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Semeando banco de dados...')

  // 1. PLANO DE ENTRADA (TRIAL - Público)
  const trial = await prisma.plan.upsert({
    where: { slug: 'TRIAL' }, 
    update: {}, // Não altera se já existir
    create: {
      name: 'Período de Teste',
      slug: 'TRIAL',
      description: '7 dias grátis para novos usuários',
      priceMonthly: 0,
      priceYearly: 0,
      features: 'Emissão de Notas, Cadastro de Clientes, Suporte Básico',
      maxNotasMensal: 10,
      diasTeste: 7,
      active: true,
      recommended: true,
      privado: false // <--- Aparece na tela de cadastro/planos
    },
  })
  console.log(`✅ Plano criado: ${trial.name}`)

  // 2. PLANO PARCEIRO (CONTADOR - Oculto/Privado)
  // Esse é fundamental para a lógica de "Promover a Contador" funcionar
  const parceiro = await prisma.plan.upsert({
    where: { slug: 'PARCEIRO' }, 
    update: {},
    create: {
      name: 'Parceiro Contábil',
      slug: 'PARCEIRO', // <--- A API busca exatamente essa string
      description: 'Acesso irrestrito para gestão de carteira',
      priceMonthly: 0,   // Gratuito para o parceiro
      priceYearly: 0,
      features: 'Painel do Contador, Múltiplas Empresas, Suporte Prioritário',
      maxNotasMensal: 9999, // Limite alto virtualmente infinito
      diasTeste: 0,
      active: true,
      recommended: false,
      privado: true // <--- IMPORTANTE: true para não aparecer na lista de compras
    },
  })
  console.log(`✅ Plano criado: ${parceiro.name}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })