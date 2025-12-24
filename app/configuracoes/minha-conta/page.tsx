'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Save, ArrowLeft, Mail, Phone, Calendar, CreditCard, Shield, Settings, Monitor } from 'lucide-react';

export default function MinhaContaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Estado inicial seguro
  const [data, setData] = useState({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    plano: { tipo: '', status: '', expiresAt: '' },
    perfil: { cargo: '', empresa: '', avatarUrl: '' },
    configuracoes: { darkMode: false, idioma: 'pt-BR', notificacoesEmail: true },
    metadata: { createdAt: '', lastLoginAt: '', ipOrigem: '' }
  });

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) { router.push('/login'); return; }

    fetch('/api/perfil', { headers: { 'x-user-id': userId } })
      .then(res => res.json())
      .then(apiData => {
        // Mesclamos o que veio da API com o estado inicial para evitar erros de undefined
        setData(prev => ({
            ...prev,
            ...apiData,
            plano: apiData.plano || prev.plano,
            perfil: apiData.perfil || prev.perfil,
            configuracoes: apiData.configuracoes || prev.configuracoes,
            metadata: apiData.metadata || prev.metadata
        }));
        setLoading(false);
      })
      .catch(err => { console.error(err); setLoading(false); });
  }, [router]);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const userId = localStorage.getItem('userId');
    
    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
        // Enviamos o estado completo, a API saberá o que atualizar
        body: JSON.stringify(data) 
      });

      if (res.ok) {
        setMsg('✅ Perfil atualizado com sucesso!');
        setTimeout(() => setMsg(''), 3000);
      } else {
        setMsg('❌ Erro ao atualizar.');
      }
    } catch (error) { setMsg('❌ Erro de conexão.'); } 
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Carregando perfil...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full transition">
            <ArrowLeft className="text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Minha Conta</h1>
        </div>

        <form onSubmit={handleSalvar}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* COLUNA ESQUERDA: Resumo e Plano */}
            <div className="md:col-span-1 space-y-6">
              
              {/* Card Perfil Visual */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 overflow-hidden">
                  {data.perfil.avatarUrl ? (
                      <img src={data.perfil.avatarUrl} alt="Avatar" className="w-full h-full object-cover"/>
                  ) : (
                      <User size={40} />
                  )}
                </div>
                <h2 className="font-bold text-lg text-gray-800">{data.nome}</h2>
                <p className="text-sm text-gray-500">{data.perfil.cargo || 'Sem cargo definido'}</p>
                <p className="text-xs text-blue-600 font-medium mt-1">{data.perfil.empresa}</p>
              </div>

              {/* Card Plano */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
                    <CreditCard size={14}/> Seu Plano
                </h3>
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-2xl font-black text-blue-700">{data.plano.tipo}</p>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-2 ${data.plano.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {data.plano.status}
                    </span>
                    {data.plano.expiresAt && (
                        <p className="text-xs text-gray-500 mt-2">Vence em: {new Date(data.plano.expiresAt).toLocaleDateString()}</p>
                    )}
                </div>
              </div>

              {/* Metadata (Rodapé informativo) */}
              <div className="bg-gray-100 p-4 rounded-lg text-[10px] text-gray-500 space-y-1 font-mono">
                <p>ID: {typeof window !== 'undefined' ? localStorage.getItem('userId') : '...'}</p>
                <p>Criado em: {data.metadata.createdAt ? new Date(data.metadata.createdAt).toLocaleDateString() : '-'}</p>
                <p>IP: {data.metadata.ipOrigem || 'Não registrado'}</p>
              </div>
            </div>

            {/* COLUNA DIREITA: Formulários de Edição */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Seção 1: Dados Pessoais */}
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-700 mb-6 flex items-center gap-2">
                    <User size={20}/> Dados Pessoais
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Completo</label>
                        <input className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                               value={data.nome} onChange={e => setData({...data, nome: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-gray-400" size={16} />
                            <input className="w-full pl-10 p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm" 
                                   disabled value={data.email} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPF</label>
                        <input className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm" 
                               disabled value={data.cpf} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 text-gray-400" size={16} />
                            <input className="w-full pl-10 p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                                   value={data.telefone || ''} onChange={e => setData({...data, telefone: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cargo / Função</label>
                        <input className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
                               value={data.perfil.cargo} onChange={e => setData({...data, perfil: {...data.perfil, cargo: e.target.value}})} />
                    </div>
                </div>
              </div>

              {/* Seção 2: Preferências */}
              <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-700 mb-6 flex items-center gap-2">
                    <Settings size={20}/> Preferências
                </h3>
                
                <div className="space-y-4">
                    {/* Toggle Dark Mode */}
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-full"><Monitor size={18} className="text-gray-600"/></div>
                            <div>
                                <p className="font-medium text-sm text-gray-800">Modo Escuro (Dark Mode)</p>
                                <p className="text-xs text-gray-500">Altera a aparência para cores escuras.</p>
                            </div>
                        </div>
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            checked={data.configuracoes.darkMode}
                            onChange={e => setData({...data, configuracoes: {...data.configuracoes, darkMode: e.target.checked}})}
                        />
                    </div>

                    {/* Toggle Notificações */}
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-full"><Mail size={18} className="text-gray-600"/></div>
                            <div>
                                <p className="font-medium text-sm text-gray-800">Notificações por Email</p>
                                <p className="text-xs text-gray-500">Receber alertas sobre notas emitidas.</p>
                            </div>
                        </div>
                        <input 
                            type="checkbox" 
                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            checked={data.configuracoes.notificacoesEmail}
                            onChange={e => setData({...data, configuracoes: {...data.configuracoes, notificacoesEmail: e.target.checked}})}
                        />
                    </div>

                    {/* Select Idioma */}
                    <div className="pt-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Idioma do Sistema</label>
                        <select 
                            className="w-full p-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                            value={data.configuracoes.idioma}
                            onChange={e => setData({...data, configuracoes: {...data.configuracoes, idioma: e.target.value}})}
                        >
                            <option value="pt-BR">Português (Brasil)</option>
                            <option value="en-US">English (US)</option>
                            <option value="es-ES">Español</option>
                        </select>
                    </div>
                </div>
              </div>

              {/* Botão de Ação */}
              <div className="flex justify-between items-center pt-4">
                <span className={`text-sm font-medium transition-opacity duration-300 ${msg ? 'opacity-100' : 'opacity-0'} ${msg.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                    {msg}
                </span>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-bold shadow-lg shadow-blue-100 disabled:opacity-70 disabled:cursor-not-allowed"
                >
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