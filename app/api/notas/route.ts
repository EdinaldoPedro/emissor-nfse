import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger'; // <--- IMPORTANTE

const prisma = new PrismaClient();
const formatMoney = (val: any) => parseFloat(val).toFixed(2);
const cleanString = (str: string | null) => str ? str.replace(/\D/g, '') : '';

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id') || 'anonimo';
  let empresaIdLog = null; // Para usar no catch

  try {
    const body = await request.json();
    const { clienteId, valor, descricao, codigoCnae, retencoes } = body;

    // 1. Identificar Prestador
    const userPrestador = await prisma.user.findUnique({
      where: { id: userId },
      include: { empresa: true }
    });
    const prestador = userPrestador?.empresa;

    if (!prestador) {
        throw new Error("Usuário não possui empresa vinculada.");
    }
    empresaIdLog = prestador.id;

    // LOG INICIAL
    await createLog({
        level: 'INFO',
        action: 'EMISSAO_INICIO',
        message: `Iniciando processo para CNAE ${codigoCnae}`,
        empresaId: prestador.id,
        details: { valor, clienteId }
    });

    // 2. Validações
    if (!prestador.codigoIbge || !prestador.inscricaoMunicipal) {
        throw new Error('Cadastro incompleto: Falta IBGE ou Inscrição Municipal.');
    }

    const tomador = await prisma.empresa.findUnique({ where: { id: clienteId } });
    if (!tomador) throw new Error('Tomador não encontrado.');

    // 3. Inteligência Tributária (Rastreando a decisão)
    const cnaeLimpo = cleanString(codigoCnae);
    let itemLc = '01.01';
    let codigoTribNacional = null;
    let fonteRegra = 'PADRAO';

    // A. Regra Municipal
    const regraMunicipal = await prisma.tributacaoMunicipal.findFirst({
        where: { cnae: cnaeLimpo, codigoIbge: prestador.codigoIbge }
    });

    if (regraMunicipal && regraMunicipal.codigoTributacaoMunicipal !== 'A_DEFINIR') {
        codigoTribNacional = regraMunicipal.codigoTributacaoMunicipal;
        fonteRegra = `MUNICIPAL (${prestador.codigoIbge})`;
    } else {
        // B. Regra Global
        const regraGlobal = await prisma.globalCnae.findUnique({ where: { codigo: cnaeLimpo } });
        if (regraGlobal) {
            if (regraGlobal.itemLc) itemLc = regraGlobal.itemLc;
            if (regraGlobal.codigoTributacaoNacional) codigoTribNacional = regraGlobal.codigoTributacaoNacional;
            fonteRegra = 'GLOBAL';
        }
    }

    // LOG DA DECISÃO TRIBUTÁRIA
    await createLog({
        level: 'DEBUG',
        action: 'EMISSAO_TRIBUTACAO',
        message: `Regra fiscal definida via ${fonteRegra}`,
        empresaId: prestador.id,
        details: { cnae: cnaeLimpo, itemLc, codigoTribNacional }
    });

    if (!codigoTribNacional) {
        codigoTribNacional = '010101'; 
        await createLog({ level: 'ALERTA', action: 'EMISSAO_FALLBACK', message: 'Sem regra definida, usando genérico.', empresaId: prestador.id });
    }

    // 4. Montagem DPS
    const dpsId = `DPS${Date.now()}`;
    const dpsPayload = {
      "id": dpsId,
      "prestador": { "cnpj": cleanString(prestador.documento) },
      "tomador": { "cnpj": cleanString(tomador.documento) },
      "servico": {
        "codigoCnae": cnaeLimpo,
        "codigoTributacaoNacional": codigoTribNacional,
        "itemListaServico": itemLc,
        "valores": { "valorServico": formatMoney(valor) }
      }
    };

    // LOG DO JSON GERADO (O "Script" visual)
    await createLog({
        level: 'INFO',
        action: 'EMISSAO_JSON_GERADO',
        message: 'DPS montada com sucesso',
        empresaId: prestador.id,
        details: dpsPayload
    });

    // 5. Simulação de Envio
    await new Promise(r => setTimeout(r, 1000));
    
    // Sucesso
    const novaNota = await prisma.notaFiscal.create({
      data: {
        empresaId: prestador.id,
        clienteId: tomador.id,
        userId: userId,
        numero: Math.floor(Math.random() * 10000),
        valor: parseFloat(valor),
        descricao: descricao,
        prestadorCnpj: cleanString(prestador.documento),
        tomadorCnpj: cleanString(tomador.documento),
        status: 'AUTORIZADA',
        chaveAcesso: `KEY${Date.now()}`,
        dataEmissao: new Date()
      }
    });

    await createLog({
        level: 'INFO',
        action: 'EMISSAO_SUCESSO',
        message: `Nota ${novaNota.numero} autorizada!`,
        empresaId: prestador.id
    });

    return NextResponse.json({ success: true, nota: novaNota }, { status: 201 });

  } catch (error: any) {
    // LOG DE ERRO (O mais importante)
    await createLog({
        level: 'ERRO',
        action: 'EMISSAO_FALHA',
        message: error.message,
        empresaId: empresaIdLog || undefined,
        details: error
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}