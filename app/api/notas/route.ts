import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getTributacaoPorCnae } from '../../utils/tributacao'; // <--- IMPORTE O NOVO ARQUIVO

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

    // 2. Buscar Prestador
    const prestador = await prisma.user.findUnique({
      where: { id: userId },
      include: { atividades: true }
    });

    if (!prestador || !prestador.documento) {
      return NextResponse.json({ error: 'Seu CNPJ não está cadastrado.' }, { status: 400 });
    }
    if (!prestador.codigoIbge) {
      return NextResponse.json({ error: 'Seu cadastro está sem Código IBGE. Atualize em "Minha Empresa".' }, { status: 400 });
    }

    // 3. Buscar Tomador
    const tomador = await prisma.cliente.findUnique({ where: { id: clienteId } });

    if (!tomador || !tomador.documento) {
      return NextResponse.json({ error: 'Cliente incompleto.' }, { status: 400 });
    }
    if (!tomador.codigoIbge) {
        return NextResponse.json({ error: `Cliente ${tomador.nome} sem Código IBGE. Atualize o cadastro dele.` }, { status: 400 });
    }

    // --- A MÁGICA ACONTECE AQUI ---
    // Descobrimos a tributação correta baseada no CNAE escolhido
    const dadosFiscais = getTributacaoPorCnae(codigoCnae);
    // -----------------------------

    // 4. Montagem da DPS
    const dps = {
      versao: "1.00",
      id: `DPS${Date.now()}`,
      dataEmissao: new Date().toISOString(),
      prestador: {
        cpfCnpj: prestador.documento.replace(/\D/g, ''),
        inscricaoMunicipal: prestador.inscricaoMunicipal || '', 
        codigoMunicipio: prestador.codigoIbge,
      },
      tomador: {
        cpfCnpj: tomador.documento.replace(/\D/g, ''),
        razaoSocial: tomador.nome,
        endereco: {
            cep: tomador.cep || '',
            codigoMunicipio: tomador.codigoIbge, 
            uf: tomador.uf || ''
        }
      },
      servico: {
        codigoCnae: codigoCnae.replace(/\D/g, ''),
        
        // Agora usamos os dados dinâmicos do nosso mapa
        codigoTributacaoNacional: dadosFiscais.codigoTributacaoNacional,
        
        discriminacao: descricao,
        valores: {
            valorServico: parseFloat(valor),
            aliquota: 0,
            valorIss: 0
        }
      }
    };

    // LOG VISUAL (Para você conferir se o código mudou no terminal)
    console.log("\n==================================================");
    console.log("🚀 DPS GERADA COM MAPEAMENTO FISCAL INTELIGENTE");
    console.log(`CNAE Original: ${codigoCnae}`);
    console.log(`Tributação Definida: ${dadosFiscais.codigoTributacaoNacional} (${dadosFiscais.itemLC})`);
    console.log("==================================================\n");
    console.log(JSON.stringify(dps, null, 2)); 

    await new Promise(resolve => setTimeout(resolve, 1500));

    const novaNota = await prisma.notaFiscal.create({
      data: {
        valor: parseFloat(valor),
        descricao: descricao,
        status: 'AUTORIZADA',
        numero: Math.floor(Math.random() * 100000),
        chaveAcesso: `352312${Date.now()}00019055001000000001`,
        cnae: codigoCnae,
        // Podemos salvar o código de tributação no banco também se quiser, 
        // mas por enquanto salvamos o CNAE que é a origem.
        codigoServico: dadosFiscais.codigoTributacaoNacional, 
        userId: userId,
        clienteId: clienteId,
        dataEmissao: new Date()
      }
    });

    return NextResponse.json({ success: true, nota: novaNota, mensagem: "Nota Fiscal emitida com sucesso!" }, { status: 201 });

  } catch (error) {
    console.error("Erro emissão:", error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}