'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Save, ArrowLeft, Mail, Phone, CreditCard, Settings, Monitor, X, RefreshCcw, Calendar, TrendingUp } from 'lucide-react';
import PlanSelector from '@/components/PlanSelector';
import { useAppConfig } from '@/app/contexts/AppConfigContext';

export default function MinhaContaPage() {
  const router = useRouter();
  const { darkMode, toggleDarkMode, language, changeLanguage } = useAppConfig();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showPlans, setShowPlans] = useState(false);

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
    planoCiclo: 'MENSAL'
  });

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token'); // <--- 1. Pega o Token

    if (!userId || !token) { router.push('/login'); return; }

    fetch('/api/perfil', { 
        headers: { 
            'x-user-id': userId,
            'Authorization': `Bearer ${token}` // <--- 2. Envia o Token
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
            planoDetalhado: apiData.planoDetalhado || prev.planoDetalhado,
            planoCiclo: apiData.planoCiclo || 'MENSAL'
        }));

        if (apiData.configuracoes) {
            toggleDarkMode(apiData.configuracoes.darkMode);
            if(apiData.configuracoes.idioma) changeLanguage(apiData.configuracoes.idioma);
        }
        setLoading(false);
      })
      .catch(err => { 
          console.error(err); 
          if(err.message === "Sessão expirada") router.push('/login');
          setLoading(false); 
      });
  }, [router]);

  // ... (RESTANTE DO CÓDIGO PERMANECE IGUAL) ...
  // Lembre-se de verificar se as funções 'handleSalvar' ou 'handlePlanChange' 
  // também precisam do token. Normalmente sim.
  
  const handlePlanChange = async (newSlug: string, newCiclo: string) => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token'); // <--- Token
    try {
        const res = await fetch('/api/admin/users', { 
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json', 
                'x-user-id': userId || '',
                'Authorization': `Bearer ${token}` // <--- Token
            },
            body: JSON.stringify({ id: userId, plano: newSlug, planoCiclo: newCiclo }) 
        });
        // ... (resto da função)
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
      const token = localStorage.getItem('token'); // <--- Token
      try {
        const { planoDetalhado, planoCiclo, ...restData } = data;
        const payload = {
            ...restData,
            configuracoes: {
                ...restData.configuracoes,
                darkMode: darkMode,
                idioma: language
            }
        };

        const res = await fetch('/api/perfil', {
          method: 'PUT',
          headers: { 
              'Content-Type': 'application/json', 
              'x-user-id': userId || '',
              'Authorization': `Bearer ${token}` // <--- Token
          },
          body: JSON.stringify(payload) 
        });
        if (res.ok) { setMsg('✅ Salvo!'); setTimeout(() => setMsg(''), 3000); }
      } catch(e) {} finally { setSaving(false); }
  };
  
  const handleResetTutorial = async () => {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      if(!userId) return;
      try {
          await fetch('/api/perfil/tutorial', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json', 
                  'x-user-id': userId,
                  'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify({ step: 0 }) 
          });
          window.location.reload(); 
      } catch (e) {}
  };

  // ... (RETORNO DO JSX PERMANECE O MESMO) ...
  // Apenas copie o JSX do arquivo original abaixo desta linha se necessário
  
  // Cálculos visuais
  const p = data.planoDetalhado;
  const isIlimitado = p.limiteEmissoes === 0;
  const percentUso = isIlimitado ? 0 : Math.min(100, (p.usoEmissoes / p.limiteEmissoes) * 100);
  const dataFimFormatada = p.dataFim ? new Date(p.dataFim).toLocaleDateString() : 'Vitalício / Recorrente';

  if (loading) return <div className="p-10 text-center text-gray-500">Carregando perfil...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 relative transition-colors duration-300">
      
      {showPlans && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto dark:bg-slate-800 dark:text-white">
                <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10 dark:bg-slate-800 dark:border-slate-700">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Alterar Assinatura</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Escolha o plano ideal para o seu negócio.</p>
                    </div>
                    <button onClick={() => setShowPlans(false)} className="p-2 hover:bg-gray-100 rounded-full transition dark:hover:bg-slate-700">
                        <X size={24} className="text-gray-500 dark:text-gray-400"/>
                    </button>
                </div>
                <div className="p-8 bg-gray-50 dark:bg-slate-900">
                    <PlanSelector 
                        currentPlan={p.slug} 
                        currentCycle={data.planoCiclo}
                        onSelectPlan={handlePlanChange}
                    />
                </div>
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
              
              {/* CARD DE PERFIL */}
              <div className="tour-perfil-card bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center dark:bg-slate-800 dark:border-slate-700">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 overflow-hidden text-2xl font-bold">
                   {data.nome.charAt(0)}
                </div>
                <h2 className="font-bold text-lg text-gray-800 dark:text-white">{data.nome}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{data.perfil.cargo || 'Cliente'}</p>
              </div>

              {/* CARD DE ASSINATURA DETALHADO */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden dark:bg-slate-800 dark:border-slate-700 flex flex-col gap-4">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2 dark:text-gray-500">
                        <CreditCard size={14}/> Assinatura
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${p.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.status}
                    </span>
                </div>

                <div>
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{p.nome}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{data.planoCiclo}</p>
                </div>

                {/* INFO DE USO */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm space-y-3 dark:bg-slate-900 dark:border-slate-700">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><TrendingUp size={12}/> Emissões</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {p.usoEmissoes} / {isIlimitado ? '∞' : p.limiteEmissoes}
                            </span>
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

              <div className="bg-gray-100 p-4 rounded-lg text-[10px] text-gray-500 space-y-1 font-mono dark:bg-slate-800 dark:text-gray-400">
                <p>ID: {typeof window !== 'undefined' ? localStorage.getItem('userId')?.substring(0,8) : '...'}</p>
                <p>Criado em: {data.metadata.createdAt ? new Date(data.metadata.createdAt).toLocaleDateString() : '-'}</p>
              </div>
            </div>

            <div className="md:col-span-2 space-y-6">
              
              {/* DADOS PESSOAIS */}
              <div className="tour-dados-pessoais bg-white p-8 rounded-xl shadow-sm border border-gray-100 dark:bg-slate-800 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-700 mb-6 flex items-center gap-2 dark:text-white">
                    <User size={20}/> Dados Pessoais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Nome Completo</label>
                        <input className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                               value={data.nome} onChange={e => setData({...data, nome: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-gray-400" size={16} />
                            <input className="w-full pl-10 p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-gray-400" 
                                   disabled value={data.email} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">CPF</label>
                        <input className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-gray-400" 
                               disabled value={data.cpf} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Telefone</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 text-gray-400" size={16} />
                            <input className="w-full pl-10 p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                                   value={data.telefone || ''} onChange={e => setData({...data, telefone: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Cargo / Função</label>
                        <input className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                               value={data.perfil.cargo} onChange={e => setData({...data, perfil: {...data.perfil, cargo: e.target.value}})} />
                    </div>
                </div>
              </div>

              {/* PREFERÊNCIAS */}
              <div className="tour-preferencias bg-white p-8 rounded-xl shadow-sm border border-gray-100 dark:bg-slate-800 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-gray-700 mb-6 flex items-center gap-2 dark:text-white">
                    <Settings size={20}/> Preferências
                </h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition cursor-pointer dark:border-slate-600 dark:hover:bg-slate-700" onClick={() => toggleDarkMode(!darkMode)}>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-full dark:bg-slate-600"><Monitor size={18} className="text-gray-600 dark:text-gray-300"/></div>
                            <div>
                                <p className="font-medium text-sm text-gray-800 dark:text-white">Modo Escuro (Dark Mode)</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Altera a aparência para cores escuras.</p>
                            </div>
                        </div>
                        <div className={`w-10 h-5 rounded-full p-1 transition-colors duration-300 ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
                            <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform duration-300 ${darkMode ? 'translate-x-5' : ''}`}></div>
                        </div>
                    </div>
                    
                    <div className="pt-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1 dark:text-gray-400">Idioma do Sistema</label>
                        <select className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                            value={language} onChange={e => changeLanguage(e.target.value as any)}>
                            <option value="pt-BR">Português (Brasil)</option>
                            <option value="en-US">English (US)</option>
                            <option value="es-ES">Español</option>
                        </select>
                    </div>

                    <div className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-700">
                        <button 
                            type="button" 
                            onClick={handleResetTutorial} 
                            className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-blue-600 transition w-full group"
                            title="Reiniciar Tutorial"
                        >
                            <div className="p-1.5 bg-gray-100 rounded-full group-hover:bg-blue-50 group-hover:text-blue-600 transition dark:bg-slate-700">
                                <RefreshCcw size={14}/> 
                            </div>
                            Reiniciar Tutorial de Boas-vindas
                        </button>
                    </div>
                </div>
              </div>

              {/* BOTÃO SALVAR */}
              <div className="flex justify-between items-center pt-4">
                <span className={`text-sm font-medium transition-opacity duration-300 ${msg ? 'opacity-100' : 'opacity-0'} ${msg.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                    {msg}
                </span>
                <button type="submit" disabled={saving} className="tour-save-btn bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-bold shadow-lg shadow-blue-100 disabled:opacity-70 disabled:cursor-not-allowed dark:shadow-none">
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