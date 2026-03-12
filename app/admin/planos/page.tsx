'use client';
import { useEffect, useState } from 'react';
import { Edit, Save, X, Check, Plus, Trash2, Shield, RefreshCw, Package, Star } from 'lucide-react';
import { useDialog } from '@/app/contexts/DialogContext';

export default function AdminPlanos() {
  const dialog = useDialog();
  const [plans, setPlans] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'PLANO' | 'PACOTE'>('PLANO');
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const carregar = () => {
    setLoading(true);
    const token = localStorage.getItem('token'); 
    fetch('/api/plans?visao=admin', { headers: { 'Authorization': `Bearer ${token}` }})
        .then(async (r) => {
            const data = await r.json();
            if (r.ok && Array.isArray(data)) setPlans(data);
            else setPlans([]);
        })
        .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
      setEditing({
          name: '', slug: '', description: '',
          priceMonthly: 0, priceYearly: 0,
          features: '[]', active: true, recommended: false,
          privado: false, maxNotasMensal: 0, diasTeste: 0, maxClientes: 0,
          tipo: activeTab === 'PACOTE' ? 'PACOTE_CLIENTES' : 'PLANO'
      });
  }

  const handleSave = async () => {
    const method = editing.id ? 'PUT' : 'POST';
    const token = localStorage.getItem('token'); 
    
    // Leitura segura do JSON
    let parsedFeatures = editing.features;
    try { 
        JSON.parse(editing.features); 
    } catch { 
        parsedFeatures = JSON.stringify(editing.features.split(',').map((f:string) => f.trim()).filter(Boolean)); 
    }

    try {
        const res = await fetch('/api/plans', {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ ...editing, features: parsedFeatures })
        });
        if (res.ok) { setEditing(null); await carregar(); dialog.showAlert({ type: 'success', description: "Salvo com sucesso!" }); } 
        else { const err = await res.json(); dialog.showAlert({ type: 'danger', description: err.error }); }
    } catch (e) { dialog.showAlert("Erro de conexão."); }
  };

  const handleDelete = async (id: string) => {
      if(!await dialog.showConfirm({ title: 'Excluir', description: 'Tem certeza?', type: 'danger', confirmText: 'Excluir' })) return;
      const token = localStorage.getItem('token'); 
      try {
          const res = await fetch(`/api/plans?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
          if (res.ok) { await carregar(); dialog.showAlert({ type: 'success', description: "Removido." }); } 
          else { const data = await res.json(); dialog.showAlert({ type: 'danger', description: data.error }); }
      } catch(e) { dialog.showAlert("Erro ao excluir."); }
  }

  // Filtra de acordo com a aba selecionada
  const filteredItems = plans.filter(p => activeTab === 'PLANO' ? p.tipo === 'PLANO' : p.tipo !== 'PLANO');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Catálogo de Vendas</h1>
        <div className="flex gap-2">
            <button onClick={carregar} className="bg-white border border-slate-200 px-3 py-2 rounded hover:bg-slate-50 transition"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/></button>
            <button onClick={abrirNovo} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 font-bold shadow-sm transition"><Plus size={18}/> {activeTab === 'PLANO' ? 'Novo Plano' : 'Novo Pacote'}</button>
        </div>
      </div>

      {/* TABS DE NAVEGAÇÃO */}
      <div className="flex gap-6 mb-8 border-b border-slate-200">
        <button onClick={() => setActiveTab('PLANO')} className={`pb-3 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${activeTab === 'PLANO' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Star size={16}/> Planos de Assinatura
        </button>
        <button onClick={() => setActiveTab('PACOTE')} className={`pb-3 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${activeTab === 'PACOTE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Package size={16}/> Pacotes Avulsos (Add-ons)
        </button>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between mb-4 border-b pb-4">
                    <h3 className="font-bold text-lg text-slate-800">{editing.id ? `Editar: ${editing.name}` : 'Criar Novo'}</h3>
                    <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Produto</label>
                        <select className="w-full p-2 border rounded focus:ring-blue-500 outline-none bg-slate-50 font-bold" value={editing.tipo} onChange={e => setEditing({...editing, tipo: e.target.value})}>
                            <option value="PLANO">Plano de Assinatura (Mensal/Anual)</option>
                            <option value="PACOTE_CLIENTES">Pacote Adicional de Clientes (+5, +10)</option>
                            <option value="PACOTE_NOTAS">Pacote Adicional de Notas (+3, +5, +10)</option>
                            <option value="PACOTE_PJ">Pacote de PJ Adicional (+1 CNPJ)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Comercial</label><input className="w-full p-2 border rounded focus:ring-blue-500 outline-none" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} /></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Slug (ID Único)</label><input className="w-full p-2 border rounded bg-gray-50 font-mono text-sm focus:ring-blue-500 outline-none" value={editing.slug || ''} onChange={e => setEditing({...editing, slug: e.target.value.toUpperCase()})} /></div>
                    </div>

                    <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição Curta</label><input className="w-full p-2 border rounded focus:ring-blue-500 outline-none" value={editing.description || ''} onChange={e => setEditing({...editing, description: e.target.value})} /></div>
                    
                    <div className="grid grid-cols-2 gap-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        {editing.tipo === 'PLANO' ? (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Ciclo de Cobrança</label>
                                    <select 
                                        className="w-full p-2 border rounded focus:ring-blue-500 outline-none bg-white"
                                        value={Number(editing.priceYearly) > 0 ? 'ANUAL' : 'MENSAL'}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const precoAtual = Number(editing.priceYearly) > 0 ? editing.priceYearly : editing.priceMonthly;
                                            // Limpa o campo oposto para evitar preços duplicados
                                            if (val === 'ANUAL') setEditing({...editing, priceYearly: precoAtual, priceMonthly: 0});
                                            else setEditing({...editing, priceMonthly: precoAtual, priceYearly: 0});
                                        }}
                                    >
                                        <option value="MENSAL">Mensal</option>
                                        <option value="ANUAL">Anual</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Preço (R$)</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-2 border rounded focus:ring-blue-500 outline-none" 
                                        value={Number(editing.priceYearly) > 0 ? editing.priceYearly : editing.priceMonthly} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (Number(editing.priceYearly) > 0) setEditing({...editing, priceYearly: val, priceMonthly: 0});
                                            else setEditing({...editing, priceMonthly: val, priceYearly: 0});
                                        }} 
                                    />
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Preço Único do Pacote (R$)</label>
                                <input 
                                    type="number" 
                                    className="w-full p-2 border rounded focus:ring-blue-500 outline-none" 
                                    value={editing.priceMonthly} 
                                    onChange={e => setEditing({...editing, priceMonthly: e.target.value, priceYearly: 0})} 
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                        <div><label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Limite Notas</label><input type="number" className="w-full p-2 border rounded focus:ring-yellow-500 outline-none" value={editing.maxNotasMensal} onChange={e => setEditing({...editing, maxNotasMensal: e.target.value})} /></div>
                        <div><label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Limite Clientes</label><input type="number" className="w-full p-2 border rounded focus:ring-yellow-500 outline-none" value={editing.maxClientes} onChange={e => setEditing({...editing, maxClientes: e.target.value})} /></div>
                        {editing.tipo === 'PLANO' && (
                            <div><label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Dias Teste</label><input type="number" className="w-full p-2 border rounded focus:ring-yellow-500 outline-none" value={editing.diasTeste} onChange={e => setEditing({...editing, diasTeste: e.target.value})} /></div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Benefícios (JSON Array)</label>
                        <textarea className="w-full p-2 border rounded h-20 text-sm font-mono focus:ring-blue-500 outline-none" value={editing.features} onChange={e => setEditing({...editing, features: e.target.value})} />
                    </div>

                    <div className="flex gap-6 border-t pt-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none"><input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={editing.active} onChange={e => setEditing({...editing, active: e.target.checked})} /><span className="font-bold text-slate-700">Ativo</span></label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none"><input type="checkbox" className="w-4 h-4 text-purple-600 rounded" checked={editing.recommended} onChange={e => setEditing({...editing, recommended: e.target.checked})} /><span className="text-purple-600 font-bold">Destaque</span></label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none"><input type="checkbox" className="w-4 h-4 text-slate-600 rounded" checked={editing.privado} onChange={e => setEditing({...editing, privado: e.target.checked})} /><span className="text-slate-500 font-bold flex items-center gap-1"><Shield size={12}/> Oculto</span></label>
                    </div>

                    <div className="mt-6 flex justify-end gap-2"><button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 font-bold shadow-md"><Save size={18}/> Salvar</button></div>
                </div>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredItems.length === 0 && !loading && (
            <div className="col-span-full text-center p-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
                Nenhum item cadastrado nesta categoria.
            </div>
        )}
        
        {filteredItems.map(plan => {
            const isAnual = Number(plan.priceMonthly) === 0 && Number(plan.priceYearly) > 0 && plan.tipo === 'PLANO';
            const price = isAnual ? Number(plan.priceYearly) : Number(plan.priceMonthly);
            const label = plan.tipo === 'PLANO' ? (isAnual ? '/ano' : '/mês') : ' único';
            
            let featuresList: string[] = [];
            try { featuresList = JSON.parse(plan.features); } catch { featuresList = plan.features ? String(plan.features).split(',') : []; }

            return (
                <div key={plan.id} className={`bg-white rounded-xl shadow-sm border relative overflow-hidden flex flex-col ${plan.recommended ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'} ${!plan.active ? 'opacity-60 grayscale' : ''}`}>
                    <div className="p-6 flex-1">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    {plan.tipo !== 'PLANO' && <Package size={16} className="text-amber-500"/>}
                                    {plan.name}
                                </h3>
                                <p className="text-xs text-slate-500 font-mono">{plan.slug}</p>
                            </div>
                            {plan.recommended && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">TOP</span>}
                        </div>

                        <div className="mb-4">
                            {price === 0 && !isAnual ? (
                                <p className="text-3xl font-black text-green-600">Grátis</p>
                            ) : (
                                <p className="text-3xl font-black text-slate-900">{price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}<span className="text-sm font-normal text-slate-500">{label}</span></p>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                            {plan.maxNotasMensal > 0 && (
                                <span className={`text-[10px] px-2 py-1 rounded font-bold border bg-slate-100 text-slate-600 border-slate-200`}>+{plan.maxNotasMensal} Notas</span>
                            )}
                            {plan.maxClientes > 0 && (
                                <span className="text-[10px] px-2 py-1 rounded font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">+{plan.maxClientes} Clientes</span>
                            )}
                        </div>

                        <div className="space-y-2 mb-6">
                            {featuresList.map((feat: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                    <Check size={14} className="text-green-500 mt-0.5 shrink-0"/> {feat.trim()}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                        <button onClick={() => handleDelete(plan.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition"><Trash2 size={18}/></button>
                        <button onClick={() => setEditing(plan)} className="text-blue-600 hover:bg-blue-100 px-4 py-2 rounded flex items-center gap-2 text-sm font-bold transition"><Edit size={16}/> Editar</button>
                    </div>
                </div>
            )
        })}
      </div>
    </div>
  );
}