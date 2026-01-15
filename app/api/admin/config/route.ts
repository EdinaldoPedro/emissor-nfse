import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthenticatedUser, forbidden, unauthorized } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

// GET: Busca configs
export async function GET(request: Request) {
  // Verificação de segurança
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  if (!['MASTER', 'ADMIN'].includes(user.role)) return forbidden();

  let config = await prisma.configuracaoSistema.findUnique({ where: { id: 'config' } });
  
  if (!config) {
    config = await prisma.configuracaoSistema.create({
      data: {
        id: 'config',
        modeloDpsJson: JSON.stringify({ versao: "1.00", ambiente: "homologacao", tags: [] }, null, 2)
      }
    });
  }
  return NextResponse.json(config);
}

// PUT: Salva configs
export async function PUT(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorized();
  if (!['MASTER', 'ADMIN'].includes(user.role)) return forbidden();

  const body = await request.json();

  try {
    // VALIDAÇÃO SEGURA: Só tenta parsear se houver conteúdo
    if (body.modeloDpsJson && body.modeloDpsJson.trim() !== '') {
        try {
            JSON.parse(body.modeloDpsJson);
        } catch (e) {
            return NextResponse.json({ error: 'O JSON do DPS contém erros de sintaxe.' }, { status: 400 });
        }
    }

    // Prepara dados para salvar
    const dataToUpdate: any = {
        ambiente: body.ambiente,
        versaoApi: body.versaoApi,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort ? parseInt(body.smtpPort) : 587,
        smtpUser: body.smtpUser,
        smtpSecure: body.smtpSecure === true,
        emailRemetente: body.emailRemetente
    };

    // Só atualiza senha se o usuário digitou algo
    if (body.smtpPass && body.smtpPass.trim() !== '') {
        dataToUpdate.smtpPass = body.smtpPass;
    }

    // Só atualiza o JSON se foi enviado
    if (body.modeloDpsJson) {
        dataToUpdate.modeloDpsJson = body.modeloDpsJson;
    }
    
    const updated = await prisma.configuracaoSistema.update({
      where: { id: 'config' },
      data: dataToUpdate
    });

    return NextResponse.json(updated);

  } catch (e: any) {
    console.error("Erro ao salvar config:", e);
    return NextResponse.json({ error: 'Erro interno ao salvar.' }, { status: 500 });
  }
}