import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';

const prisma = new PrismaClient();
const formatMoney = (val: any) => parseFloat(val).toFixed(2);
const cleanString = (str: string | null) => str ? str.replace(/\D/g, '') : '';

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id') || 'anonimo';
  let empresaIdLog = null;
  let vendaIdLog = null;

  try {
    const body = await request.json();
    const { clienteId, valor, descricao, codigoCnae, retencoes } = body;

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

    // === 3. CRIAR A VENDA (O Registro da Operação) ===
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

    // LOG INICIAL VINCULADO À VENDA
    await createLog({
        level: 'INFO',
        action: 'VENDA_INICIADA',
        message: `Venda iniciada. Preparando emissão...`,
        empresaId: prestador.id,
        vendaId: venda.id,
        details: { cliente: tomador.razaoSocial, valor, cnae: codigoCnae }
    });

    // 4. Validações e Inteligência Tributária
    if (!prestador.codigoIbge) throw new Error('Falta Código IBGE da sua empresa.');
    
    // ... (Lógica de Tributação idêntica à anterior) ...
    const cnaeLimpo = cleanString(codigoCnae);
    let itemLc = '01.01';
    let codigoTribNacional = '010101'; // Default

    // Tenta achar regra municipal
    const regraMunicipal = await prisma.tributacaoMunicipal.findFirst({
        where: { cnae: cnaeLimpo, codigoIbge: prestador.codigoIbge }
    });
    if (regraMunicipal && regraMunicipal.codigoTributacaoMunicipal !== 'A_DEFINIR') {
        codigoTribNacional = regraMunicipal.codigoTributacaoMunicipal;
    } else {
        // Tenta regra global
        const regraGlobal = await prisma.globalCnae.findUnique({ where: { codigo: cnaeLimpo } });
        if (regraGlobal?.codigoTributacaoNacional) {
            codigoTribNacional = regraGlobal.codigoTributacaoNacional;
            itemLc = regraGlobal.itemLc || itemLc;
        }
    }

    // 5. Montagem DPS
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
        level: 'INFO',
        action: 'EMISSAO_JSON_GERADO',
        message: 'DPS montada.',
        empresaId: prestador.id,
        vendaId: venda.id, // <--- Vincula JSON à venda
        details: dpsPayload
    });

    // 6. Simulação de Envio
    await new Promise(r => setTimeout(r, 1000));
    
    // 7. Salvar Nota e Atualizar Venda
    const novaNota = await prisma.notaFiscal.create({
      data: {
        vendaId: venda.id, // <--- Vincula nota à venda
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

    // Marca Venda como Concluída
    await prisma.venda.update({
        where: { id: venda.id },
        data: { status: 'CONCLUIDA' }
    });

    await createLog({
        level: 'INFO',
        action: 'EMISSAO_SUCESSO',
        message: `Nota ${novaNota.numero} autorizada!`,
        empresaId: prestador.id,
        vendaId: venda.id
    });

    return NextResponse.json({ success: true, nota: novaNota }, { status: 201 });

  } catch (error: any) {
    // Se deu erro, marca a venda como ERRO
    if (vendaIdLog) {
        await prisma.venda.update({
            where: { id: vendaIdLog },
            data: { status: 'ERRO_EMISSAO' }
        });
    }

    await createLog({
        level: 'ERRO',
        action: 'EMISSAO_FALHA',
        message: error.message,
        empresaId: empresaIdLog || undefined,
        vendaId: vendaIdLog || undefined,
        details: error.stack
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}