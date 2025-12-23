'use client';

import { useState, useEffect } from 'react';
import { Building2, Save, ArrowLeft, Search, MapPin, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ConfiguracoesEmpresa() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState('');
  
  // Estado para lista de atividades (CNAEs)
  const [atividades, setAtividades] = useState<any[]>([]); 

  const [empresa, setEmpresa] = useState({
    documento: '',
    razaoSocial: '',
    nomeFantasia: '',
    cnaePrincipal: '', // Apenas visual
    inscricaoMunicipal: '',
    regimeTributario: 'MEI',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    codigoIbge: ''
  });

  // Carrega dados já salvos no banco
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      router.push('/login');
      return;
    }

    async function carregarDados() {
      try {
        const res = await fetch('/api/perfil', {
          headers: { 'x-user-id': userId }
        });
        if (res.ok) {
          const dados = await res.json();
          
          setEmpresa(prev => ({
            ...prev,
            ...dados // Preenche campos de texto
          }));

          // === A CORREÇÃO ESTÁ AQUI ===
          // Se o banco retornou atividades salvas, preenchemos o estado
          if (dados.atividades && Array.isArray(dados.atividades)) {
             setAtividades(dados.atividades);
          }
          // ============================
        }
      } catch (error) {
        console.error("Erro ao carregar perfil");
      }
    }
    carregarDados();
  }, [router]);

  // Função de consulta CNPJ (BrasilAPI/ReceitaWS)
  const consultarCNPJ = async () => {
    const docLimpo = empresa.documento.replace(/\D/g, '');
    if (docLimpo.length !== 14) {
      alert("Digite um CNPJ válido para buscar.");
      return;
    }

    setBuscando(true);
    setMsg('');

    try {
      const res = await fetch('/api/external/cnpj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: docLimpo })
      });

      const dados = await res.json();

      if (res.ok) {
        setEmpresa(prev => ({
          ...prev,
          razaoSocial: dados.razaoSocial,
          nomeFantasia: dados.nomeFantasia,
          cnaePrincipal: dados.cnaePrincipal,
          cep: dados.cep,
          logradouro: dados.logradouro,
          numero: dados.numero,
          complemento: dados.complemento,
          bairro: dados.bairro,
          cidade: dados.cidade,
          uf: dados.uf,
          codigoIbge: dados.codigoIbge
        }));
        
        // Atualiza a lista com o que veio da API Externa
        setAtividades(dados.cnaes || []);
        
        setMsg('✅ Dados carregados da Receita Federal! Clique em Salvar.');
      } else {
        setMsg('❌ ' + (dados.error || 'Erro ao buscar CNPJ.'));
      }
    } catch (error) {
      setMsg('❌ Erro de conexão com a API.');
    } finally {
      setBuscando(false);
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    
    const userId = localStorage.getItem('userId');

    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId || ''
        },
        // Envia os dados + a lista de atividades para salvar no banco
        body: JSON.stringify({ ...empresa, cnaes: atividades }),
      });

      if (res.ok) {
        setMsg('✅ Cadastro atualizado com sucesso!');
      } else {
        setMsg('❌ Erro ao salvar.');
      }
    } catch (error) {
      setMsg('❌ Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full transition">
            <ArrowLeft className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Cadastro da Empresa</h1>
            <p className="text-gray-500">Dados obrigatórios para emissão de Nota Fiscal (NFS-e).</p>
          </div>
        </div>

        <form onSubmit={handleSalvar} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          
          {/* SEÇÃO 1: DADOS GERAIS */}
          <div className="p-8 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-blue-600 mb-6 flex items-center gap-2">
              <Briefcase size={20} /> Dados Cadastrais
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Campo CNPJ com Botão de Busca */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">CNPJ (Apenas números)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Building2 className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input 
                      type="text" 
                      className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                      placeholder="00000000000191"
                      value={empresa.documento || ''}
                      onChange={e => setEmpresa({...empresa, documento: e.target.value})}
                      maxLength={18}
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={consultarCNPJ}
                    disabled={buscando}
                    className="bg-blue-100 text-blue-700 px-6 py-2 rounded-lg font-medium hover:bg-blue-200 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {buscando ? 'Buscando...' : <><Search size={20} /> Buscar Dados</>}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Clique em buscar para preencher automaticamente.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Razão Social</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg bg-gray-50"
                  value={empresa.razaoSocial || ''}
                  onChange={e => setEmpresa({...empresa, razaoSocial: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome Fantasia</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg bg-gray-50"
                  value={empresa.nomeFantasia || ''}
                  onChange={e => setEmpresa({...empresa, nomeFantasia: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Inscrição Municipal</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg"
                  placeholder="Ex: 12345"
                  value={empresa.inscricaoMunicipal || ''}
                  onChange={e => setEmpresa({...empresa, inscricaoMunicipal: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Regime Tributário</label>
                <select 
                  className="w-full p-3 border rounded-lg"
                  value={empresa.regimeTributario || 'MEI'}
                  onChange={e => setEmpresa({...empresa, regimeTributario: e.target.value})}
                >
                  <option value="MEI">Microempreendedor Individual (MEI)</option>
                  <option value="SIMPLES">Simples Nacional</option>
                  <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                </select>
              </div>

              {/* LISTA DE CNAES (ATIVIDADES) */}
              <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-bold text-blue-700 flex items-center gap-2">
                        📋 Atividades Econômicas (CNAEs)
                    </h4>
                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
                        {atividades.length} atividades
                    </span>
                </div>
                
                {atividades.length === 0 ? (
                    <p className="text-xs text-gray-500 italic p-2">
                        Nenhuma atividade carregada. Consulte o CNPJ ou salve para atualizar.
                    </p>
                ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {atividades.map((cnae, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs bg-white p-3 rounded border border-blue-100 shadow-sm">
                                <span className={`font-bold px-2 py-1 rounded text-[10px] uppercase tracking-wide ${cnae.principal ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-600'}`}>
                                    {cnae.principal ? 'Principal' : 'Secundário'}
                                </span>
                                <div>
                                    <span className="font-mono font-bold text-gray-800 text-sm block">{cnae.codigo}</span>
                                    <span className="text-gray-600 leading-tight">{cnae.descricao}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <p className="text-[10px] text-blue-500 mt-3 border-t border-blue-200 pt-2">
                    * Essas atividades serão usadas para validar a emissão de notas fiscais.
                </p>
              </div>

            </div>
          </div>

          {/* SEÇÃO 2: ENDEREÇO */}
          <div className="p-8">
            <h3 className="text-lg font-semibold text-blue-600 mb-6 flex items-center gap-2">
              <MapPin size={20} /> Endereço da Empresa
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">CEP</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg bg-gray-50"
                  value={empresa.cep || ''}
                  onChange={e => setEmpresa({...empresa, cep: e.target.value})}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Logradouro (Rua/Av)</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg bg-gray-50"
                  value={empresa.logradouro || ''}
                  onChange={e => setEmpresa({...empresa, logradouro: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Número</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg bg-gray-50"
                  value={empresa.numero || ''}
                  onChange={e => setEmpresa({...empresa, numero: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Complemento</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg bg-gray-50"
                  value={empresa.complemento || ''}
                  onChange={e => setEmpresa({...empresa, complemento: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bairro</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg bg-gray-50"
                  value={empresa.bairro || ''}
                  onChange={e => setEmpresa({...empresa, bairro: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg bg-gray-50"
                  value={empresa.cidade || ''}
                  onChange={e => setEmpresa({...empresa, cidade: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado (UF)</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg bg-gray-50"
                  maxLength={2}
                  value={empresa.uf || ''}
                  onChange={e => setEmpresa({...empresa, uf: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Código IBGE</label>
                <input 
                  type="text" 
                  className="w-full p-3 border rounded-lg bg-gray-50 font-mono text-sm"
                  readOnly
                  title="Preenchido automaticamente pelo sistema"
                  value={empresa.codigoIbge || ''}
                />
              </div>

            </div>
          </div>

          {/* RODAPÉ E FEEDBACK */}
          <div className="bg-gray-50 p-6 flex flex-col items-center gap-4 border-t">
            {msg && (
              <div className={`px-4 py-2 rounded-full text-sm font-medium ${msg.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {msg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full md:w-auto px-8 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-green-200"
            >
              {loading ? 'Salvando...' : <><Save size={20} /> Salvar Cadastro Completo</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}