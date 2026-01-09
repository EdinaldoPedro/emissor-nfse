'use client';

import { useState, useEffect } from 'react';
import { Building2, Save, ArrowLeft, Search, MapPin, Briefcase, Lock, Trash2, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ConfiguracoesEmpresa() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState('');
  
  const [atividades, setAtividades] = useState<any[]>([]); 
  
  // Estado do Certificado
  const [certFile, setCertFile] = useState<string | null>(null); // Base64
  const [certSenha, setCertSenha] = useState('');
  const [dadosCertificado, setDadosCertificado] = useState<{ativo: boolean, vencimento: string | null}>({ ativo: false, vencimento: null });

  const [empresa, setEmpresa] = useState({
    documento: '',
    razaoSocial: '',
    nomeFantasia: '',
    cnaePrincipal: '',
    inscricaoMunicipal: '',
    regimeTributario: 'MEI',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    codigoIbge: '',
    ambiente: 'HOMOLOGACAO', // Default
    serieDPS: '900',
    ultimoDPS: 0
  });

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) { router.push('/login'); return; }

    async function carregarDados() {
      try {
        const res = await fetch('/api/perfil', { headers: { 'x-user-id': userId } });
        if (res.ok) {
          const dados = await res.json();
          setEmpresa(prev => ({ ...prev, ...dados }));
          
          if (dados.atividades) setAtividades(dados.atividades);
          
          // Carrega status do certificado (sem baixar o arquivo)
          setDadosCertificado({
              ativo: dados.temCertificado,
              vencimento: dados.vencimentoCertificado
          });
        }
      } catch (error) { console.error("Erro ao carregar perfil"); }
    }
    carregarDados();
  }, [router]);

  const consultarCNPJ = async () => {
    const docLimpo = empresa.documento.replace(/\D/g, '');
    if (docLimpo.length !== 14) { alert("Digite um CNPJ válido."); return; }
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
        setEmpresa(prev => ({ ...prev, ...dados }));
        setAtividades(dados.cnaes || []);
        setMsg('✅ Dados carregados!');
      } else { setMsg('❌ ' + (dados.error || 'Erro ao buscar.')); }
    } catch (error) { setMsg('❌ Erro de conexão.'); } 
    finally { setBuscando(false); }
  };

  // Converte arquivo para Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              // Remove o prefixo "data:application/x-pkcs12;base64," se existir
              const base64String = (reader.result as string).split(',')[1];
              setCertFile(base64String);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleDeletarCertificado = async () => {
      if(!confirm("Tem certeza? Sem o certificado você não poderá emitir notas.")) return;
      
      // Envia flag para deletar
      await salvarDados({ deletarCertificado: true });
      setDadosCertificado({ ativo: false, vencimento: null });
      setCertFile(null);
      setCertSenha('');
  };

  const handleSalvar = (e: React.FormEvent) => {
      e.preventDefault();
      // Salva dados normais + certificado se houver novo
      salvarDados({
          certificadoArquivo: certFile,
          certificadoSenha: certSenha
      });
  };

  const salvarDados = async (extraData: any = {}) => {
    setLoading(true);
    setMsg('');
    const userId = localStorage.getItem('userId');

    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
        body: JSON.stringify({ 
            ...empresa, 
            cnaes: atividades,
            ...extraData // Injeta certificado ou flag de delete
        }),
      });

      const resposta = await res.json();

      if (res.ok) {
        setMsg('✅ Cadastro atualizado com sucesso!');
        // Se enviou certificado, limpa os campos de input por segurança
        if (extraData.certificadoArquivo) {
            setCertFile(null);
            setCertSenha('');
            // Atualiza visualmente (reload simples ou update state)
            window.location.reload(); 
        }
      } else {
        setMsg(`❌ ${resposta.error || 'Erro ao salvar.'}`);
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
          
          {/* ... CAMPOS NORMAIS (CNPJ, RAZÃO, ENDEREÇO) ... */}
          {/* MANTIVE O MESMO LAYOUT DA VERSÃO ANTERIOR PARA ESSA PARTE, FOCANDO NO CERTIFICADO ABAIXO */}
          <div className="p-8 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-blue-600 mb-6 flex items-center gap-2">
              <Briefcase size={20} /> Dados Cadastrais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">CNPJ</label>
                <div className="flex gap-2">
                  <input type="text" className="w-full p-3 border rounded-lg" placeholder="00000000000191" value={empresa.documento} onChange={e => setEmpresa({...empresa, documento: e.target.value})} maxLength={18}/>
                  <button type="button" onClick={consultarCNPJ} disabled={buscando} className="bg-blue-100 text-blue-700 px-6 py-2 rounded-lg font-medium flex items-center gap-2">
                    {buscando ? '...' : <Search size={20} />}
                  </button>
                </div>
              </div>
              <input type="text" className="w-full p-3 border rounded-lg bg-gray-50" placeholder="Razão Social" value={empresa.razaoSocial} onChange={e => setEmpresa({...empresa, razaoSocial: e.target.value})}/>
              <input type="text" className="w-full p-3 border rounded-lg bg-gray-50" placeholder="Nome Fantasia" value={empresa.nomeFantasia} onChange={e => setEmpresa({...empresa, nomeFantasia: e.target.value})}/>
              <input type="text" className="w-full p-3 border rounded-lg" placeholder="Inscrição Municipal" value={empresa.inscricaoMunicipal} onChange={e => setEmpresa({...empresa, inscricaoMunicipal: e.target.value})}/>
              <select className="w-full p-3 border rounded-lg" value={empresa.regimeTributario} onChange={e => setEmpresa({...empresa, regimeTributario: e.target.value})}>
                  <option value="MEI">MEI</option>
                  <option value="SIMPLES">Simples Nacional</option>
                  <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
              </select>
            </div>
          </div>

          <div className="p-8 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-blue-600 mb-6 flex items-center gap-2"><MapPin size={20} /> Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <input className="p-3 border rounded-lg" placeholder="CEP" value={empresa.cep} onChange={e => setEmpresa({...empresa, cep: e.target.value})}/>
                <input className="md:col-span-2 p-3 border rounded-lg" placeholder="Logradouro" value={empresa.logradouro} onChange={e => setEmpresa({...empresa, logradouro: e.target.value})}/>
                <input className="p-3 border rounded-lg" placeholder="Número" value={empresa.numero} onChange={e => setEmpresa({...empresa, numero: e.target.value})}/>
                <input className="p-3 border rounded-lg" placeholder="Bairro" value={empresa.bairro} onChange={e => setEmpresa({...empresa, bairro: e.target.value})}/>
                <input className="p-3 border rounded-lg" placeholder="Cidade" value={empresa.cidade} onChange={e => setEmpresa({...empresa, cidade: e.target.value})}/>
                <input className="p-3 border rounded-lg" placeholder="UF" value={empresa.uf} onChange={e => setEmpresa({...empresa, uf: e.target.value})}/>
                <input className="p-3 border rounded-lg bg-gray-50" placeholder="IBGE" readOnly value={empresa.codigoIbge}/>
            </div>
          </div>

          {/* === NOVA ÁREA: CONFIGURAÇÃO DE EMISSÃO (DPS) === */}
            <div className="mt-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                    ⚙️ Configuração de Numeração (DPS)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Ambiente</label>
                        <select 
                            className="w-full p-2 border rounded bg-white text-sm"
                            value={empresa.ambiente || 'HOMOLOGACAO'}
                            onChange={e => setEmpresa({...empresa, ambiente: e.target.value})}
                        >
                            <option value="HOMOLOGACAO">Homologação (Teste)</option>
                            <option value="PRODUCAO">Produção (Valendo)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Série DPS</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border rounded text-sm font-mono"
                            value={empresa.serieDPS || '900'} 
                            onChange={e => setEmpresa({...empresa, serieDPS: e.target.value})}
                            placeholder="Ex: 900"
                        />
                        <p className="text-[9px] text-slate-400 mt-1">Geralmente 900 p/ Homolog.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Último Número Usado</label>
                        <input 
                            type="number" 
                            className="w-full p-2 border rounded text-sm font-mono font-bold text-blue-700"
                            value={empresa.ultimoDPS} 
                            onChange={e => setEmpresa({...empresa, ultimoDPS: parseInt(e.target.value)})}
                        />
                        <p className="text-[9px] text-slate-400 mt-1">O sistema usará o Próximo (X + 1).</p>
                    </div>
                </div>
            </div>

          {/* --- ÁREA DO CERTIFICADO DIGITAL --- */}
          <div className="p-8 bg-slate-50">
            <h3 className="text-lg font-semibold text-slate-700 mb-6 flex items-center gap-2">
                <Lock size={20} /> Certificado Digital A1
            </h3>

            {dadosCertificado.ativo ? (
                <div className="bg-white border-l-4 border-green-500 p-6 rounded shadow-sm flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-green-700 flex items-center gap-2">
                            <CheckCircle size={20}/> Certificado Configurado
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                            Vencimento: {dadosCertificado.vencimento ? new Date(dadosCertificado.vencimento).toLocaleDateString() : 'Data desconhecida'}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">O arquivo está seguro em nosso servidor.</p>
                    </div>
                    <div className="flex gap-3">
                        {/* Botão de Trocar apenas abre o input abaixo */}
                        <button type="button" onClick={() => setDadosCertificado(prev => ({...prev, ativo: false}))} className="text-blue-600 hover:underline text-sm">Atualizar</button>
                        <button type="button" onClick={handleDeletarCertificado} className="text-red-500 hover:bg-red-50 p-2 rounded transition" title="Remover"><Trash2 size={20}/></button>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-6 rounded border border-dashed border-slate-300">
                    <label className="block text-sm font-medium text-slate-700 mb-3">Upload do Arquivo (.pfx ou .p12)</label>
                    <div className="flex flex-col md:flex-row gap-4">
                        <input 
                            type="file" 
                            accept=".pfx,.p12"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <input 
                            type="password" 
                            placeholder="Senha do Certificado"
                            value={certSenha}
                            onChange={e => setCertSenha(e.target.value)}
                            className="p-2 border rounded text-sm w-full md:w-48"
                        />
                    </div>
                    <p className="text-xs text-orange-600 mt-2">
                        * A senha é validada no momento do envio. Se estiver errada, o arquivo não será salvo.
                    </p>
                </div>
            )}
          </div>

          {/* RODAPÉ */}
          <div className="bg-white p-6 flex flex-col items-center gap-4 border-t">
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
              {loading ? 'Processando...' : <><Save size={20} /> Salvar Tudo</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}