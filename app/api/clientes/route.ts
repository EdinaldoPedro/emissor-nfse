import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { upsertEmpresaAndLinkUser } from "../../services/empresaService";

const prisma = new PrismaClient();

// Função Auxiliar de Segurança e Contexto
async function getEmpresaContexto(userId: string, contextId: string | null) {
    // 1. Pega usuário padrão
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    // 2. Se não tem contexto, usa a empresa do próprio usuário
    if (!contextId || contextId === 'null' || contextId === 'undefined') return user.empresaId;

    // 3. Se tem contexto (Contador acessando), valida o vínculo
    const vinculo = await prisma.contadorVinculo.findUnique({
        where: { contadorId_empresaId: { contadorId: userId, empresaId: contextId } }
    });

    if (vinculo && vinculo.status === 'APROVADO') {
        return contextId; // Permissão concedida
    }

    return null; // Tentativa inválida
}

// GET: Lista de Clientes (CORRIGIDO)
export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const contextId = request.headers.get('x-empresa-id'); 

    if (!userId) return NextResponse.json([], { status: 200 });

    // 1. Descobre qual empresa está sendo gerenciada (A do usuário ou a do cliente do contador)
    const empresaIdAlvo = await getEmpresaContexto(userId, contextId);

    if (!empresaIdAlvo) {
        return NextResponse.json([]); 
    }

    // 2. Descobre quem é o DONO dessa empresa (Pois os clientes são vinculados ao User Dono)
    const donoEmpresa = await prisma.user.findFirst({
        where: { empresaId: empresaIdAlvo }
    });

    if (!donoEmpresa) {
        // Se a empresa não tem dono (erro de base), não tem como ter clientes vinculados ao user
        return NextResponse.json([]);
    }

    // 3. Busca clientes vinculados ao DONO da empresa alvo
    const vinculos = await prisma.userCliente.findMany({
      where: { userId: donoEmpresa.id }, // <--- AQUI ESTAVA O ERRO (Antes estava empresaId)
      include: { empresa: true }, 
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

// POST: Novo Cliente (CORRIGIDO)
export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const contextId = request.headers.get('x-empresa-id');
    const body = await request.json();

    if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

    // 1. Resolve Empresa Alvo (Contexto)
    const empresaIdAlvo = await getEmpresaContexto(userId, contextId);
    if (!empresaIdAlvo) return NextResponse.json({ error: 'Contexto inválido' }, { status: 403 });

    // 2. Cria/Atualiza a empresa do cliente (Tomador)
    // Nota: Essa função cria um vínculo com o `userId` que chamou (pode ser o contador)
    const tomador = await upsertEmpresaAndLinkUser(body.documento, userId, body);

    // 3. SE FOR CONTEXTO (Contador ou Admin logado como outro):
    // Precisamos garantir que o vínculo seja criado também para o DONO da empresa alvo.
    
    // Busca o dono da empresa alvo
    const donoEmpresa = await prisma.user.findFirst({ where: { empresaId: empresaIdAlvo }});
    
    if (donoEmpresa && donoEmpresa.id !== userId) {
         // Cria vínculo para o dono real (se já não existir)
         const existe = await prisma.userCliente.findUnique({
             where: { userId_empresaId: { userId: donoEmpresa.id, empresaId: tomador.id } }
         });
         
         if (!existe) {
             await prisma.userCliente.create({
                 data: { userId: donoEmpresa.id, empresaId: tomador.id, apelido: tomador.nomeFantasia }
             });
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
  const contextId = request.headers.get('x-empresa-id');
  const { searchParams } = new URL(request.url);
  const clienteId = searchParams.get('id'); // ID da empresa cliente (Tomador)

  if (!userId || !clienteId) return NextResponse.json({ error: 'Inválido' }, { status: 400 });

  const empresaIdAlvo = await getEmpresaContexto(userId, contextId);
  if (!empresaIdAlvo) return NextResponse.json({ error: 'Proibido' }, { status: 403 });

  const donoEmpresa = await prisma.user.findFirst({ where: { empresaId: empresaIdAlvo }});
  if (!donoEmpresa) return NextResponse.json({ error: 'Dono não encontrado' }, { status: 404 });

  // Remove o vínculo do DONO com o CLIENTE
  await prisma.userCliente.deleteMany({
    where: { 
        userId: donoEmpresa.id, 
        empresaId: clienteId 
    }
  });

  return NextResponse.json({ success: true });
}

// PUT: Atualizar Cliente
export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json();

    if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

    // Atualiza a tabela Empresa diretamente
    await prisma.empresa.update({
      where: { id: body.id }, 
      data: {
        razaoSocial: body.nome, // O form manda 'nome', o banco usa 'razaoSocial'
        email: body.email, 
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