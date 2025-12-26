import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createLog } from '@/app/services/logger';

const prisma = new PrismaClient();
const formatMoney = (val: any) => parseFloat(val).toFixed(2);
const cleanString = (str: string | null) => str ? str.replace(/\D/g, '') : '';

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id') || 'anonimo';
  let empresaIdLog = null;

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
        message: `Iniciando emissão (R$ ${valor})`,
        empresaId: prestador.id,
        details: { clienteId, cnae: codigoCnae, regime: prestador.regimeTributario }
    });

    // 2. Validações Cadastrais (CORRIGIDO PARA MEI)
    if (!prestador.codigoIbge) {
        throw new Error('Cadastro incompleto: Falta o Código IBGE da sua empresa (verifique em Configurações).');
    }

    // Só exige Inscrição Municipal se NÃO for MEI
    const isMEI = prestador.regimeTributario === 'MEI';
    if (!isMEI && !prestador.inscricaoMunicipal) {
        throw new Error('Cadastro incompleto: Empresas não-MEI precisam de Inscrição Municipal.');
    }

    const tomador = await prisma.empresa.findUnique({ where: { id: clienteId } });
    if (!tomador) throw new Error('Cliente tomador não encontrado.');
    
    // Validação do Cliente
    if (!tomador.documento) throw new Error('Cliente sem CPF/CNPJ cadastrado.');
    // Para NFS-e nacional, o endereço do tomador é crucial, mas vamos deixar passar se faltar algo e logar aviso
    if (!tomador.codigoIbge) {
        await createLog({
            level: 'ALERTA',
            action: 'EMISSAO_DADOS_TOMADOR',
            message: 'Tomador sem IBGE. O imposto pode ser calculado errado.',
            empresaId: prestador.id
        });
    }

    // 3. Inteligência Tributária
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

    if (!codigoTribNacional) {
        codigoTribNacional = '010101'; // Fallback genérico
        await createLog({ level: 'ALERTA', action: 'EMISSAO_FALLBACK', message: 'Sem regra tributária definida.', empresaId: prestador.id });
    }

    // 4. Montagem DPS
    const dpsId = `DPS${Date.now()}`;
    const dpsPayload = {
      "id": dpsId,
      "dataEmissao": new Date().toISOString(),
      "prestador": { 
          "cnpj": cleanString(prestador.documento),
          "inscricaoMunicipal": cleanString(prestador.inscricaoMunicipal) || "ISENTO", // Envia ISENTO se vazio (comum para MEI)
          "codigoMunicipio": prestador.codigoIbge
      },
      "tomador": { 
          "cpfCnpj": cleanString(tomador.documento),
          "razaoSocial": tomador.razaoSocial,
          "endereco": {
              "codigoMunicipio": tomador.codigoIbge || "0000000", // Evita crash
              "cep": cleanString(tomador.cep)
          }
      },
      "servico": {
        "codigoCnae": cnaeLimpo,
        "codigoTributacaoNacional": codigoTribNacional,
        "itemListaServico": itemLc,
        "discriminacao": descricao,
        "valores": { 
            "valorServico": formatMoney(valor),
            "issRetido": retencoes
        }
      }
    };

    // LOG DO JSON GERADO
    await createLog({
        level: 'INFO',
        action: 'EMISSAO_JSON_GERADO',
        message: 'DPS montada com sucesso',
        empresaId: prestador.id,
        details: dpsPayload
    });

    // 5. Simulação de Envio
    await new Promise(r => setTimeout(r, 1500));
    
    // Sucesso
    const novaNota = await prisma.notaFiscal.create({
      data: {
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

    await createLog({
        level: 'INFO',
        action: 'EMISSAO_SUCESSO',
        message: `Nota ${novaNota.numero} autorizada!`,
        empresaId: prestador.id
    });

    return NextResponse.json({ success: true, nota: novaNota, mensagem: "Nota emitida com sucesso!" }, { status: 201 });

  } catch (error: any) {
    // LOG DE ERRO (Agora captura validações também)
    await createLog({
        level: 'ERRO',
        action: 'EMISSAO_FALHA',
        message: error.message,
        empresaId: empresaIdLog || undefined,
        details: error.stack
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}