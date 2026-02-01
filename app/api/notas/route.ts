import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';
import { EmissorFactory } from '@/app/services/emissor/factories/EmissorFactory'; 
import { getTributacaoPorCnae } from '@/app/utils/tributacao'; 
import { processarRetornoNota } from '@/app/services/notaProcessor';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/app/utils/api-middleware';
import { checkPlanLimits, incrementUsage } from '@/app/services/planService';
import { validateRequest } from "@/app/utils/api-security"; // Importar validateRequest

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

// === POST: EMISSÃO DE NOTA ===
export async function POST(request: Request) {
  // 1. Validação de Segurança
  const { targetId, errorResponse } = await validateRequest(request);
  if (errorResponse) return errorResponse;
  
  // Como o validateRequest retorna o targetId, precisamos pegar o user completo para checar roles/empresa
  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) return unauthorized();

  const planCheck = await checkPlanLimits(user.id, 'EMITIR');
  if (!planCheck.allowed) {
      return NextResponse.json({ 
          error: planCheck.reason,
          code: planCheck.status 
      }, { status: 403 });
  }

  const contextId = request.headers.get('x-empresa-id'); 
  let vendaIdLog = null;
  let empresaIdLog = null;

  try {
    const body = await request.json();
    const { clienteId, valor, descricao, codigoCnae, vendaId, aliquota, issRetido, retencoes, numeroDPS, serieDPS } = body;

    const empresaIdAlvo = await getEmpresaContexto(user, contextId);
    if (!empresaIdAlvo) return forbidden();
    empresaIdLog = empresaIdAlvo;

    // === CORREÇÃO AQUI: Busca Prestador em 'Empresa' e Tomador em 'Cliente' ===
    const prestador = await prisma.empresa.findUnique({ where: { id: empresaIdAlvo } });
    const tomador = await prisma.cliente.findUnique({ where: { id: clienteId } }); // <--- Mudou de empresa para cliente
    
    if (!prestador) throw new Error("Prestador (Sua Empresa) não encontrado.");
    if (!tomador) throw new Error("Tomador (Cliente) não encontrado.");

    // Atualiza ou Cria a Venda
    let venda;
    const valorFloat = parseFloat(valor);
    
    if (vendaId) {
        venda = await prisma.venda.update({
            where: { id: vendaId },
            data: { valor: valorFloat, descricao: descricao, status: "PROCESSANDO" }
        });
    } else {
        venda = await prisma.venda.create({
            data: { 
                empresaId: prestador.id, 
                clienteId: tomador.id, // Agora aponta para a tabela Cliente
                valor: valorFloat, 
                descricao: descricao, 
                status: "PROCESSANDO" 
            }
        });
    }
    vendaIdLog = venda.id;

    // === LÓGICA DE NUMERAÇÃO DPS ===
    let dpsFinal = 0;
    const serieFinal = serieDPS || prestador.serieDPS || '900';

    if (numeroDPS) {
        dpsFinal = parseInt(numeroDPS);
        if (dpsFinal > (prestador.ultimoDPS || 0)) {
            await prisma.empresa.update({ where: { id: prestador.id }, data: { ultimoDPS: dpsFinal } });
        }
    } else {
        dpsFinal = (prestador.ultimoDPS || 0) + 1;
        await prisma.empresa.update({ where: { id: prestador.id }, data: { ultimoDPS: dpsFinal } });
    }

    // === CNAE ===
    let cnaeFinal = codigoCnae ? String(codigoCnae).replace(/\D/g, '') : '';
    if (!cnaeFinal) {
        const cnaeBanco = await prisma.cnae.findFirst({ where: { empresaId: prestador.id, principal: true } });
        if (cnaeBanco) cnaeFinal = cnaeBanco.codigo.replace(/\D/g, '');
    }
    if (!cnaeFinal) throw new Error("CNAE é obrigatório para emissão.");

    let codigoTribNacional = '000000'; 
    let itemLc = '00.00';

    // Tenta obter dados fiscais
    const infoEstatica = getTributacaoPorCnae(cnaeFinal);
    if (infoEstatica) {
         itemLc = infoEstatica.itemLC;
         codigoTribNacional = infoEstatica.codigoTributacaoNacional.replace(/\D/g, '');
    }

    const regraGlobal = await prisma.globalCnae.findUnique({ where: { codigo: cnaeFinal } });
    if (regraGlobal) {
        if (regraGlobal.itemLc) itemLc = regraGlobal.itemLc;
        if (regraGlobal.codigoTributacaoNacional) codigoTribNacional = regraGlobal.codigoTributacaoNacional.replace(/\D/g, '');
    }

    // === ADAPTAÇÃO DO TOMADOR PARA O PADRÃO DA STRATEGY ===
    // A Strategy antiga espera 'razaoSocial', mas o Cliente novo tem 'nome'.
    // Fazemos um adaptador rápido aqui.
    const tomadorAdaptado = {
        ...tomador,
        razaoSocial: tomador.nome, // Mapeia nome para razaoSocial
        documento: tomador.documento || '', // Garante string
        // Exterior: Se não tiver IBGE, manda zerado ou trata na Strategy
        codigoIbge: tomador.codigoIbge || '9999999' 
    };

    const dadosParaEstrategia = {
        prestador,
        tomador: tomadorAdaptado,
        venda,
        servico: {
            valor: valorFloat,
            descricao,
            cnae: cnaeFinal,
            itemLc,
            codigoTribNacional,
            aliquota: aliquota ? parseFloat(aliquota) : 0, 
            issRetido: !!issRetido,
            retencoes: retencoes
        },
        ambiente: prestador.ambiente as 'HOMOLOGACAO' | 'PRODUCAO',
        numeroDPS: dpsFinal,
        serieDPS: serieFinal
    };

    const strategy = EmissorFactory.getStrategy(prestador);
    const resultado = await strategy.executar(dadosParaEstrategia);

    await createLog({
        level: 'INFO', action: 'EMISSAO_INICIADA',
        message: `Iniciando transmissão DPS ${dpsFinal} (Série ${serieFinal}).`,
        empresaId: prestador.id,
        vendaId: venda.id,
        details: { payloadOriginal: dadosParaEstrategia, xmlGerado: resultado.xmlGerado }
    });

    if (!resultado.sucesso) {
        await prisma.venda.update({ where: { id: venda.id }, data: { status: 'ERRO_EMISSAO' } });
        await createLog({ level: 'ERRO', action: 'FALHA_EMISSAO', message: resultado.motivo || 'Rejeição Sefaz', empresaId: prestador.id, vendaId: venda.id, details: resultado.erros });
        return NextResponse.json({ error: "Emissão falhou.", details: resultado.erros }, { status: 400 });
    }

    if(planCheck.historyId) await incrementUsage(planCheck.historyId);

    // === CRIAÇÃO DA NOTA ===
    const nota = await prisma.notaFiscal.create({
        data: {
            vendaId: venda.id,
            empresaId: prestador.id,
            clienteId: tomador.id, // Agora usa a relação correta
            numero: parseInt(resultado.notaGov!.numero) || 0,
            valor: valorFloat,
            descricao: descricao,
            prestadorCnpj: prestador.documento.replace(/\D/g, ''),
            tomadorCnpj: tomador.documento ? tomador.documento.replace(/\D/g, '') : 'EXTERIOR',
            status: 'AUTORIZADA',
            chaveAcesso: resultado.notaGov!.chave,
            protocolo: resultado.notaGov!.protocolo, 
            xmlBase64: resultado.notaGov!.xml,
            cnae: cnaeFinal,
            dataEmissao: new Date()
        }
    });

    await createLog({ level: 'INFO', action: 'NOTA_AUTORIZADA', message: `Nota ${nota.numero} autorizada!`, empresaId: prestador.id, vendaId: venda.id });
    
    // Processamento assíncrono (não espera)
    processarRetornoNota(nota.id, prestador.id, venda.id).catch(console.error);

    return NextResponse.json({ success: true, nota }, { status: 201 });

  } catch (error: any) {
    if(vendaIdLog) try { await prisma.venda.update({ where: { id: vendaIdLog }, data: { status: 'ERRO_EMISSAO' } }); } catch(e){}
    await createLog({ level: 'ERRO', action: 'ERRO_SISTEMA', message: error.message, empresaId: empresaIdLog || undefined, details: { stack: error.stack } });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// === GET: LISTAGEM DE NOTAS ===
export async function GET(request: Request) {
    const { targetId, errorResponse } = await validateRequest(request);
    if (errorResponse) return errorResponse;

    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) return unauthorized();

    const contextId = request.headers.get('x-empresa-id');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const typeFilter = searchParams.get('type') || 'all'; 
  
    try {
      const empresaIdAlvo = await getEmpresaContexto(user, contextId);
      if (!empresaIdAlvo) return NextResponse.json({ data: [], meta: { total: 0 } });
  
      const skip = (page - 1) * limit;
      
      const whereClause: any = {
          empresaId: empresaIdAlvo,
          ...(search && {
              OR: [
                  { cliente: { nome: { contains: search, mode: 'insensitive' } } }, // Alterado razaoSocial -> nome
                  { cliente: { documento: { contains: search } } },
                  ...( !isNaN(Number(search)) ? [{ notas: { some: { numero: { equals: Number(search) } } } }] : [] )
              ]
          })
      };

      if (typeFilter === 'valid') {
          whereClause.status = { in: ['CONCLUIDA', 'CANCELADA'] };
      }
  
      const [vendas, total] = await prisma.$transaction([
          prisma.venda.findMany({
              where: whereClause, take: limit, skip: skip, orderBy: { createdAt: 'desc' },
              include: {
                  // Alterado razaoSocial -> nome
                  cliente: { select: { nome: true, documento: true } },
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
            // Mapeia para o front não quebrar
            cliente: { 
                ...v.cliente, 
                razaoSocial: v.cliente.nome // Mantém compatibilidade com front antigo
            },
            notas: v.notas.map(n => ({ ...n, codigoTribNacional: codigoTribDisplay })),
            motivoErro: v.status === 'ERRO_EMISSAO' && v.logs[0] ? v.logs[0].message : null
          };
      });
  
      return NextResponse.json({ data: dadosFinais, meta: { total, page, totalPages: Math.ceil(total / limit) } });
    } catch (error) { return NextResponse.json({ error: 'Erro ao buscar notas' }, { status: 500 }); }
}