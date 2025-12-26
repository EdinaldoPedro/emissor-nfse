'use client';
import { useEffect, useState } from 'react';
import { Edit, Save, X, Check, Plus, Trash2 } from 'lucide-react';

export default function AdminPlanos() {
  const [plans, setPlans] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null); // Se tiver ID é edição, senão é criação

  const carregar = () => {
    fetch('/api/admin/plans').then(r => r.json()).then(setPlans);
  };

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
      setEditing({
          name: '',
          slug: '',
          description: '',
          priceMonthly: 0,
          priceYearly: 0,
          features: '',
          active: true,
          recommended: false
      });
  }

  const handleSave = async () => {
    // Se tem ID, usa PUT (atualizar), se não tem, usa POST (criar)
    const method = editing.id ? 'PUT' : 'POST';
    
    const res = await fetch('/api/admin/plans', {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing)
    });

    if (res.ok) {
        setEditing(null);
        carregar();
        alert(editing.id ? "Plano atualizado!" : "Plano criado!");
    } else {
        alert('Erro ao salvar');
    }
  };

  const handleDelete = async (id: string) => {
      if(!confirm("Tem certeza? Isso não afeta usuários que já assinaram, mas remove da vitrine.")) return;
      await fetch(`/api/admin/plans?id=${id}`, { method: 'DELETE' });
      carregar();
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Planos de Assinatura</h1>
        <button onClick={abrirNovo} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 font-bold">
            <Plus size={18}/> Novo Plano
        </button>
      </div>

      {/* MODAL DE EDIÇÃO/CRIAÇÃO */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-lg">{editing.id ? `Editar: ${editing.name}` : 'Criar Novo Plano'}</h3>
                    <button onClick={() => setEditing(null)}><X size={20}/></button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
                            <input className="w-full p-2 border rounded" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} placeholder="Ex: Gold" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Slug (Código Único)</label>
                            <input className="w-full p-2 border rounded bg-gray-50" value={editing.slug || ''} onChange={e => setEditing({...editing, slug: e.target.value.toUpperCase()})} placeholder="GOLD" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição Curta</label>
                        <input className="w-full p-2 border rounded" value={editing.description || ''} onChange={e => setEditing({...editing, description: e.target.value})} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Mensal (R$)</label>
                            <input type="number" className="w-full p-2 border rounded" value={editing.priceMonthly} onChange={e => setEditing({...editing, priceMonthly: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço Anual (R$)</label>
                            <input type="number" className="w-full p-2 border rounded" value={editing.priceYearly} onChange={e => setEditing({...editing, priceYearly: e.target.value})} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Benefícios (Separar por vírgula)</label>
                        <textarea 
                            className="w-full p-2 border rounded h-24" 
                            value={editing.features} 
                            onChange={e => setEditing({...editing, features: e.target.value})}
                        />
                    </div>

                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={editing.active} onChange={e => setEditing({...editing, active: e.target.checked})} />
                            Ativo para venda
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={editing.recommended} onChange={e => setEditing({...editing, recommended: e.target.checked})} />
                            Destacar (Recomendado)
                        </label>
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700">
                            <Save size={18}/> Salvar
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* GRID DE PLANOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(plan => (
            <div key={plan.id} className={`bg-white rounded-xl shadow-sm border relative overflow-hidden flex flex-col ${plan.recommended ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'} ${!plan.active ? 'opacity-60' : ''}`}>
                <div className="p-6 flex-1">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">{plan.name}</h3>
                            <p className="text-xs text-slate-500 font-mono">{plan.slug}</p>
                        </div>
                        {plan.recommended && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">TOP</span>}
                    </div>

                    <div className="mb-6">
                        <p className="text-3xl font-black text-slate-900">R$ {Number(plan.priceMonthly).toFixed(2)}<span className="text-sm font-normal text-slate-500">/mês</span></p>
                    </div>

                    <div className="space-y-2 mb-6">
                        {plan.features.split(',').map((feat: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                                <Check size={14} className="text-green-500 shrink-0"/> {feat.trim()}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-between">
                    <button onClick={() => handleDelete(plan.id)} className="text-red-400 hover:bg-red-50 p-2 rounded transition">
                        <Trash2 size={16}/>
                    </button>
                    <button onClick={() => setEditing(plan)} className="text-blue-600 hover:bg-blue-100 p-2 rounded flex items-center gap-2 text-sm font-bold transition">
                        <Edit size={16}/> Editar
                    </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}