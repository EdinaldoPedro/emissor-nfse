import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
import { EmissorFactory } from '@/app/services/emissor/factories/EmissorFactory'; 
import { getTributacaoPorCnae } from '@/app/utils/tributacao'; 
import { processarRetornoNota } from '@/app/services/notaProcessor';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/app/utils/api-middleware';

const prisma = new PrismaClient();

// === FUNÇÕES AUXILIARES ===
async function getEmpresaContexto(user: any, contextId: string | null) {
    const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role);
    if (contextId && contextId !== 'null' && contextId !== 'undefined') {
        const vinculo = await prisma.contadorVinculo.findUnique({
            where: { contadorId_empresaId: { contadorId: user.id, empresaId: contextId } }
        });
        if (vinculo && vinculo.status === 'APROVADO') return contextId;
        if (isStaff) return contextId; 
    }
    return user.empresaId;
}

function limparPayloadParaLog(payload: any) {
    const copia = JSON.parse(JSON.stringify(payload));
    if (copia.prestador) {
        copia.prestador.senhaCertificado = '*** PROTEGIDO ***';
        copia.prestador.certificadoA1 = '*** ARQUIVO PFX OMITIDO ***';
        copia.prestador.senha = '*** PROTEGIDO ***';
    }
    return copia;
}

async function resolveUser(request: Request) {
    let user = await getAuthenticatedUser(request);
    if (!user) return null;
    const headerUserId = request.headers.get('x-user-id');
    const isStaff = ['MASTER', 'ADMIN', 'SUPORTE', 'SUPORTE_TI'].includes(user.role);
    if (isStaff && headerUserId && headerUserId !== user.id) {
        const targetUser = await prisma.user.findUnique({ where: { id: headerUserId } });
        if (targetUser) return { ...targetUser, isImpersonating: true }; 
    }
    return user;
}

