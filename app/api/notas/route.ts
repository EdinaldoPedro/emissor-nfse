import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
// Removemos o import do arquivo estático, pois agora vamos usar o Banco de Dados
// import { getTributacaoPorCnae } from '../../utils/tributacao'; 

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await request.json();
    const { clienteId, valor, descricao, codigoCnae } = body;

    // 1. Validações Básicas
    if (!clienteId || !valor || !descricao || !codigoCnae) {
      return NextResponse.json({ error: 'Dados incompletos (Cliente, CNAE, Valor ou Descrição).' }, { status: 400 });
    }

    // 2. Buscar Prestador (Quem emite)
    const prestador = await prisma.user.findUnique({
      where: { id: userId },
      include: { empresa: true } // Alterado para buscar a empresa vinculada
    });

    // Ajuste para pegar a empresa corretamente (seja via relação direta ou campo empresaId)
    // Assumindo que no seu schema User tem empresaId ou relação one-to-one
    const empresaPrestador = prestador?.empresa;

    if (!empresaPrestador || !empresaPrestador.documento) {
      return NextResponse.json({ error: 'Seu CNPJ não está cadastrado.' }, { status: 400 });
    }
    if (!empresaPrestador.codigoIbge) {
      return NextResponse.json({ error: 'Seu cadastro está sem Código IBGE. Atualize em "Minha Empresa".' }, { status: 400 });
    }

    // 3. Buscar Tomador (Cliente)
    const tomador = await prisma.cliente.findUnique({ where: { id: clienteId } }); // Nota: Seu schema usa 'Cliente' ou 'UserCliente'? Ajuste conforme seu prisma.
    // Baseado no seu schema.prisma anterior, existe um model Cliente? 
    // Vou usar o model 'Empresa' ou o relacionamento correto. 
    // Se 'clienteId' refere-se a uma empresa cadastrada na tabela UserCliente/Empresa:
    
    // VERIFICAÇÃO DE SEGURANÇA: Vamos buscar a empresa destino corretamente
    // Se o cliente for apenas um registro simples, ok. Se for vinculado a uma Empresa:
    const empresaTomador = await prisma.empresa.findUnique({ where: { id: clienteId } });
    
    if (!empresaTomador) {
         return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 });
    }

    // --- A MÁGICA DA INTELIGÊNCIA FISCAL (ALTERAÇÃO PRINCIPAL) ---
    const cnaeLimpo = codigoCnae.replace(/\D/g, '');
    let itemLc = '01.01'; // Fallback padrão
    let codigoTributacao = '01.01.01'; // Fallback padrão
    let fonteDaRegra = 'Padrão do Sistema';

    // A. Tenta achar regra específica MUNICIPAL (Exceção)
    // Busca se existe regra para este CNAE na cidade do PRESTADOR (quem emite define a regra municipal na maioria dos casos de serviço local)
    // *Nota: Dependendo da regra do município, pode ser na cidade do tomador, mas o padrão NFS-e nacional foca no prestador ou local da prestação.
    const regraMunicipal = await prisma.tributacaoMunicipal.findFirst({
        where: {
            cnae: cnaeLimpo,
            codigoIbge: empresaPrestador.codigoIbge
        }
    });

    if (regraMunicipal && regraMunicipal.codigoTributacaoMunicipal !== 'A_DEFINIR') {
        codigoTributacao = regraMunicipal.codigoTributacaoMunicipal;
        fonteDaRegra = `Municipal (${empresaPrestador.codigoIbge})`;
        // Tenta inferir o item LC do código municipal ou mantem o padrão se não tiver mapeado
    } else {
        // B. Se não tem regra municipal, busca a regra NACIONAL (Global)
        const regraGlobal = await prisma.globalCnae.findUnique({
            where: { codigo: cnaeLimpo }
        });

        if (regraGlobal) {
            if (regraGlobal.itemLc) itemLc = regraGlobal.itemLc;
            if (regraGlobal.codigoTributacaoNacional) codigoTributacao = regraGlobal.codigoTributacaoNacional;
            fonteDaRegra = 'Tabela Nacional (Global)';
        }
    }
    // -------------------------------------------------------------

    // 4. Montagem da DPS (Declaração de Prestação de Serviço)
    const dps = {
      versao: "1.00",
      id: `DPS${Date.now()}`,
      dataEmissao: new Date().toISOString(),
      prestador: {
        cpfCnpj: empresaPrestador.documento.replace(/\D/g, ''),
        inscricaoMunicipal: empresaPrestador.inscricaoMunicipal || '', 
        codigoMunicipio: empresaPrestador.codigoIbge,
      },
      tomador: {
        cpfCnpj: empresaTomador.documento.replace(/\D/g, ''),
        razaoSocial: empresaTomador.razaoSocial,
        endereco: {
            cep: empresaTomador.cep || '',
            codigoMunicipio: empresaTomador.codigoIbge, 
            uf: empresaTomador.uf || ''
        }
      },
      servico: {
        codigoCnae: cnaeLimpo,
        codigoTributacaoNacional: codigoTributacao, // Agora vem do Banco de Dados!
        itemListaServico: itemLc, // Agora vem do Banco de Dados!
        discriminacao: descricao,
        valores: {
            valorServico: parseFloat(valor),
            aliquota: 0,
            valorIss: 0
        }
      }
    };

    // LOG VISUAL
    console.log("\n==================================================");
    console.log("🚀 DPS GERADA COM INTELIGÊNCIA DE DADOS");
    console.log(`CNAE: ${cnaeLimpo}`);
    console.log(`Fonte da Regra: ${fonteDaRegra}`);
    console.log(`Trib. Nacional: ${codigoTributacao}`);
    console.log(`Item LC: ${itemLc}`);
    console.log("==================================================\n");

    // Simulação de envio (Delay)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Salva a nota
    const novaNota = await prisma.notaFiscal.create({
      data: {
        valor: parseFloat(valor),
        descricao: descricao,
        status: 'AUTORIZADA',
        numero: Math.floor(Math.random() * 100000),
        chaveAcesso: `352312${Date.now()}00019055001000000001`,
        cnae: cnaeLimpo,
        codigoServico: codigoTributacao, 
        userId: userId, // Dono da nota (quem emitiu)
        
        // Aqui assumimos que o relacionamento no schema é com a tabela de Clientes ou UserCliente. 
        // Ajuste 'clienteId' conforme seu schema (se for relação com UserCliente ou Empresa)
        clienteId: clienteId, 
        
        // Vínculo com a empresa emissora
        empresaId: empresaPrestador.id,
        
        dataEmissao: new Date()
      }
    });

    return NextResponse.json({ success: true, nota: novaNota, mensagem: "Nota Fiscal emitida com sucesso!" }, { status: 201 });

  } catch (error) {
    console.error("Erro emissão:", error);
    return NextResponse.json({ error: 'Erro interno na emissão.' }, { status: 500 });
  }
}