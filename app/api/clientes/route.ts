import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { upsertEmpresaAndLinkUser } from "../../services/empresaService";

const prisma = new PrismaClient();

// GET: Lista de Clientes
async function getEmpresaContexto(userId: string, contextId: string | null) {
    // 1. Pega usuário padrão
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    // 2. Se não tem contexto, usa a empresa do próprio usuário
    if (!contextId || contextId === 'null') return user.empresaId;

    // 3. Se tem contexto (Contador acessando), valida o vínculo
    const vinculo = await prisma.contadorVinculo.findUnique({
        where: { contadorId_empresaId: { contadorId: userId, empresaId: contextId } }
    });

    if (vinculo && vinculo.status === 'APROVADO') {
        return contextId; // Permissão concedida
    }

    return null; // Tentativa inválida
}

// GET: Lista de Clientes (CONTEXTO AJUSTADO)
export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const contextId = request.headers.get('x-empresa-id'); // Header do contador

    if (!userId) return NextResponse.json([], { status: 200 });

    // Resolve qual empresa estamos consultando
    const empresaIdAlvo = await getEmpresaContexto(userId, contextId);

    if (!empresaIdAlvo) {
        return NextResponse.json([]); // Sem empresa ou sem permissão
    }

    // Busca clientes vinculados a ESSA empresa
    const vinculos = await prisma.userCliente.findMany({
      where: { empresaId: empresaIdAlvo }, // Filtrando pela empresa alvo!
      include: { empresa: true }, // Aqui 'empresa' é o cliente final (tomador)
      orderBy: { createdAt: 'desc' }
    });

    const clientes = vinculos.map(v => ({
      id: v.empresa.id, 
      vinculoId: v.id,
      nome: v.empresa.razaoSocial,
      email: v.empresa.email,
      documento: v.empresa.documento,
      cidade: v.empresa.cidade,
      uf: v.empresa.uf
    }));

    return NextResponse.json(clientes);
  } catch (error) {
    console.error(error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST: Novo Cliente (CONTEXTO AJUSTADO)
export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const contextId = request.headers.get('x-empresa-id');
    const body = await request.json();

    if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

    // Se estiver em modo contador, precisamos garantir que o vínculo seja criado
    // em nome da empresa do cliente, mas a função upsertEmpresaAndLinkUser
    // atualmente usa userId. Vamos precisar ajustar isso ou fazer manualmente aqui.
    
    // Simplificação: Se for contador, bloqueamos criação rápida ou ajustamos o service.
    // Vamos ajustar para vincular ao contexto.
    
    // Resolve empresa
    const empresaIdAlvo = await getEmpresaContexto(userId, contextId);
    if (!empresaIdAlvo) return NextResponse.json({ error: 'Contexto inválido' }, { status: 403 });

    // Cria a empresa do cliente final (Tomador)
    const tomador = await upsertEmpresaAndLinkUser(body.documento, userId, body);

    // IMPORTANTE: Se for modo contador, o vínculo UserCliente deve ser:
    // userId: (Dono da empresa Alvo) <-> empresaId: (Tomador)
    // Mas como UserCliente linka User->Empresa, e aqui estamos operando como empresa...
    // O sistema atual liga User->Empresa(Cliente).
    // Se o contador criar, ele vai criar um vínculo dele com o cliente do cliente?
    // Correção: UserCliente deve ser criado para o DONO da empresa alvo.
    
    if (contextId) {
        // Acha o dono da empresa que o contador está acessando
        const donoEmpresa = await prisma.user.findFirst({ where: { empresaId: empresaIdAlvo }});
        if (donoEmpresa) {
             // Cria vínculo para o dono real
             const existe = await prisma.userCliente.findUnique({
                 where: { userId_empresaId: { userId: donoEmpresa.id, empresaId: tomador.id } }
             });
             if (!existe) {
                 await prisma.userCliente.create({
                     data: { userId: donoEmpresa.id, empresaId: tomador.id, apelido: tomador.nomeFantasia }
                 });
             }
        }
    }

    return NextResponse.json(tomador, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao processar cadastro." }, { status: 500 });
  }
}
// DELETE: Remove Vínculo
export async function DELETE(request: Request) {
  const userId = request.headers.get('x-user-id');
  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get('id');

  if (!userId || !empresaId) return NextResponse.json({ error: 'Inválido' }, { status: 400 });

  await prisma.userCliente.deleteMany({
    where: { userId, empresaId }
  });

  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json();

    if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

    // Atualiza a tabela Empresa diretamente
    await prisma.empresa.update({
      where: { id: body.id }, // O ID da empresa que vem do formulário
      data: {
        // Mapeamos 'nome' (do formulário) para 'razaoSocial' (do banco)
        razaoSocial: body.nome, 
        
        // === O IMPORTANTE: SALVAR O EMAIL ===
        email: body.email, 
        
        // Atualiza endereço também
        cep: body.cep,
        logradouro: body.logradouro,
        numero: body.numero,
        bairro: body.bairro,
        cidade: body.cidade,
        uf: body.uf,
        codigoIbge: body.codigoIbge
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro na atualização:", error);
    return NextResponse.json({ error: "Erro ao atualizar dados." }, { status: 500 });
  }
}