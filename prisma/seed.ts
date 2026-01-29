import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Semeando banco de dados (Modo Limpo)...')

  // 1. PLANO DE ENTRADA (TRIAL)
  // Esse é o único plano necessário no banco para o cadastro funcionar
  const trial = await prisma.plan.upsert({
    where: { slug: 'TRIAL' }, 
    update: {},
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
      privado: false
    },
  })
  console.log(`✅ Plano criado: ${trial.name}`)
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