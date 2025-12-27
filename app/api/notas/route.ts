import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';

const prisma = new PrismaClient();
const formatMoney = (val: any) => parseFloat(val).toFixed(2);
const cleanString = (str: string | null) => str ? str.replace(/\D/g, '') : '';

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id') || 'anonimo';
  let vendaIdLog = null;
  let empresaIdLog = null;

  try {
    const body = await request.json();
    const { clienteId, valor, descricao, codigoCnae, retencoes } = body;

    // 1. Prestador
    const userPrestador = await prisma.user.findUnique({
      where: { id: userId },
      include: { empresa: true }
    });
    const prestador = userPrestador?.empresa;
    if (!prestador) throw new Error("Usuário sem empresa.");
    empresaIdLog = prestador.id;

    // 2. Tomador
    const tomador = await prisma.empresa.findUnique({ where: { id: clienteId } });
    if (!tomador) throw new Error('Cliente não encontrado.');

    // 3. CRIAR VENDA (Status: PROCESSANDO)
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
        details: { cliente: tomador.razaoSocial, cnae: codigoCnae }
    });

    // 4. Validações
    if (!prestador.codigoIbge) throw new Error('Falta IBGE do prestador.');
    
    // 5. Tributação
    const cnaeLimpo = cleanString(codigoCnae);
    let itemLc = '01.01';
    let codigoTribNacional = '010101';

    const regraGlobal = await prisma.globalCnae.findUnique({ where: { codigo: cnaeLimpo } });
    if (regraGlobal?.codigoTributacaoNacional) {
        codigoTribNacional = regraGlobal.codigoTributacaoNacional;
        itemLc = regraGlobal.itemLc || itemLc;
    }

    // 6. Montagem DPS
    const dpsId = `DPS${Date.now()}`;
    const dpsPayload = {
      "id": dpsId,
      "dataEmissao": new Date().toISOString(),
      "prestador": { "cnpj": cleanString(prestador.documento) },
      "tomador": { "cnpj": cleanString(tomador.documento) },
      "servico": {
        "codigoCnae": cnaeLimpo,
        "codigoTributacaoNacional": codigoTribNacional,
        "itemListaServico": itemLc,
        "valores": { "valorServico": formatMoney(valor) }
      }
    };

    await createLog({
        level: 'INFO', action: 'EMISSAO_JSON_GERADO',
        message: 'DPS gerada.',
        empresaId: prestador.id,
        vendaId: venda.id,
        details: dpsPayload
    });

    // 7. Simulação Envio
    await new Promise(r => setTimeout(r, 1000));
    
    // 8. Criar Nota e Atualizar Venda
    const novaNota = await prisma.notaFiscal.create({
      data: {
        vendaId: venda.id, // VINCULO
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

    await prisma.venda.update({
        where: { id: venda.id },
        data: { status: 'CONCLUIDA' }
    });

    await createLog({
        level: 'INFO', action: 'EMISSAO_SUCESSO',
        message: `Nota ${novaNota.numero} autorizada!`,
        empresaId: prestador.id,
        vendaId: venda.id
    });

    return NextResponse.json({ success: true }, { status: 201 });

  } catch (error: any) {
    if (vendaIdLog) {
        await prisma.venda.update({
            where: { id: vendaIdLog },
            data: { status: 'ERRO_EMISSAO' }
        });
    }
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