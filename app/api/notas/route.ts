import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';

const prisma = new PrismaClient();
const formatMoney = (val: number) => val.toFixed(2);
const cleanString = (str: string | null) => str ? str.replace(/\D/g, '') : '';

// --- MÉTODO DE EMISSÃO (POST) ---
export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id') || 'anonimo';
  let vendaIdLog = null;
  let empresaIdLog = null;

  try {
    const body = await request.json();
    const { clienteId, valor, descricao, codigoCnae } = body;

    // 1. Identificar Prestador
    const userPrestador = await prisma.user.findUnique({
      where: { id: userId },
      include: { empresa: true }
    });
    const prestador = userPrestador?.empresa;

    if (!prestador) throw new Error("Usuário não possui empresa vinculada.");
    empresaIdLog = prestador.id;

    // 2. Identificar Tomador
    const tomador = await prisma.empresa.findUnique({ where: { id: clienteId } });
    if (!tomador) throw new Error('Cliente tomador não encontrado.');

    // 3. CRIAR A VENDA
    const venda = await prisma.venda.create({
        data: {
            empresaId: prestador.id,
            clienteId: tomador.id,
            valor: parseFloat(valor),
            descricao: descricao,
            status: "PROCESSANDO"
        }
    });
    vendaIdLog = venda.id;

    await createLog({
        level: 'INFO', action: 'VENDA_INICIADA',
        message: `Venda iniciada (R$ ${valor}).`,
        empresaId: prestador.id,
        vendaId: venda.id,
        details: { tomador: tomador.razaoSocial }
    });

    // 4. Regras Fiscais MEI
    if (!prestador.codigoIbge) throw new Error('Falta Código IBGE da sua empresa.');
    
    const isMEI = prestador.regimeTributario === 'MEI';
    const issRetido = false; 
    const aliquota = 0;      

    if (!isMEI && !prestador.inscricaoMunicipal) throw new Error('Empresas não-MEI precisam de Inscrição Municipal.');

    // 5. Inteligência Tributária
    const cnaeLimpo = cleanString(codigoCnae);
    let itemLc = '01.01';
    let codigoTribNacional = '010101'; 

    const regraMunicipal = await prisma.tributacaoMunicipal.findFirst({
        where: { cnae: cnaeLimpo, codigoIbge: prestador.codigoIbge }
    });

    if (regraMunicipal && regraMunicipal.codigoTributacaoMunicipal !== 'A_DEFINIR') {
        codigoTribNacional = regraMunicipal.codigoTributacaoMunicipal;
    } else {
        const regraGlobal = await prisma.globalCnae.findUnique({ where: { codigo: cnaeLimpo } });
        if (regraGlobal?.codigoTributacaoNacional) {
            codigoTribNacional = regraGlobal.codigoTributacaoNacional;
            itemLc = regraGlobal.itemLc || itemLc;
        }
    }

    // 6. Montagem DPS
    const dpsId = `DPS${Date.now()}`;
    const dpsPayload = {
      "id": dpsId,
      "dataEmissao": new Date().toISOString(),
      "prestador": { 
          "cnpj": cleanString(prestador.documento),
          "inscricaoMunicipal": cleanString(prestador.inscricaoMunicipal) || "",
          "regimeTributario": isMEI ? 4 : 1
      },
      "tomador": { 
          "cpfCnpj": cleanString(tomador.documento),
          "razaoSocial": tomador.razaoSocial 
      },
      "servico": {
        "codigoCnae": cnaeLimpo,
        "codigoTributacaoNacional": codigoTribNacional,
        "itemListaServico": itemLc,
        "discriminacao": descricao,
        "valores": { 
            "valorServico": formatMoney(parseFloat(valor)),
            "aliquota": aliquota,
            "issRetido": issRetido
        }
      }
    };

    await createLog({
        level: 'INFO', action: 'EMISSAO_JSON_GERADO',
        message: 'DPS montada.',
        empresaId: prestador.id,
        vendaId: venda.id,
        details: dpsPayload
    });

    // 7. Simulação Envio
    await new Promise(r => setTimeout(r, 1500));
    
    // 8. Salvar
    const novaNota = await prisma.notaFiscal.create({
      data: {
        vendaId: venda.id,
        empresaId: prestador.id,
        clienteId: tomador.id,
        numero: Math.floor(Math.random() * 10000),
        valor: parseFloat(valor),
        descricao: descricao,
        prestadorCnpj: cleanString(prestador.documento),
        tomadorCnpj: cleanString(tomador.documento),
        status: 'AUTORIZADA',
        chaveAcesso: `KEY${Date.now()}`,
        protocolo: `PROT${Date.now()}`,
        cnae: cnaeLimpo,
        codigoServico: codigoTribNacional,
        dataEmissao: new Date()
      }
    });

    await prisma.venda.update({ where: { id: venda.id }, data: { status: 'CONCLUIDA' } });

    await createLog({
        level: 'INFO', action: 'EMISSAO_SUCESSO',
        message: `Nota ${novaNota.numero} autorizada!`,
        empresaId: prestador.id,
        vendaId: venda.id
    });

    return NextResponse.json({ success: true, nota: novaNota }, { status: 201 });

  } catch (error: any) {
    if (vendaIdLog) await prisma.venda.update({ where: { id: vendaIdLog }, data: { status: 'ERRO_EMISSAO' } });
    
    await createLog({
        level: 'ERRO', action: 'EMISSAO_FALHA',
        message: error.message,
        empresaId: empresaIdLog || undefined,
        vendaId: vendaIdLog || undefined,
        details: error.stack
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- MÉTODO DE LISTAGEM (GET) ---
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id');
  const { searchParams } = new URL(request.url);
  
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';

  if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ 
        where: { id: userId },
        include: { empresa: true }
    });

    if (!user?.empresa) return NextResponse.json([], { status: 200 });

    const skip = (page - 1) * limit;

    const whereClause: any = {
        empresaId: user.empresa.id,
        ...(search && {
            OR: [
                { cliente: { razaoSocial: { contains: search, mode: 'insensitive' } } }, // Postgres (insensitive) ou SQLite (normal)
                { cliente: { documento: { contains: search } } },
                // Tenta buscar pelo número da nota se for número
                ...( !isNaN(Number(search)) ? [{ notas: { some: { numero: { equals: Number(search) } } } }] : [] )
            ]
        })
    };

    // 1. Busca Vendas
    const [vendas, total] = await prisma.$transaction([
        prisma.venda.findMany({
            where: whereClause,
            take: limit,
            skip: skip,
            orderBy: { createdAt: 'desc' },
            include: {
                cliente: { select: { razaoSocial: true, documento: true } },
                notas: { select: { id: true, numero: true, status: true, vendaId: true, valor: true, cnae: true, codigoServico: true } }
            }
        }),
        prisma.venda.count({ where: whereClause })
    ]);

    // 2. ENRIQUECER COM O ITEM LC (A Mágica acontece aqui)
    // Coleta todos os CNAEs únicos das notas listadas
    const cnaesEncontrados = Array.from(new Set(
        vendas.flatMap(v => v.notas.map(n => n.cnae)).filter(Boolean)
    ));

    // Busca os códigos "01.07", "08.02" na tabela GlobalCnae
    const infosCnae = await prisma.globalCnae.findMany({
        where: { codigo: { in: cnaesEncontrados as string[] } },
        select: { codigo: true, itemLc: true }
    });

    const mapaItemLc = new Map(infosCnae.map(i => [i.codigo, i.itemLc]));

    // 3. Monta o retorno com o campo 'itemLc' preenchido
    const dadosFinais = vendas.map(v => {
        const nota = v.notas[0];
        let itemLcDisplay = '---';

        if (nota && nota.cnae) {
            // Tenta pegar do mapa (Tabela Global)
            const doBanco = mapaItemLc.get(nota.cnae);
            if (doBanco) itemLcDisplay = doBanco;
            // Se não tiver na tabela Global, tenta "adivinhar" pelo código longo (Ex: 010701 -> 01.07)
            else if (nota.codigoServico && nota.codigoServico.length >= 4) {
               itemLcDisplay = `${nota.codigoServico.substring(0,2)}.${nota.codigoServico.substring(2,4)}`;
            }
        }

        return {
            ...v,
            notas: v.notas.map(n => ({ ...n, itemLc: itemLcDisplay }))
        };
    });

    return NextResponse.json({
        data: dadosFinais,
        meta: { total, page, totalPages: Math.ceil(total / limit) }
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erro ao buscar notas' }, { status: 500 });
  }
}