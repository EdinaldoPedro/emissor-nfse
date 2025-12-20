// Configuração do Banco
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 1. USUÁRIO DO SAAS (Quem contrata seu sistema)
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  senhaHash String   // Nunca salvamos a senha pura!
  nome      String   
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Dados da Empresa Emissora
  cnpj            String?
  razaoSocial     String?
  nomeFantasia    String?
  inscricaoMunicipal String?
  
  // Certificado Digital (Vamos salvar o caminho ou base64 depois)
  certificadoA1   String? 
  senhaCertificado String?

  // Relacionamentos
  clientes      Cliente[]     // Um usuário tem vários clientes
  notasFiscais  NotaFiscal[]  // Um usuário emite várias notas
  assinatura    Assinatura?   // Controle de pagamento da mensalidade
}

// 2. CLIENTES DO SEU USUÁRIO (Os tomadores de serviço)
model Cliente {
  id        String   @id @default(uuid())
  nome      String
  documento String   // CPF ou CNPJ
  email     String?
  endereco  String?
  cidade    String?
  uf        String?
  
  // Chave estrangeira (Pertence a qual usuário do SaaS?)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  
  notas     NotaFiscal[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// 3. A NOTA FISCAL (O coração do sistema)
model NotaFiscal {
  id              String   @id @default(uuid())
  numero          Int?     // Número sequencial da nota (após emitida)
  valor           Decimal  @db.Decimal(10, 2)
  descricao       String
  
  // Status da Nota
  status          StatusNota @default(RASCUNHO)
  
  // Arquivos
  xmlUrl          String?  // Link para o XML gerado
  pdfUrl          String?  // Link para o PDF gerado
  
  // Relacionamentos
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  
  clienteId       String
  cliente         Cliente  @relation(fields: [clienteId], references: [id])
  
  dataEmissao     DateTime?
  createdAt       DateTime @default(now())
}

// 4. ASSINATURA (Para você cobrar seus clientes)
model Assinatura {
  id            String   @id @default(uuid())
  status        StatusAssinatura @default(ATIVA)
  plano         String   @default("MENSAL")
  validade      DateTime
  
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id])
}

// Enums (Opções fixas)
enum StatusNota {
  RASCUNHO
  PROCESSANDO
  AUTORIZADA
  ERRO
  CANCELADA
}

enum StatusAssinatura {
  ATIVA
  INADIMPLENTE
  CANCELADA
}