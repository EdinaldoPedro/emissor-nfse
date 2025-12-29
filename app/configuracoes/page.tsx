'use client';

import { useState, useEffect } from 'react';
import { 
  Building2, Save, ArrowLeft, Search, MapPin, Briefcase, 
  Lock, CheckCircle, Trash2, ShieldAlert, RefreshCw, Upload, FileKey, Edit 
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ConfiguracoesEmpresa() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState<{texto: string, tipo: 'sucesso' | 'erro'} | null>(null);
  
  // Controle de Bloqueio (Apenas para CNPJ)
  const [isLocked, setIsLocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [atividades, setAtividades] = useState<any[]>([]); 

  // Certificado
  const [certFile, setCertFile] = useState<string | null>(null);
  const [certSenha, setCertSenha] = useState('');
  const [dadosCertificado, setDadosCertificado] = useState<{ativo: boolean, vencimento: string | null}>({ ativo: false, vencimento: null });
  const [modoEdicaoCertificado, setModoEdicaoCertificado] = useState(false); // Novo estado para exibir o input

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
    email: ''
  });

  const showMessage = (texto: string, tipo: 'sucesso' | 'erro') => {
      setMsg({ texto, tipo });
      setTimeout(() => setMsg(null), 3000);
  };

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
          
          setDadosCertificado({
              ativo: dados.temCertificado,
              vencimento: dados.vencimentoCertificado
          });

          // Se não tem certificado, já abre o modo de edição/upload por padrão
          if (!dados.temCertificado) setModoEdicaoCertificado(true);

          const admin = ['ADMIN', 'MASTER', 'SUPORTE'].includes(dados.role);
          setIsAdmin(admin);
          if (dados.cadastroCompleto && !admin) setIsLocked(true);
        }
      } catch (error) { console.error("Erro ao carregar perfil"); }
    }
    carregarDados();
  }, [router]);

  const consultarCNPJ = async (forcarAtualizacao = false) => {
    const docLimpo = empresa.documento.replace(/\D/g, '');
    if (isLocked && !forcarAtualizacao) return; 
    if (docLimpo.length !== 14) { alert("CNPJ inválido."); return; }

    setBuscando(true);
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
          codigoIbge: dados.codigoIbge,
          email: dados.email || prev.email 
        }));
        setAtividades(dados.cnaes || []);
        showMessage('✅ Dados atualizados com base na Receita Federal!', 'sucesso');
      } else { showMessage('❌ ' + (dados.error || 'Erro ao buscar dados.'), 'erro'); }
    } catch (error) { showMessage('❌ Erro de conexão.', 'erro'); } 
    finally { setBuscando(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64String = (reader.result as string).split(',')[1];
              setCertFile(base64String);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleDeletarCertificado = async () => {
      if(!confirm("Tem certeza? Sem o certificado você não poderá emitir notas.")) return;
      await handleSalvar(null, { deletarCertificado: true });
      window.location.reload();
  };

  const handleSalvar = async (e: React.FormEvent | null, extraData: any = {}) => {
    if (e) e.preventDefault();
    setLoading(true);
    const userId = localStorage.getItem('userId');

    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
        body: JSON.stringify({ 
            ...empresa, 
            cnaes: atividades,
            certificadoArquivo: certFile, 
            certificadoSenha: certSenha,
            ...extraData
        }),
      });

      const resposta = await res.json();

      if (res.ok) {
        showMessage('✅ Cadastro salvo com sucesso!', 'sucesso');
        if (certFile || extraData.deletarCertificado) {
            setTimeout(() => window.location.reload(), 1500);
        }
      } else { showMessage(`❌ ${resposta.error || 'Erro ao salvar.'}`, 'erro'); }
    } catch (error) { showMessage('❌ Erro de conexão.', 'erro'); } 
    finally { setLoading(false); }
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

        {isLocked && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6 rounded shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-start gap-3">
                    <ShieldAlert className="text-orange-600 shrink-0 mt-1" size={24} />
                    <div>
                        <h3 className="font-bold text-orange-800">Cadastro Vinculado</h3>
                        <p className="text-sm text-orange-700">O CNPJ está protegido. Você pode atualizar o endereço ou certificado.</p>
                    </div>
                </div>
                <button onClick={() => consultarCNPJ(true)} disabled={buscando} className="flex items-center gap-2 bg-white text-orange-700 border border-orange-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-100 transition shadow-sm w-full md:w-auto justify-center">
                    <RefreshCw size={16} className={buscando ? 'animate-spin' : ''} />
                    {buscando ? 'Buscando...' : 'Atualizar Dados da Receita'}
                </button>
            </div>
        )}

        <form onSubmit={handleSalvar} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          
          {/* SEÇÃO 1: DADOS */}
          <div className="p-8 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-blue-600 mb-6 flex items-center gap-2">
              <Briefcase size={20} /> Dados Cadastrais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">CNPJ</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Building2 className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input type="text" className={`w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono ${isLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} placeholder="00000000000191" value={empresa.documento || ''} onChange={e => setEmpresa({...empresa, documento: e.target.value})} maxLength={18} disabled={isLocked} />
                  </div>
                  {!isLocked && (
                      <button type="button" onClick={() => consultarCNPJ(false)} disabled={buscando} className="bg-blue-100 text-blue-700 px-6 py-2 rounded-lg font-medium hover:bg-blue-200 transition flex items-center gap-2 disabled:opacity-50">
                        {buscando ? '...' : <><Search size={20} /> Buscar</>}
                      </button>
                  )}
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Razão Social</label><input type="text" className="w-full p-3 border rounded-lg bg-gray-50" value={empresa.razaoSocial || ''} onChange={e => setEmpresa({...empresa, razaoSocial: e.target.value})} readOnly={isLocked}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Nome Fantasia</label><input type="text" className="w-full p-3 border rounded-lg bg-gray-50" value={empresa.nomeFantasia || ''} onChange={e => setEmpresa({...empresa, nomeFantasia: e.target.value})} readOnly={isLocked}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Inscrição Municipal</label><input type="text" className="w-full p-3 border rounded-lg" placeholder="Ex: 12345" value={empresa.inscricaoMunicipal || ''} onChange={e => setEmpresa({...empresa, inscricaoMunicipal: e.target.value})}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Regime Tributário</label><select className="w-full p-3 border rounded-lg" value={empresa.regimeTributario || 'MEI'} onChange={e => setEmpresa({...empresa, regimeTributario: e.target.value})}><option value="MEI">Microempreendedor Individual (MEI)</option><option value="SIMPLES">Simples Nacional</option><option value="LUCRO_PRESUMIDO">Lucro Presumido</option></select></div>
              <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center mb-2"><h4 className="text-sm font-bold text-blue-700 flex items-center gap-2">📋 Atividades Econômicas (CNAEs)</h4><span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">{atividades.length} atividades</span></div>
                {atividades.length === 0 ? <p className="text-xs text-gray-500 italic p-2">Nenhuma atividade carregada.</p> : <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">{atividades.map((cnae, idx) => <div key={idx} className="flex items-start gap-2 text-xs bg-white p-3 rounded border border-blue-100 shadow-sm"><span className={`font-bold px-2 py-1 rounded text-[10px] uppercase tracking-wide ${cnae.principal ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-gray-100 text-gray-600'}`}>{cnae.principal ? 'Principal' : 'Secundário'}</span><div><span className="font-mono font-bold text-gray-800 text-sm block">{cnae.codigo}</span><span className="text-gray-600 leading-tight">{cnae.descricao}</span></div></div>)}</div>}
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: ENDEREÇO */}
          <div className="p-8 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-blue-600 mb-6 flex items-center gap-2"><MapPin size={20} /> Endereço da Empresa</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div><label className="block text-sm font-medium text-gray-700 mb-2">CEP</label><input type="text" className="w-full p-3 border rounded-lg bg-gray-50" value={empresa.cep || ''} onChange={e => setEmpresa({...empresa, cep: e.target.value})} readOnly={isLocked}/></div>
              <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-2">Logradouro</label><input type="text" className="w-full p-3 border rounded-lg bg-gray-50" value={empresa.logradouro || ''} onChange={e => setEmpresa({...empresa, logradouro: e.target.value})} readOnly={isLocked}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Número</label><input type="text" className="w-full p-3 border rounded-lg bg-gray-50" value={empresa.numero || ''} onChange={e => setEmpresa({...empresa, numero: e.target.value})} readOnly={isLocked}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Bairro</label><input type="text" className="w-full p-3 border rounded-lg bg-gray-50" value={empresa.bairro || ''} onChange={e => setEmpresa({...empresa, bairro: e.target.value})} readOnly={isLocked}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">Cidade</label><input type="text" className="w-full p-3 border rounded-lg bg-gray-50" value={empresa.cidade || ''} onChange={e => setEmpresa({...empresa, cidade: e.target.value})} readOnly={isLocked}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-2">UF</label><input type="text" className="w-full p-3 border rounded-lg bg-gray-50" maxLength={2} value={empresa.uf || ''} onChange={e => setEmpresa({...empresa, uf: e.target.value})} readOnly={isLocked}/></div>
            </div>
          </div>

          {/* SEÇÃO 3: CERTIFICADO DIGITAL */}
          <div className="p-8 bg-slate-50 border-t border-slate-200">
            <h3 className="text-lg font-semibold text-slate-700 mb-6 flex items-center gap-2">
                <Lock size={20} /> Certificado Digital A1
            </h3>

            {/* STATUS DO CERTIFICADO (Se existir) */}
            {dadosCertificado.ativo && (
                <div className="bg-white border-l-4 border-green-500 p-6 rounded shadow-sm mb-6 flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-green-700 flex items-center gap-2 text-lg">
                            <CheckCircle size={24}/> Certificado Válido e Configurado
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                            Expira em: <span className="font-mono font-bold text-gray-800">{dadosCertificado.vencimento ? new Date(dadosCertificado.vencimento).toLocaleDateString() : 'Data não identificada'}</span>
                        </p>
                    </div>
                    {/* BOTÕES DE AÇÃO: EDITAR E EXCLUIR */}
                    <div className="flex gap-2">
                        <button 
                            type="button" 
                            onClick={() => setModoEdicaoCertificado(!modoEdicaoCertificado)} 
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                            title="Atualizar / Substituir"
                        >
                            <Edit size={20} />
                        </button>
                        <button 
                            type="button" 
                            onClick={handleDeletarCertificado}
                            className="p-2 text-red-500 hover:bg-red-50 rounded transition"
                            title="Excluir Certificado"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* FORMULÁRIO DE UPLOAD (Visível se não tiver cert ou se clicar no lápis) */}
            {modoEdicaoCertificado && (
                <div className="bg-white p-6 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 transition group animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-bold text-slate-700 mb-4 group-hover:text-blue-600 transition flex items-center gap-2">
                        <FileKey size={18}/> {dadosCertificado.ativo ? 'Substituir Certificado Atual' : 'Configurar Novo Certificado'}
                    </label>
                    
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg cursor-pointer transition font-medium w-full md:w-auto border ${certFile ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}>
                            {certFile ? <CheckCircle size={18}/> : <Upload size={18} />}
                            {certFile ? 'Arquivo Selecionado' : 'Escolher Arquivo (.pfx)'}
                            <input 
                                type="file" 
                                accept=".pfx,.p12" 
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </label>
                        
                        <div className="relative w-full md:w-64">
                            <Lock className="absolute left-3 top-3 text-gray-400" size={16} />
                            <input 
                                type="password" 
                                placeholder="Senha do Certificado" 
                                value={certSenha} 
                                onChange={e => setCertSenha(e.target.value)}
                                className="pl-10 p-3 border rounded-lg w-full text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                    
                    <p className="text-[10px] text-gray-400 mt-4 border-t pt-2">
                        Nota de Segurança: Sua senha é utilizada apenas para validar o certificado e assinar as notas fiscais.
                    </p>
                </div>
            )}
          </div>

          <div className="bg-gray-50 p-6 flex flex-col items-center gap-4 border-t sticky bottom-0 z-10 shadow-inner">
            {msg && (
              <div className={`px-6 py-3 rounded-lg text-sm font-bold shadow-md animate-in fade-in slide-in-from-bottom-2 ${msg.tipo === 'sucesso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {msg.texto}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full md:w-auto px-12 py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-green-200 transform hover:scale-[1.02]">
              {loading ? 'Processando...' : <><Save size={20} /> Salvar Configurações</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}