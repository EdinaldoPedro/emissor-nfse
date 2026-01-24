'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Save, ArrowLeft, Mail, Phone, CreditCard, Settings, Monitor, X, HelpCircle, RefreshCcw } from 'lucide-react';
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
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    plano: { tipo: 'GRATUITO', status: 'active', expiresAt: null, ciclo: 'MENSAL' }, 
    perfil: { cargo: '', empresa: '', avatarUrl: '' },
    configuracoes: { darkMode: false, idioma: 'pt-BR', notificacoesEmail: true },
    metadata: { createdAt: '', lastLoginAt: '', ipOrigem: '' },
    planoSlug: 'GRATUITO', 
    planoCiclo: 'MENSAL'
  });

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) { router.push('/login'); return; }

    fetch('/api/perfil', { headers: { 'x-user-id': userId } })
      .then(res => res.json())
      .then(apiData => {
        const planoObj = apiData.plano || {};
        const slugReal = planoObj.tipo || 'GRATUITO'; 
        const cicloReal = apiData.planoCiclo || 'MENSAL';

        setData(prev => ({
            ...prev,
            ...apiData,
            planoSlug: slugReal,
            planoCiclo: cicloReal,
            plano: { 
                tipo: slugReal, 
                status: planoObj.status, 
                expiresAt: planoObj.expiresAt,
                ciclo: cicloReal
            },
            perfil: apiData.perfil || prev.perfil,
            configuracoes: apiData.configuracoes || prev.configuracoes,
            metadata: apiData.metadata || prev.metadata
        }));

        if (apiData.configuracoes) {
            toggleDarkMode(apiData.configuracoes.darkMode);
            if(apiData.configuracoes.idioma) changeLanguage(apiData.configuracoes.idioma);
        }
        setLoading(false);
      })
      .catch(err => { console.error(err); setLoading(false); });
  }, [router]);

  // === BOTÃO DE REINICIAR SIMPLIFICADO ===
  const handleResetTutorial = async () => {
      const userId = localStorage.getItem('userId');
      if(!userId) return;

      if(!confirm("Reiniciar tutorial?")) return; // Simples e direto

      try {
          // 1. Zera o passo no banco (Importante: step 0 reseta tudo)
          await fetch('/api/perfil/tutorial', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
              body: JSON.stringify({ step: 0 }) 
          });
          
          // 2. Força reload para o AppTour ler o banco novamente
          window.location.href = window.location.href; 
      } catch (e) {
          alert("Erro ao reiniciar.");
      }
  };

  const handlePlanChange = async (newSlug: string, newCiclo: string) => {
    const userId = localStorage.getItem('userId');
    try {
        const res = await fetch('/api/perfil', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
            body: JSON.stringify({ plano: newSlug, planoCiclo: newCiclo }) 
        });

        if(res.ok) {
            setData(prev => ({ 
                ...prev, 
                planoSlug: newSlug, 
                planoCiclo: newCiclo, 
                plano: { ...prev.plano, tipo: newSlug, ciclo: newCiclo } 
            }));
            setShowPlans(false);
            setMsg('✅ Plano alterado com sucesso!');
            setTimeout(() => setMsg(''), 3000);
        } else {
            alert("Erro ao alterar plano.");
        }
    } catch (e) { alert("Erro de conexão."); }
  };

  const handleSalvar = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      const userId = localStorage.getItem('userId');
      try {
        const { planoSlug, planoCiclo, ...restData } = data;
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
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
          body: JSON.stringify(payload) 
        });
        if (res.ok) { setMsg('✅ Salvo!'); setTimeout(() => setMsg(''), 3000); }
      } catch(e) {} finally { setSaving(false); }
  };

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
                        currentPlan={data.planoSlug} 
                        currentCycle={data.planoCiclo}
                        onSelectPlan={handlePlanChange}
                    />
                </div>
            </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full transition dark:hover:bg-slate-800">
                    <ArrowLeft className="text-gray-600 dark:text-gray-300" />
                </button>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Minha Conta</h1>
            </div>

            <button 
                onClick={handleResetTutorial}
                className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition border border-blue-200"
            >
                <HelpCircle size={16}/> Reiniciar Tutorial
            </button>
        </div>

        <form onSubmit={handleSalvar}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="md:col-span-1 space-y-6">
              {/* TOUR ALVO: Perfil */}
              <div className="tour-perfil-card bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center dark:bg-slate-800 dark:border-slate-700">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 overflow-hidden">
                  {data.perfil.avatarUrl ? (
                      <img src={data.perfil.avatarUrl} alt="Avatar" className="w-full h-full object-cover"/>
                  ) : (
                      <User size={40} />
                  )}
                </div>
                <h2 className="font-bold text-lg text-gray-800 dark:text-white">{data.nome}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{data.perfil.cargo || 'Sem cargo definido'}</p>
                <p className="text-xs text-blue-600 font-medium mt-1">{data.perfil.empresa}</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2 dark:text-gray-500">
                    <CreditCard size={14}/> Assinatura Atual
                </h3>
                <div className="text-center">
                    <p className="text-2xl font-black text-slate-800 dark:text-white">{data.planoSlug}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{data.planoCiclo}</p>
                    <button type="button" onClick={() => setShowPlans(true)} className="w-full py-2 bg-blue-50 text-blue-600 font-bold text-sm rounded-lg hover:bg-blue-100 transition border border-blue-200 dark:bg-slate-700 dark:text-blue-400 dark:border-slate-600 dark:hover:bg-slate-600">
                        Trocar de Plano
                    </button>
                </div>
              </div>

              <div className="bg-gray-100 p-4 rounded-lg text-[10px] text-gray-500 space-y-1 font-mono dark:bg-slate-800 dark:text-gray-400">
                <p>ID: {typeof window !== 'undefined' ? localStorage.getItem('userId') : '...'}</p>
                <p>Criado em: {data.metadata.createdAt ? new Date(data.metadata.createdAt).toLocaleDateString() : '-'}</p>
                <p>IP: {data.metadata.ipOrigem || 'Não registrado'}</p>
              </div>
            </div>

            <div className="md:col-span-2 space-y-6">
              {/* TOUR ALVO: Dados Pessoais */}
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

              {/* TOUR ALVO: Preferências */}
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
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition dark:border-slate-600 dark:hover:bg-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-full dark:bg-slate-600"><Mail size={18} className="text-gray-600 dark:text-gray-300"/></div>
                            <div>
                                <p className="font-medium text-sm text-gray-800 dark:text-white">Notificações por Email</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Receber alertas sobre notas emitidas.</p>
                            </div>
                        </div>
                        <input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:bg-slate-900 dark:border-slate-600"
                            checked={data.configuracoes.notificacoesEmail} onChange={e => setData({...data, configuracoes: {...data.configuracoes, notificacoesEmail: e.target.checked}})} />
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
                </div>
              </div>

              {/* TOUR ALVO: Botão Salvar */}
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