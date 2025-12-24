'use client';
import { useState, useEffect } from 'react';
import { Save, Code, Server, AlertTriangle } from 'lucide-react';

export default function AdminConfig() {
  const [config, setConfig] = useState({ modeloDpsJson: '', versaoApi: '', ambiente: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/config').then(r => r.json()).then(setConfig);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(config)
      });
      if(res.ok) setMsg('✅ Configurações salvas e aplicadas!');
      else setMsg('❌ Erro: Verifique a sintaxe do JSON.');
    } catch (e) { setMsg('❌ Erro de conexão.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Configurações do Back-end</h1>
      
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mb-6 flex gap-3 text-amber-800 text-sm">
        <AlertTriangle size={20} />
        <p>Atenção: Alterações aqui afetam a emissão de notas para <strong>todos</strong> os clientes imediatamente.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
        
        <div className="grid grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Server size={16}/> Ambiente da API Nacional
                </label>
                <select 
                    className="w-full p-2 border rounded"
                    value={config.ambiente}
                    onChange={e => setConfig({...config, ambiente: e.target.value})}
                >
                    <option value="HOMOLOGACAO">Homologação (Testes)</option>
                    <option value="PRODUCAO">Produção (Valendo)</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Versão da API</label>
                <input 
                    className="w-full p-2 border rounded" 
                    value={config.versaoApi}
                    onChange={e => setConfig({...config, versaoApi: e.target.value})}
                />
            </div>
        </div>

        <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Code size={16}/> Modelo JSON da DPS (Template Base)
            </label>
            <textarea 
                className="w-full h-96 p-4 font-mono text-xs bg-slate-900 text-green-400 rounded-lg border focus:ring-2 ring-blue-500 outline-none"
                value={config.modeloDpsJson}
                onChange={e => setConfig({...config, modeloDpsJson: e.target.value})}
                spellCheck={false}
            />
            <p className="text-xs text-slate-500 mt-2">Este JSON é usado como base para montar o XML. Use variáveis como <code>{'{{CNPJ}}'}</code> se implementar o parser.</p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm font-medium text-slate-600">{msg}</span>
            <button 
                onClick={handleSave}
                disabled={loading}
                className="bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition flex items-center gap-2 disabled:opacity-50"
            >
                {loading ? 'Salvando...' : <><Save size={18} /> Aplicar Alterações</>}
            </button>
        </div>

      </div>
    </div>
  );
}