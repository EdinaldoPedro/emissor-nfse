import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { upsertEmpresaAndLinkUser } from "../../services/empresaService";

const prisma = new PrismaClient();

// GET: Lista de Clientes
export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json([], { status: 200 });

    const vinculos = await prisma.userCliente.findMany({
      where: { userId: userId },
      include: { empresa: true },
      orderBy: { createdAt: 'desc' }
    });

    // Formata para o frontend
    const clientes = vinculos.map(v => ({
      id: v.empresa.id, // ID da empresa
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
    return NextResponse.json([], { status: 200 }); // Retorna array vazio em caso de erro para não quebrar o .map
  }
}

// POST: Novo Cliente
export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    const body = await request.json();

    if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

    // Usa o serviço para garantir unicidade da empresa
    const resultado = await upsertEmpresaAndLinkUser(body.documento, userId, body);

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar cliente:", error);
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