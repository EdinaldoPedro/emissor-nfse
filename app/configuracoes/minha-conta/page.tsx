'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Save, ArrowLeft, Mail, Phone, CreditCard, Settings, Monitor, X, RefreshCcw, Calendar, TrendingUp, Building2, Plus } from 'lucide-react';
import PlanSelector from '@/components/PlanSelector';
import { useAppConfig } from '@/app/contexts/AppConfigContext';

export default function MinhaContaPage() {
  const router = useRouter();
  const { darkMode, toggleDarkMode, language, changeLanguage } = useAppConfig();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showPlans, setShowPlans] = useState(false);
  
  // === ESTADOS PARA NOVA EMPRESA ===
  const [showAddPJ, setShowAddPJ] = useState(false);
  const [addingPJ, setAddingPJ] = useState(false);
  const [newPJ, setNewPJ] = useState({ razaoSocial: '', documento: '' });

  const [data, setData] = useState({
    nome: '', email: '', cpf: '', telefone: '',
    perfil: { cargo: '', empresa: '', avatarUrl: '' },
    configuracoes: { darkMode: false, idioma: 'pt-BR', notificacoesEmail: true },
    metadata: { createdAt: '', lastLoginAt: '', ipOrigem: '' },
    planoDetalhado: { 
        nome: '', slug: '', status: '', 
        usoEmissoes: 0, limiteEmissoes: 0, 
        dataInicio: '', dataFim: '' 
    },
    planoCiclo: 'MENSAL',
    empresasAdicionais: 0,
    listaEmpresas: [] as any[]
  });

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token'); 

    if (!userId || !token) { router.push('/login'); return; }

    fetch('/api/perfil', { 
        headers: { 
            'x-user-id': userId,
            'Authorization': `Bearer ${token}` 
        } 
    })
      .then(res => {
          if (res.status === 401) { throw new Error("Sessão expirada"); }
          return res.json();
      })
      .then(apiData => {
        setData(prev => ({
            ...prev,
            ...apiData,
            perfil: {
                cargo: apiData.cargo || '', 
                empresa: apiData.razaoSocial || '',
                avatarUrl: ''
            },
            planoDetalhado: apiData.planoDetalhado || prev.planoDetalhado,
            planoCiclo: apiData.planoCiclo || 'MENSAL',
            empresasAdicionais: apiData.empresasAdicionais || 0,
            listaEmpresas: apiData.listaEmpresas || []
        }));

        if (apiData.configuracoes) {
            toggleDarkMode(apiData.configuracoes.darkMode);
            if(apiData.configuracoes.idioma) changeLanguage(apiData.configuracoes.idioma);
        }
        setLoading(false);
      })
      .catch(err => { 
          if(err.message === "Sessão expirada") router.push('/login');
          setLoading(false); 
      });
  }, [router]);
  
  const handlePlanChange = async (newSlug: string, newCiclo: string) => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token'); 
    try {
        const res = await fetch('/api/admin/users', { 
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id: userId, plano: newSlug, planoCiclo: newCiclo }) 
        });
        
        if(res.ok) {
            setShowPlans(false);
            setMsg('✅ Plano atualizado! Recarregando...');
            setTimeout(() => window.location.reload(), 1500);
        } else {
            alert("Erro ao alterar plano.");
        }
    } catch(e) { alert("Erro de conexão."); }
  };

  const handleSalvar = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token'); 
      try {
        const { planoDetalhado, planoCiclo, listaEmpresas, empresasAdicionais, ...restData } = data;
        const payload = {
            ...restData,
            cargo: restData.perfil.cargo, 
            configuracoes: { ...restData.configuracoes, darkMode: darkMode, idioma: language }
        };

        const res = await fetch('/api/perfil', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload) 
        });
        
        if (res.ok) { 
            setMsg('✅ Salvo!'); setTimeout(() => setMsg(''), 3000); 
        } else {
            const err = await res.json();
            alert("Erro ao salvar: " + (err.error || err.message));
        }
      } catch(e) {
          alert("Erro de conexão."); 
      } finally { setSaving(false); }
  };
  
  // === NOVA FUNÇÃO: CRIAR EMPRESA ADICIONAL ===
  const handleCreatePJ = async (e: React.FormEvent) => {
      e.preventDefault();
      setAddingPJ(true);
      const token = localStorage.getItem('token'); 
      try {
          const res = await fetch('/api/empresas/adicional', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify(newPJ)
          });
          if(res.ok) {
              alert("Empresa adicionada com sucesso!");
              window.location.reload();
          } else {
              const err = await res.json();
              alert(err.error || "Erro ao adicionar empresa.");
          }
      } catch(e) {
          alert("Erro de conexão.");
      } finally {
          setAddingPJ(false);
      }
  };

  const p = data.planoDetalhado;
  const isIlimitado = p.limiteEmissoes === 0;
  const percentUso = isIlimitado ? 0 : Math.min(100, (p.usoEmissoes / p.limiteEmissoes) * 100);
  const dataFimFormatada = p.dataFim ? new Date(p.dataFim).toLocaleDateString() : 'Vitalício / Recorrente';

  // Lógica de limite de PJs
  const empresasExtrasUsadas = data.listaEmpresas.filter(e => !e.isPrimary).length;
  const limiteAtingido = empresasExtrasUsadas >= data.empresasAdicionais;

  if (loading) return <div className="p-10 text-center text-gray-500">Carregando perfil...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 relative transition-colors duration-300">
      
      {/* MODAL PLANOS */}
      {showPlans && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
             {/* ... conteúdo do modal de planos mantido igual ... */}
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto dark:bg-slate-800">
                <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10 dark:bg-slate-800 dark:border-slate-700">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Alterar Assinatura</h2>
                    </div>
                    <button onClick={() => setShowPlans(false)} className="p-2 hover:bg-gray-100 rounded-full transition dark:hover:bg-slate-700">
                        <X size={24} className="text-gray-500 dark:text-gray-400"/>
                    </button>
                </div>
                <div className="p-8 bg-gray-50 dark:bg-slate-900">
                    <PlanSelector currentPlan={p.slug} currentCycle={data.planoCiclo} onSelectPlan={handlePlanChange} />
                </div>
            </div>
         </div>
      )}

      {/* MODAL NOVA EMPRESA */}
      {showAddPJ && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden dark:bg-slate-800">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 dark:bg-slate-900 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2"><Building2 size={20}/> Novo CNPJ</h2>
                    <button onClick={() => setShowAddPJ(false)} className="p-2 hover:bg-gray-200 rounded-full transition dark:hover:bg-slate-700">
                        <X size={20} className="text-gray-500"/>
                    </button>
                </div>
                <form onSubmit={handleCreatePJ} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Razão Social</label>
                        <input required className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                               value={newPJ.razaoSocial} onChange={e => setNewPJ({...newPJ, razaoSocial: e.target.value})} placeholder="Nome da Empresa" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CNPJ</label>
                        <input required className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                               value={newPJ.documento} onChange={e => setNewPJ({...newPJ, documento: e.target.value})} placeholder="00.000.000/0000-00" />
                    </div>
                    <button type="submit" disabled={addingPJ} className="w-full py-3 mt-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                        {addingPJ ? 'Criando...' : 'Vincular Empresa'}
                    </button>
                </form>
             </div>
         </div>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full transition dark:hover:bg-slate-800">
                    <ArrowLeft className="text-gray-600 dark:text-gray-300" />
                </button>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Minha Conta</h1>
            </div>
        </div>

        <form onSubmit={handleSalvar}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-6">
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center dark:bg-slate-800 dark:border-slate-700">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 text-2xl font-bold">
                   {data.nome.charAt(0)}
                </div>
                <h2 className="font-bold text-lg text-gray-800 dark:text-white">{data.nome}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{data.perfil.cargo || 'Cliente'}</p>
              </div>

              {/* CARD DE ASSINATURA */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden dark:bg-slate-800 dark:border-slate-700 flex flex-col gap-4">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2 dark:text-gray-500"><CreditCard size={14}/> Assinatura</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.status}</span>
                </div>
                <div>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{p.nome}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{data.planoCiclo}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm space-y-3 dark:bg-slate-900 dark:border-slate-700">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><TrendingUp size={12}/> Emissões</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{p.usoEmissoes} / {isIlimitado ? '∞' : p.limiteEmissoes}</span>
                        </div>
                        {!isIlimitado && (
                            <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                                <div className={`h-2 rounded-full transition-all duration-500 ${percentUso > 80 ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${percentUso}%`}}></div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <Calendar size={14} className="text-slate-400"/>
                        <span>Expira em: <strong>{dataFimFormatada}</strong></span>
                    </div>
                </div>
                <button type="button" onClick={() => setShowPlans(true)} className="w-full py-2 bg-blue-50 text-blue-600 font-bold text-sm rounded-lg hover:bg-blue-100 transition border border-blue-200 dark:bg-slate-700 dark:text-blue-400 dark:border-slate-600 dark:hover:bg-slate-600">
                    Trocar de Plano
                </button>
              </div>

              {/* === NOVO: CARD DE MÚLTIPLAS EMPRESAS === */}
              {data.empresasAdicionais > 0 && (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 dark:bg-slate-800 dark:border-slate-700 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                          <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2 dark:text-gray-500"><Building2 size={14}/> CNPJs Extras</h3>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
                          <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-slate-500">Limites em Uso</span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{empresasExtrasUsadas} / {data.empresasAdicionais}</span>
                          </div>
                      </div>
                      <button 
                          type="button" 
                          onClick={() => setShowAddPJ(true)} 
                          disabled={limiteAtingido}
                          className="w-full py-2 bg-gray-100 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-200 transition border border-gray-200 flex items-center justify-center gap-2 disabled:opacity-50 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600 dark:hover:bg-slate-600"
                      >
                          <Plus size={16}/> Adicionar Empresa
                      </button>
                      {limiteAtingido && <p className="text-[10px] text-red-500 text-center">Você atingiu o limite de empresas. Adquira mais pacotes para adicionar.</p>}
                  </div>
              )}

            </div>

            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 dark:bg-slate-800 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-700 mb-6 flex items-center gap-2 dark:text-white"><User size={20}/> Dados Pessoais</h3>
                {/* ... Campos de dados pessoais (iguais aos que você já tinha) ... */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                        <input className="w-full p-2.5 border rounded-lg focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-600 dark:text-white" value={data.nome} onChange={e => setData({...data, nome: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                        <input className="w-full p-2.5 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed dark:bg-slate-700 dark:border-slate-600" disabled value={data.email} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPF</label>
                        <input className="w-full p-2.5 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed dark:bg-slate-700 dark:border-slate-600" disabled value={data.cpf} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone</label>
                        <input className="w-full p-2.5 border rounded-lg focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-600 dark:text-white" value={data.telefone || ''} onChange={e => setData({...data, telefone: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cargo</label>
                        <input className="w-full p-2.5 border rounded-lg focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-600 dark:text-white" value={data.perfil.cargo} onChange={e => setData({...data, perfil: {...data.perfil, cargo: e.target.value}})} />
                    </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 dark:bg-slate-800 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-700 mb-6 flex items-center gap-2 dark:text-white"><Settings size={20}/> Preferências</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg cursor-pointer dark:border-slate-600" onClick={() => toggleDarkMode(!darkMode)}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-full dark:bg-slate-600"><Monitor size={18} className="text-gray-600 dark:text-gray-300"/></div>
                            <div>
                                <p className="font-medium text-sm text-gray-800 dark:text-white">Modo Escuro (Dark Mode)</p>
                            </div>
                        </div>
                        <div className={`w-10 h-5 rounded-full p-1 transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-3 h-3 rounded-full transform transition-transform ${darkMode ? 'translate-x-5' : ''}`}></div>
                        </div>
                    </div>
                    <div className="pt-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Idioma</label>
                        <select className="w-full p-2.5 border rounded-lg focus:ring-blue-500 bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white" value={language} onChange={e => changeLanguage(e.target.value as any)}>
                            <option value="pt-BR">Português</option>
                            <option value="en-US">English</option>
                        </select>
                    </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <span className={`text-sm font-medium transition-opacity ${msg ? 'opacity-100' : 'opacity-0'} ${msg.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>{msg}</span>
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-bold shadow-lg disabled:opacity-70 dark:shadow-none">
                  {saving ? 'Salvando...' : <><Save size={20} /> Salvar Alterações</>}
                </button>
              </div>

            </div>
          </div>
        </form>
      </div>
    </div>
  );
}