// === POST: EMISSÃO DE NOTA ===
export async function POST(request: Request) {
  const user = await resolveUser(request);
  if (!user) return unauthorized();

  const contextId = request.headers.get('x-empresa-id'); 
  let vendaIdLog = null;
  let empresaIdLog = null;

  try {
    const body = await request.json();
    // AQUI: Adicionamos 'aliquota' e 'issRetido' na desestruturação
    const { clienteId, valor, descricao, codigoCnae, vendaId, aliquota, issRetido } = body;

    const empresaIdAlvo = await getEmpresaContexto(user, contextId);
    if (!empresaIdAlvo) return forbidden();
    empresaIdLog = empresaIdAlvo;

    const prestador = await prisma.empresa.findUnique({ where: { id: empresaIdAlvo } });
    const tomador = await prisma.empresa.findUnique({ where: { id: clienteId } });
    if (!prestador || !tomador) throw new Error("Empresas (Prestador ou Tomador) não encontradas.");

    let venda;
    if (vendaId) {
        venda = await prisma.venda.update({
            where: { id: vendaId },
            data: { valor: parseFloat(valor), descricao: descricao, status: "PROCESSANDO" }
        });
    } else {
        venda = await prisma.venda.create({
            data: { empresaId: prestador.id, clienteId: tomador.id, valor: parseFloat(valor), descricao: descricao, status: "PROCESSANDO" }
        });
    }
    vendaIdLog = venda.id;

    const novoNumeroDPS = (prestador.ultimoDPS || 0) + 1;
    await prisma.empresa.update({ where: { id: prestador.id }, data: { ultimoDPS: novoNumeroDPS } });

    let cnaeFinal = codigoCnae ? String(codigoCnae).replace(/\D/g, '') : '';
    if (!cnaeFinal) {
        const cnaeBanco = await prisma.cnae.findFirst({ where: { empresaId: prestador.id, principal: true } });
        if (cnaeBanco) cnaeFinal = cnaeBanco.codigo.replace(/\D/g, '');
    }
    if (!cnaeFinal) throw new Error("CNAE é obrigatório para emissão.");

    // Lógica de Códigos Fiscais (De/Para)
    let codigoTribNacional = '000000'; 
    let itemLc = '00.00';

    const infoEstatica = getTributacaoPorCnae(cnaeFinal);
    if (infoEstatica && infoEstatica.codigoTributacaoNacional) {
         itemLc = infoEstatica.itemLC;
         codigoTribNacional = infoEstatica.codigoTributacaoNacional.replace(/\D/g, '');
    }

    const regraFiscal = await prisma.globalCnae.findUnique({ where: { codigo: cnaeFinal } });
    if (regraFiscal) {
        if (regraFiscal.itemLc) itemLc = regraFiscal.itemLc;
        if (regraFiscal.codigoTributacaoNacional && regraFiscal.codigoTributacaoNacional.trim() !== '') {
            codigoTribNacional = regraFiscal.codigoTributacaoNacional.replace(/\D/g, '');
        }
    }

    // Prepara dados para a Factory
    const dadosParaEstrategia = {
        prestador,
        tomador,
        venda,
        servico: {
            valor: parseFloat(valor),
            descricao,
            cnae: cnaeFinal,
            itemLc,
            codigoTribNacional,
            aliquota: aliquota ? parseFloat(aliquota) : 0, 
            issRetido: !!issRetido,
            retencoes: retencoes // <--- REPASSA O OBJETO
        },
        ambiente: prestador.ambiente as 'HOMOLOGACAO' | 'PRODUCAO',
        numeroDPS: novoNumeroDPS,
        serieDPS: prestador.serieDPS || '900'
    };

    const strategy = EmissorFactory.getStrategy(prestador);
    const resultado = await strategy.executar(dadosParaEstrategia);

    await createLog({
        level: 'INFO', action: 'EMISSAO_INICIADA',
        message: `Iniciando transmissão DPS ${novoNumeroDPS}.`,
        empresaId: prestador.id,
        vendaId: venda.id,
        details: { payload: limparPayloadParaLog(dadosParaEstrategia), xml: resultado.xmlGerado }
    });

    if (!resultado.sucesso) {
        await prisma.venda.update({ where: { id: venda.id }, data: { status: 'ERRO_EMISSAO' } });
        await createLog({ level: 'ERRO', action: 'FALHA_EMISSAO', message: resultado.motivo || 'Rejeição Sefaz', empresaId: prestador.id, vendaId: venda.id, details: resultado.erros });
        return NextResponse.json({ error: "Emissão falhou.", details: resultado.erros }, { status: 400 });
    }

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
            protocolo: resultado.notaGov!.protocolo, 
            xmlBase64: resultado.notaGov!.xml,
            cnae: cnaeFinal,
            dataEmissao: new Date()
        }
    });

    await createLog({ level: 'INFO', action: 'NOTA_AUTORIZADA', message: `Nota ${nota.numero} autorizada!`, empresaId: prestador.id, vendaId: venda.id });
    await processarRetornoNota(nota.id, prestador.id, venda.id);

    return NextResponse.json({ success: true, nota }, { status: 201 });

  } catch (error: any) {
    if(vendaIdLog) try { await prisma.venda.update({ where: { id: vendaIdLog }, data: { status: 'ERRO_EMISSAO' } }); } catch(e){}
    await createLog({ level: 'ERRO', action: 'ERRO_SISTEMA', message: error.message, empresaId: empresaIdLog || undefined, details: { stack: error.stack } });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// === GET: LISTAGEM ===
export async function GET(request: Request) {
    const user = await resolveUser(request);
    if (!user) return unauthorized();
    const contextId = request.headers.get('x-empresa-id');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
  
    try {
      const empresaIdAlvo = await getEmpresaContexto(user, contextId);
      if (!empresaIdAlvo) return NextResponse.json({ data: [], meta: { total: 0 } });
  
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
  
      const [vendas, total] = await prisma.$transaction([
          prisma.venda.findMany({
              where: whereClause, take: limit, skip: skip, orderBy: { createdAt: 'desc' },
              include: {
                  cliente: { select: { razaoSocial: true, documento: true } },
                  notas: { select: { id: true, numero: true, status: true, vendaId: true, valor: true, cnae: true, xmlBase64: true, pdfBase64: true } },
                  logs: { where: { level: 'ERRO' }, orderBy: { createdAt: 'desc' }, take: 1, select: { message: true } }
              }
          }),
          prisma.venda.count({ where: whereClause })
      ]);
  
      const dadosFinais = vendas.map(v => {
          let codigoTribDisplay = '---';
          if (v.notas.length > 0 && v.notas[0].cnae) {
             const info = getTributacaoPorCnae(v.notas[0].cnae);
             if (info && info.codigoTributacaoNacional) codigoTribDisplay = info.codigoTributacaoNacional;
          }
          return {
            ...v,
            notas: v.notas.map(n => ({ ...n, codigoTribNacional: codigoTribDisplay })),
            motivoErro: v.status === 'ERRO_EMISSAO' && v.logs[0] ? v.logs[0].message : null
          };
      });
  
      return NextResponse.json({ data: dadosFinais, meta: { total, page, totalPages: Math.ceil(total / limit) } });
    } catch (error) { return NextResponse.json({ error: 'Erro ao buscar notas' }, { status: 500 }); }
}