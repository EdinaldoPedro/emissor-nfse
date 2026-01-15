'use client';

import { useState, useEffect } from 'react';
import { Save, Globe, Mail, AlertTriangle, Settings, Server, ShieldCheck, Terminal, Send, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminConfig() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'EMAIL' | 'GERAL'>('EMAIL');
  
  const [config, setConfig] = useState<any>({});
  const [loading, setLoading] = useState(true);
  
  // Estados de Ação
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false); // Novo estado para o teste
  
  const [msg, setMsg] = useState<{texto: string, tipo: 'sucesso' | 'erro'} | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    fetch('/api/admin/config', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(async (r) => {
        if (!r.ok) throw new Error("Erro ao carregar configurações");
        return r.json();
    })
    .then(data => {
        setConfig(data);
    })
    .catch(err => {
        console.error(err);
        showMessage('Erro ao carregar dados do servidor.', 'erro');
    })
    .finally(() => setLoading(false));
  }, [router]);

  const showMessage = (texto: string, tipo: 'sucesso' | 'erro') => {
      setMsg({ texto, tipo });
      setTimeout(() => setMsg(null), 5000);
  };

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem('token');

    try {
        const res = await fetch('/api/admin/config', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(config)
        });
        
        const data = await res.json();

        if (res.ok) showMessage("✅ Configurações salvas com sucesso!", 'sucesso');
        else showMessage(`❌ Erro ao salvar: ${data.error || 'Desconhecido'}`, 'erro');
    } catch (e) { 
        showMessage("❌ Erro de conexão com o servidor.", 'erro');
    }
    finally { setSaving(false); }
  };

  // === NOVA FUNÇÃO DE TESTE ===
  const handleTestEmail = async () => {
      setTesting(true);
      const token = localStorage.getItem('token');
      try {
          const res = await fetch('/api/admin/config/test-email', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(config) // Envia o que está na tela
          });

          const data = await res.json();

          if (res.ok) {
              alert(data.message); // Alerta nativo para chamar atenção
              showMessage(data.message, 'sucesso');
          } else {
              alert(`Falha no teste: ${data.details || data.error}`);
              showMessage(`❌ Falha: ${data.error}`, 'erro');
          }
      } catch (e) {
          alert("Erro de conexão ao tentar testar.");
      } finally {
          setTesting(false);
      }
  }

  if (loading) return (
      <div className="flex h-screen items-center justify-center text-slate-500 flex-col gap-2">
          <Loader2 className="animate-spin text-blue-600" size={32}/>
          <p>Carregando configurações...</p>
      </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto min-h-screen bg-slate-50">
      
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-purple-600 text-white rounded-lg shadow-md">
            <Settings size={32} />
        </div>
        <div>
            <h1 className="text-3xl font-bold text-slate-800">Configurações do SaaS</h1>
            <p className="text-slate-500">Definições globais que afetam todo o sistema, envio de e-mails e parâmetros fiscais padrão.</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 mb-6 overflow-x-auto">
          <button onClick={() => setActiveTab('EMAIL')} className={`pb-3 px-6 font-bold text-sm flex items-center gap-2 transition border-b-2 whitespace-nowrap ${activeTab === 'EMAIL' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Mail size={18}/> Servidor de E-mail (SMTP)
          </button>
          <button onClick={() => setActiveTab('GERAL')} className={`pb-3 px-6 font-bold text-sm flex items-center gap-2 transition border-b-2 whitespace-nowrap ${activeTab === 'GERAL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Globe size={18}/> API & Fiscal (Padrão)
          </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 relative">
        
        {msg && (
            <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-lg text-sm font-bold shadow-2xl animate-in fade-in slide-in-from-top-4 flex items-center gap-3 border ${msg.tipo === 'sucesso' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                {msg.tipo === 'sucesso' ? <ShieldCheck size={20} className="text-green-600"/> : <AlertTriangle size={20} className="text-red-600"/>}
                {msg.texto}
            </div>
        )}

        {activeTab === 'EMAIL' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="bg-purple-50 p-5 rounded-lg border border-purple-100 flex gap-4">
                    <div className="p-2 bg-white rounded-full h-fit text-purple-600 shadow-sm border border-purple-100">
                        <Server size={24}/>
                    </div>
                    <div>
                        <h3 className="font-bold text-purple-900 text-lg">Configuração do Servidor de Saída</h3>
                        <p className="text-sm text-purple-800 mt-1 opacity-90 leading-relaxed">
                            Configure aqui o provedor que enviará os e-mails do sistema. Use o botão de teste para validar a conexão.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Host SMTP</label>
                            <input className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="ex: smtp.gmail.com" value={config.smtpHost || ''} onChange={e => setConfig({...config, smtpHost: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Porta</label>
                            <input type="number" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="587" value={config.smtpPort || ''} onChange={e => setConfig({...config, smtpPort: parseInt(e.target.value)})} />
                        </div>
                        <div className="pt-2">
                             <label className="flex items-center gap-3 cursor-pointer p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition select-none bg-white shadow-sm">
                                <input type="checkbox" checked={config.smtpSecure || false} onChange={e => setConfig({...config, smtpSecure: e.target.checked})} className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"/>
                                <div>
                                    <span className="block text-sm font-bold text-slate-700">Usar Conexão Segura (SSL/TLS)</span>
                                    <span className="block text-xs text-slate-400">Recomendado para porta 465.</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-5">
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Usuário / E-mail de Login</label>
                            <input className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" value={config.smtpUser || ''} placeholder="usuario@provedor.com" onChange={e => setConfig({...config, smtpUser: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Senha do E-mail</label>
                            <input type="password" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="••••••••" onChange={e => setConfig({...config, smtpPass: e.target.value})} />
                            <p className="text-[10px] text-orange-500 mt-1 ml-1 font-medium">Deixe em branco para manter a senha atual salva.</p>
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Remetente Personalizado (Campo 'From')</label>
                            <input className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="ex: nao-responda@seusistema.com" value={config.emailRemetente || ''} onChange={e => setConfig({...config, emailRemetente: e.target.value})} />
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'GERAL' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-blue-50 p-5 rounded-lg border border-blue-100 flex gap-4">
                    <div className="p-2 bg-white rounded-full h-fit text-blue-600 shadow-sm border border-blue-100"><Terminal size={24}/></div>
                    <div>
                        <strong>Parâmetros Fiscais Padrão</strong>
                        <p className="text-sm text-blue-800 mt-1 opacity-90 leading-relaxed">Configurações para novas empresas e integração API.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Ambiente Padrão</label>
                        <select className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={config.ambiente || 'HOMOLOGACAO'} onChange={e => setConfig({...config, ambiente: e.target.value})}>
                            <option value="HOMOLOGACAO">Homologação</option>
                            <option value="PRODUCAO">Produção</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Versão da API</label>
                        <input className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono" value={config.versaoApi || '1.00'} onChange={e => setConfig({...config, versaoApi: e.target.value})} />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Modelo JSON do DPS</label>
                    <textarea rows={12} className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-xs bg-slate-900 text-green-400" value={config.modeloDpsJson || ''} onChange={e => setConfig({...config, modeloDpsJson: e.target.value})} />
                </div>
            </div>
        )}

        <div className="pt-8 mt-8 border-t border-gray-100 flex justify-end gap-3">
            {activeTab === 'EMAIL' && (
                <button 
                    onClick={handleTestEmail} 
                    disabled={testing}
                    className="px-6 py-4 rounded-xl text-purple-700 bg-purple-50 font-bold flex items-center gap-2 border border-purple-100 hover:bg-purple-100 transition disabled:opacity-50"
                >
                    {testing ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>} 
                    {testing ? 'Testando...' : 'Testar Conexão'}
                </button>
            )}

            <button 
                onClick={handleSave} 
                disabled={saving}
                className={`px-8 py-4 rounded-xl text-white font-bold flex items-center gap-2 shadow-lg transition transform hover:-translate-y-0.5 disabled:opacity-50 ${activeTab === 'EMAIL' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                {saving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} 
                {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
        </div>

      </div>
    </div>
  );
}