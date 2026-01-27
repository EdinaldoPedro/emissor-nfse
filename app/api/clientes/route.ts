import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { upsertEmpresaAndLinkUser } from "../../services/empresaService";
import { validateRequest } from '@/app/utils/api-security';

const prisma = new PrismaClient();

// Função Auxiliar de Segurança e Contexto
async function getEmpresaContexto(userId: string, contextId: string | null) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    if (!contextId || contextId === 'null' || contextId === 'undefined') return user.empresaId;

    const vinculo = await prisma.contadorVinculo.findUnique({
        where: { contadorId_empresaId: { contadorId: userId, empresaId: contextId } }
    });

    if (vinculo && vinculo.status === 'APROVADO') {
        return contextId; 
    }

    return null; 
}

// GET: Lista de Clientes (COM TODOS OS DADOS)
export async function GET(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
      if (errorResponse) return errorResponse;

  try {
  
    const userId = targetId;
    const contextId = request.headers.get('x-empresa-id'); 

    if (!userId) return NextResponse.json([], { status: 200 });

    const empresaIdAlvo = await getEmpresaContexto(userId, contextId);

    if (!empresaIdAlvo) return NextResponse.json([]); 

    const donoEmpresa = await prisma.user.findFirst({
        where: { empresaId: empresaIdAlvo }
    });

    if (!donoEmpresa) return NextResponse.json([]);

    const vinculos = await prisma.userCliente.findMany({
      where: { userId: donoEmpresa.id },
      include: { empresa: true }, 
      orderBy: { createdAt: 'desc' }
    });

    const clientes = vinculos.map(v => ({
      id: v.empresa.id, 
      vinculoId: v.id,
      nome: v.empresa.razaoSocial,
      // === CAMPOS RECUPERADOS ===
      nomeFantasia: v.empresa.nomeFantasia, 
      inscricaoMunicipal: v.empresa.inscricaoMunicipal,
      email: v.empresa.email,
      documento: v.empresa.documento,
      // === ENDEREÇO COMPLETO ===
      cep: v.empresa.cep,
      logradouro: v.empresa.logradouro,
      numero: v.empresa.numero,
      bairro: v.empresa.bairro,
      cidade: v.empresa.cidade,
      uf: v.empresa.uf,
      codigoIbge: v.empresa.codigoIbge
    }));

    return NextResponse.json(clientes);
  } catch (error) {
    console.error(error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST: Novo Cliente
export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const contextId = request.headers.get('x-empresa-id');
    const body = await request.json();

    if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

    const empresaIdAlvo = await getEmpresaContexto(userId, contextId);
    if (!empresaIdAlvo) return NextResponse.json({ error: 'Contexto inválido' }, { status: 403 });

    // O service já lida com CPF/CNPJ e dados manuais
    const tomador = await upsertEmpresaAndLinkUser(body.documento, userId, body);

    const donoEmpresa = await prisma.user.findFirst({ where: { empresaId: empresaIdAlvo }});
    
    if (donoEmpresa && donoEmpresa.id !== userId) {
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao processar cadastro." }, { status: 500 });
  }
}

// PUT: Atualizar Cliente (COM TODOS OS CAMPOS)
export async function PUT(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json();

    if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

    await prisma.empresa.update({
      where: { id: body.id }, 
      data: {
        razaoSocial: body.nome,
        // === CAMPOS DE VOLTA ===
        nomeFantasia: body.nomeFantasia,
        inscricaoMunicipal: body.inscricaoMunicipal,
        // ======================
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

// DELETE: Remove Vínculo
export async function DELETE(request: Request) {
  const userId = request.headers.get('x-user-id');
  const contextId = request.headers.get('x-empresa-id');
  const { searchParams } = new URL(request.url);
  const clienteId = searchParams.get('id');

  if (!userId || !clienteId) return NextResponse.json({ error: 'Inválido' }, { status: 400 });

  const empresaIdAlvo = await getEmpresaContexto(userId, contextId);
  if (!empresaIdAlvo) return NextResponse.json({ error: 'Proibido' }, { status: 403 });

  const donoEmpresa = await prisma.user.findFirst({ where: { empresaId: empresaIdAlvo }});
  if (!donoEmpresa) return NextResponse.json({ error: 'Dono não encontrado' }, { status: 404 });

  await prisma.userCliente.deleteMany({
    where: { 
        userId: donoEmpresa.id, 
        empresaId: clienteId 
    }
  });

  return NextResponse.json({ success: true });
}