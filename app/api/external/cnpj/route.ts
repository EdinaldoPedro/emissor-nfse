import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { cnpj } = await request.json();
  const cnpjLimpo = cnpj.replace(/\D/g, '');

  if (cnpjLimpo.length !== 14) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 });
  }

  let dadosFinais: any = null;

  // Função auxiliar para decodificar corretamente (UTF-8)
  const fetchSafe = async (url: string) => {
      try {
          const res = await fetch(url, {
              method: 'GET',
              headers: { 
                  'User-Agent': 'Mozilla/5.0',
                  'Content-Type': 'application/json; charset=utf-8' 
              },
              cache: 'no-store',
              signal: AbortSignal.timeout(10000) 
          });
          
          if (!res.ok) return null;

          const arrayBuffer = await res.arrayBuffer();
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(arrayBuffer);
          
          return JSON.parse(text);
      } catch (e) {
          console.error(`Erro fetchSafe:`, e);
          return null;
      }
  };

  // 1. BrasilAPI
  const dataBrasil = await fetchSafe(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
  if (dataBrasil) {
      const listaCnaes = [];
      if (dataBrasil.cnae_fiscal) listaCnaes.push({ codigo: `${dataBrasil.cnae_fiscal}`, descricao: dataBrasil.cnae_fiscal_descricao, principal: true });
      if (dataBrasil.cnaes_secundarios) {
          dataBrasil.cnaes_secundarios.forEach((c: any) => listaCnaes.push({ codigo: `${c.codigo}`, descricao: c.descricao, principal: false }));
      }

      dadosFinais = {
        razaoSocial: dataBrasil.razao_social,
        nomeFantasia: dataBrasil.nome_fantasia || dataBrasil.razao_social,
        cnaePrincipal: dataBrasil.cnae_fiscal_descricao,
        cep: dataBrasil.cep,
        logradouro: dataBrasil.logradouro,
        numero: dataBrasil.numero,
        complemento: dataBrasil.complemento,
        bairro: dataBrasil.bairro,
        cidade: dataBrasil.municipio,
        uf: dataBrasil.uf,
        codigoIbge: dataBrasil.codigo_municipio_ibge,
        email: dataBrasil.email,
        telefone: dataBrasil.ddd_telefone_1,
        cnaes: listaCnaes
      };
  }

  // 2. ReceitaWS (Fallback)
  if (!dadosFinais) {
      const dataReceita = await fetchSafe(`https://www.receitaws.com.br/v1/cnpj/${cnpjLimpo}`);
      if (dataReceita && dataReceita.status !== 'ERROR') {
        const listaCnaes = [];
        if (dataReceita.atividade_principal) dataReceita.atividade_principal.forEach((c: any) => listaCnaes.push({ codigo: c.code.replace(/\D/g, ''), descricao: c.text, principal: true }));
        if (dataReceita.atividades_secundarias) dataReceita.atividades_secundarias.forEach((c: any) => listaCnaes.push({ codigo: c.code.replace(/\D/g, ''), descricao: c.text, principal: false }));

        dadosFinais = {
          razaoSocial: dataReceita.nome,
          nomeFantasia: dataReceita.fantasia || dataReceita.nome,
          cnaePrincipal: dataReceita.atividade_principal[0]?.text || '',
          cep: dataReceita.cep.replace(/\D/g, ''),
          logradouro: dataReceita.logradouro,
          numero: dataReceita.numero,
          complemento: dataReceita.complemento,
          bairro: dataReceita.bairro,
          cidade: dataReceita.municipio,
          uf: dataReceita.uf,
          codigoIbge: '', 
          email: dataReceita.email,
          telefone: dataReceita.telefone,
          cnaes: listaCnaes
        };
      }
  }

  if (!dadosFinais) return NextResponse.json({ error: 'Serviços indisponíveis.' }, { status: 503 });

  // 3. ViaCEP (Correção de Endereço)
  if (dadosFinais.cep) {
      const dataCep = await fetchSafe(`https://viacep.com.br/ws/${dadosFinais.cep.replace(/\D/g,'')}/json/`);
      if (dataCep && !dataCep.erro) {
          if (dataCep.ibge) dadosFinais.codigoIbge = dataCep.ibge;
          if (dataCep.logradouro) dadosFinais.logradouro = dataCep.logradouro;
          if (dataCep.bairro) dadosFinais.bairro = dataCep.bairro;
          if (dataCep.localidade) dadosFinais.cidade = dataCep.localidade;
          if (dataCep.uf) dadosFinais.uf = dataCep.uf;
      }
  }

  return NextResponse.json(dadosFinais);
}