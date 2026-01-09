import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
// --- CORREÇÃO DO IMPORT: Usando @/app/services ---
import { EmissorFactory } from '@/app/services/emissor/factories/EmissorFactory'; 

const prisma = new PrismaClient();

// Helper de Contexto
async function getEmpresaContexto(userId: string, contextId: string | null) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role);
    if (isStaff && contextId && contextId !== 'null' && contextId !== 'undefined') return contextId; 
    if (!contextId || contextId === 'null' || contextId === 'undefined') return user.empresaId;
    const vinculo = await prisma.contadorVinculo.findUnique({
        where: { contadorId_empresaId: { contadorId: userId, empresaId: contextId } }
    });
    return (vinculo && vinculo.status === 'APROVADO') ? contextId : null;
}

// === API POST (DISPATCHER) ===
export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id');
  const contextId = request.headers.get('x-empresa-id'); 
  let vendaIdLog = null;
  let empresaIdLog = null;

  try {
    const body = await request.json();
    const { clienteId, valor, descricao, codigoCnae, vendaId } = body;

    // 1. Validação de Acesso
    if (!userId) throw new Error("Usuário não identificado.");
    const empresaIdAlvo = await getEmpresaContexto(userId, contextId);
    if (!empresaIdAlvo) throw new Error("Acesso negado.");
    empresaIdLog = empresaIdAlvo;

    // 2. Coleta de Dados (Banco)
    const prestador = await prisma.empresa.findUnique({ where: { id: empresaIdAlvo } });
    const tomador = await prisma.empresa.findUnique({ where: { id: clienteId } });
    if (!prestador || !tomador) throw new Error("Empresas não encontradas.");

    // 3. Gestão da Venda (Cria ou Atualiza)
    let venda;
    if (vendaId) {
        venda = await prisma.venda.update({
            where: { id: vendaId },
            data: { valor: parseFloat(valor), descricao: descricao, status: "PROCESSANDO" }
        });
        await createLog({ level: 'INFO', action: 'EMISSAO_INICIADA', message: `Reiniciando emissão (Venda ${vendaId})`, empresaId: prestador.id, vendaId: venda.id });
    } else {
        venda = await prisma.venda.create({
            data: { empresaId: prestador.id, clienteId: tomador.id, valor: parseFloat(valor), descricao: descricao, status: "PROCESSANDO" }
        });
    }
    vendaIdLog = venda.id;

    // 4. Sequencial DPS
    const novoNumeroDPS = (prestador.ultimoDPS || 0) + 1;
    await prisma.empresa.update({ where: { id: prestador.id }, data: { ultimoDPS: novoNumeroDPS } });

    // 5. Dados Fiscais
    let cnaeFinal = codigoCnae ? String(codigoCnae).replace(/\D/g, '') : '';
    if (!cnaeFinal) {
        const cnaeBanco = await prisma.cnae.findFirst({ where: { empresaId: prestador.id, principal: true } });
        if (cnaeBanco) cnaeFinal = cnaeBanco.codigo.replace(/\D/g, '');
    }
    if (!cnaeFinal) throw new Error("CNAE obrigatório.");

    let codigoTribNacional = '010101';
    let itemLc = '01.01';
    const regraFiscal = await prisma.globalCnae.findUnique({ where: { codigo: cnaeFinal } });
    if (regraFiscal) {
        if(regraFiscal.codigoTributacaoNacional) codigoTribNacional = regraFiscal.codigoTributacaoNacional.replace(/\D/g, '');
        if(regraFiscal.itemLc) itemLc = regraFiscal.itemLc;
    }

    // 6. INVOCAÇÃO DA ESTRATÉGIA (FACTORY)
    const strategy = EmissorFactory.getStrategy(prestador);
    
    const resultado = await strategy.executar({
        prestador,
        tomador,
        venda,
        servico: {
            valor: parseFloat(valor),
            descricao,
            cnae: cnaeFinal,
            itemLc,
            codigoTribNacional
        },
        ambiente: prestador.ambiente as 'HOMOLOGACAO' | 'PRODUCAO',
        numeroDPS: novoNumeroDPS,
        serieDPS: prestador.serieDPS || '900'
    });

    // 7. Processamento do Resultado
    if (!resultado.sucesso) {
        await prisma.venda.update({ where: { id: venda.id }, data: { status: 'ERRO_EMISSAO' } });
        
        await createLog({
            level: 'ERRO', action: 'FALHA_EMISSAO',
            message: resultado.motivo || 'Erro desconhecido',
            empresaId: prestador.id,
            vendaId: venda.id,
            details: { xml: resultado.xmlGerado, erros: resultado.erros }
        });
        
        return NextResponse.json({ error: "Emissão falhou.", details: resultado.erros }, { status: 400 });
    }

    // Sucesso
    const nota = await prisma.notaFiscal.create({
        data: {
            vendaId: venda.id,
            empresaId: prestador.id,
            clienteId: tomador.id,
            numero: parseInt(resultado.notaGov!.numero) || 0,
            valor: parseFloat(valor),
            descricao: descricao,
            prestadorCnpj: prestador.documento.replace(/\D/g, ''),
            tomadorCnpj: tomador.documento.replace(/\D/g, ''),
            status: 'AUTORIZADA',
            chaveAcesso: resultado.notaGov!.chave,
            xmlBase64: resultado.notaGov!.xml,
            cnae: cnaeFinal,
            dataEmissao: new Date()
        }
    });

    await prisma.venda.update({ where: { id: venda.id }, data: { status: 'CONCLUIDA' } });

    await createLog({
        level: 'INFO', action: 'NOTA_AUTORIZADA',
        message: `Nota ${nota.numero} autorizada com sucesso!`,
        empresaId: prestador.id,
        vendaId: venda.id,
        details: { xmlGerado: resultado.xmlGerado }
    });

    return NextResponse.json({ success: true, nota }, { status: 201 });

  } catch (error: any) {
    if(vendaIdLog) try { await prisma.venda.update({ where: { id: vendaIdLog }, data: { status: 'ERRO_EMISSAO' } }); } catch(e){}
    
    await createLog({
        level: 'ERRO', action: 'ERRO_SISTEMA',
        message: error.message,
        empresaId: empresaIdLog || undefined,
        vendaId: vendaIdLog || undefined,
        details: { stack: error.stack }
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- API GET (LISTAGEM) ---
export async function GET(request: Request) {
    const userId = request.headers.get('x-user-id');
    const contextId = request.headers.get('x-empresa-id');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || 'all';
  
    if (!userId) return NextResponse.json({ error: 'Proibido' }, { status: 401 });
  
    try {
      const empresaIdAlvo = await getEmpresaContexto(userId, contextId);
      if (!empresaIdAlvo) return NextResponse.json({ data: [], meta: { total: 0, page: 1, totalPages: 1 } });
  
      const skip = (page - 1) * limit;
      const whereClause: any = {
          empresaId: empresaIdAlvo,
          ...(search && {
              OR: [
                  { cliente: { razaoSocial: { contains: search } } },
                  { cliente: { documento: { contains: search } } },
                  ...( !isNaN(Number(search)) ? [{ notas: { some: { numero: { equals: Number(search) } } } }] : [] )
              ]
          })
      };
      if (type === 'valid') whereClause.status = { in: ['CONCLUIDA', 'CANCELADA'] };
  
      const [vendas, total] = await prisma.$transaction([
          prisma.venda.findMany({
              where: whereClause, take: limit, skip: skip, orderBy: { createdAt: 'desc' },
              include: {
                  cliente: { select: { razaoSocial: true, documento: true } },
                  notas: { select: { id: true, numero: true, status: true, vendaId: true, valor: true, cnae: true, codigoServico: true } },
                  logs: { where: { level: 'ERRO' }, orderBy: { createdAt: 'desc' }, take: 1, select: { message: true, details: true } }
              }
          }),
          prisma.venda.count({ where: whereClause })
      ]);
  
      const dadosFinais = vendas.map(v => ({
          ...v,
          notas: v.notas.map(n => ({ ...n, itemLc: '---' })),
          motivoErro: v.status === 'ERRO_EMISSAO' && v.logs[0] ? v.logs[0].message : null
      }));
  
      return NextResponse.json({ data: dadosFinais, meta: { total, page, totalPages: Math.ceil(total / limit) } });
    } catch (error) { return NextResponse.json({ error: 'Erro ao buscar notas' }, { status: 500 }); }
}