import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { cnpj } = await request.json();
  const cnpjLimpo = cnpj.replace(/\D/g, '');

  if (cnpjLimpo.length !== 14) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 });
  }

  let dadosFinais: any = null;

  // --- TENTATIVA 1: BrasilAPI (CNPJ) ---
  try {
    const resBrasil = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(4000) // Timeout curto para tentar o próximo rápido
    });

    if (resBrasil.ok) {
      const data = await resBrasil.json();
      
      const listaCnaes = [];
      if (data.cnae_fiscal) {
          listaCnaes.push({ codigo: `${data.cnae_fiscal}`, descricao: data.cnae_fiscal_descricao, principal: true });
      }
      if (data.cnaes_secundarios) {
          data.cnaes_secundarios.forEach((c: any) => {
              listaCnaes.push({ codigo: `${c.codigo}`, descricao: c.descricao, principal: false });
          });
      }

      dadosFinais = {
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia || data.razao_social,
        cnaePrincipal: data.cnae_fiscal_descricao,
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        cidade: data.municipio,
        uf: data.uf,
        codigoIbge: data.codigo_municipio_ibge,
        email: data.email,
        telefone: data.ddd_telefone_1,
        cnaes: listaCnaes
      };
    }
  } catch (error) {
    console.warn("⚠️ BrasilAPI (CNPJ) falhou ou demorou. Tentando ReceitaWS...");
  }

  // --- TENTATIVA 2: ReceitaWS (CNPJ) - Se a primeira falhou ---
  if (!dadosFinais) {
    try {
      const resReceita = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpjLimpo}`, {
         method: 'GET',
         cache: 'no-store',
         signal: AbortSignal.timeout(8000)
      });

      if (resReceita.ok) {
        const data = await resReceita.json();
        if (data.status !== 'ERROR') {
          
          const listaCnaes = [];
          if (data.atividade_principal) {
              data.atividade_principal.forEach((c: any) => listaCnaes.push({ codigo: c.code.replace(/\D/g, ''), descricao: c.text, principal: true }));
          }
          if (data.atividades_secundarias) {
              data.atividades_secundarias.forEach((c: any) => listaCnaes.push({ codigo: c.code.replace(/\D/g, ''), descricao: c.text, principal: false }));
          }

          dadosFinais = {
            razaoSocial: data.nome,
            nomeFantasia: data.fantasia || data.nome,
            cnaePrincipal: data.atividade_principal[0]?.text || '',
            cep: data.cep.replace(/\D/g, ''),
            logradouro: data.logradouro,
            numero: data.numero,
            complemento: data.complemento,
            bairro: data.bairro,
            cidade: data.municipio,
            uf: data.uf,
            codigoIbge: '', // ReceitaWS não traz IBGE
            email: data.email,
            telefone: data.telefone,
            cnaes: listaCnaes
          };
        }
      }
    } catch (error) {
      console.error("❌ ReceitaWS também falhou.");
    }
  }

  if (!dadosFinais) {
    return NextResponse.json({ error: 'Serviços de consulta indisponíveis.' }, { status: 503 });
  }

  // --- PASSO 3: O GRANDE SALVADOR (ViaCEP) ---
  // Se temos CEP mas não temos IBGE, consultamos a ViaCEP (infalível para IBGE)
  if (!dadosFinais.codigoIbge && dadosFinais.cep) {
      console.log("🔍 Buscando IBGE na ViaCEP para:", dadosFinais.cep);
      try {
          // ViaCEP exige CEP limpo (sem traço) ou com traço, mas vamos limpar pra garantir
          const cepLimpo = dadosFinais.cep.replace(/\D/g, '');
          
          const resCep = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, {
              method: 'GET',
              cache: 'no-store'
          });
          
          if (resCep.ok) {
              const dataCep = await resCep.json();
              
              if (!dataCep.erro && dataCep.ibge) {
                  dadosFinais.codigoIbge = dataCep.ibge;
                  console.log("✅ IBGE recuperado com sucesso via ViaCEP:", dataCep.ibge);
                  
                  // Se faltou algum dado de endereço, completamos com a ViaCEP
                  if (!dadosFinais.cidade) dadosFinais.cidade = dataCep.localidade;
                  if (!dadosFinais.uf) dadosFinais.uf = dataCep.uf;
                  if (!dadosFinais.bairro) dadosFinais.bairro = dataCep.bairro;
                  if (!dadosFinais.logradouro) dadosFinais.logradouro = dataCep.logradouro;
              }
          }
      } catch (cepError) {
          console.error("Erro ao enriquecer dados com ViaCEP:", cepError);
      }
  }

  return NextResponse.json(dadosFinais);
}