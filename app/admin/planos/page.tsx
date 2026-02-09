'use client';
import { useEffect, useState } from 'react';
import { Edit, Save, X, Check, Plus, Trash2, Shield, RefreshCw } from 'lucide-react';
import { useDialog } from '@/app/contexts/DialogContext';

export default function AdminPlanos() {
  const dialog = useDialog();
  
  // Inicializa SEMPRE como array vazio para não quebrar
  const [plans, setPlans] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // === CARREGAMENTO BLINDADO COM TOKEN ===
  const carregar = () => {
    setLoading(true);
    const token = localStorage.getItem('token'); // <--- 1. Recupera Token

    fetch('/api/plans?visao=admin', { 
        cache: 'no-store',
        headers: {
            'Authorization': `Bearer ${token}` // <--- 2. Envia Token
        }
    })
        .then(async (r) => {
            const data = await r.json();
            
            if (r.ok && Array.isArray(data)) {
                setPlans(data);
            } else {
                console.error("API retornou erro ou formato inválido:", data);
                setPlans([]); 
                if(!r.ok && r.status !== 404) dialog.showAlert({ type: 'danger', description: data.error || "Erro ao carregar dados." });
            }
        })
        .catch(err => {
            console.error(err);
            setPlans([]);
            dialog.showAlert({ type: 'danger', description: "Erro de conexão com o servidor." });
        })
        .finally(() => setLoading(false));
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
          recommended: false,
          privado: false,
          maxNotasMensal: 0,
          diasTeste: 0
      });
  }

  const handleSave = async () => {
    const method = editing.id ? 'PUT' : 'POST';
    const token = localStorage.getItem('token'); // <--- Recupera Token
    
    try {
        const res = await fetch('/api/plans', {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // <--- Envia Token
            },
            body: JSON.stringify(editing)
        });

        if (res.ok) {
            setEditing(null);
            await carregar();
            dialog.showAlert({ type: 'success', description: "Salvo com sucesso!" });
        } else {
            const err = await res.json();
            dialog.showAlert({ type: 'danger', description: err.error || "Erro ao salvar." });
        }
    } catch (e) {
        dialog.showAlert("Erro de conexão.");
    }
  };

  const handleDelete = async (id: string) => {
      const confirmed = await dialog.showConfirm({
          title: 'Excluir Plano',
          description: 'Tem certeza? Essa ação não pode ser desfeita.',
          type: 'danger',
          confirmText: 'Sim, Excluir'
      });

      if(!confirmed) return;
      
      const token = localStorage.getItem('token'); // <--- Recupera Token

      try {
          const res = await fetch(`/api/plans?id=${id}`, { 
              method: 'DELETE',
              headers: {
                  'Authorization': `Bearer ${token}` // <--- Envia Token
              }
          });
          const data = await res.json();

          if (res.ok) {
              await carregar();
              dialog.showAlert({ type: 'success', description: "Plano removido." });
          } else {
              dialog.showAlert({ type: 'danger', description: data.error });
          }
      } catch(e) {
          dialog.showAlert("Erro ao excluir.");
      }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Planos de Assinatura</h1>
        <div className="flex gap-2">
            <button onClick={carregar} className="bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded hover:bg-slate-50 transition" title="Recarregar">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
            </button>
            <button onClick={abrirNovo} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 font-bold shadow-sm transition">
                <Plus size={18}/> Novo Plano
            </button>
        </div>
      </div>

      {/* ESTADO VAZIO / ERRO */}
      {!loading && plans.length === 0 && (
          <div className="p-12 text-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
              <p className="text-slate-500 font-bold mb-2">Nenhum plano encontrado.</p>
              <p className="text-sm text-slate-400 mb-4">
                Se for a primeira vez, verifique se o banco de dados foi atualizado (npx prisma db push).
              </p>
              <button onClick={carregar} className="text-blue-600 font-bold hover:underline">Tentar Novamente</button>
          </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between mb-4 border-b pb-4">
                    <h3 className="font-bold text-lg text-slate-800">{editing.id ? `Editar: ${editing.name}` : 'Criar Novo Plano'}</h3>
                    <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Plano</label>
                            <input className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Slug (ID Único)</label>
                            <input className="w-full p-2 border rounded bg-gray-50 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={editing.slug || ''} onChange={e => setEditing({...editing, slug: e.target.value.toUpperCase()})} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição Curta</label>
                        <input className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={editing.description || ''} onChange={e => setEditing({...editing, description: e.target.value})} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 bg-blue-50 p-3 rounded border border-blue-100">
                        <div>
                            <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Preço Mensal (R$)</label>
                            <input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={editing.priceMonthly} onChange={e => setEditing({...editing, priceMonthly: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Preço Anual (R$)</label>
                            <input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={editing.priceYearly} onChange={e => setEditing({...editing, priceYearly: e.target.value})} />
                        </div>
                    </div>

                    {/* REGRAS DE NEGÓCIO */}
                    <div className="grid grid-cols-2 gap-4 bg-yellow-50 p-3 rounded border border-yellow-100">
                        <div>
                            <label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Limite de Emissões</label>
                            <input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-yellow-500 outline-none" value={editing.maxNotasMensal} onChange={e => setEditing({...editing, maxNotasMensal: e.target.value})} />
                            <p className="text-[10px] text-slate-500 mt-1">0 = Ilimitado. -1 = Bloqueado.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Dias de Teste</label>
                            <input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-yellow-500 outline-none" value={editing.diasTeste} onChange={e => setEditing({...editing, diasTeste: e.target.value})} />
                            <p className="text-[10px] text-slate-500 mt-1">0 = Sem trial.</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Benefícios (Separar por vírgula)</label>
                        <textarea 
                            className="w-full p-2 border rounded h-20 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                            value={editing.features} 
                            onChange={e => setEditing({...editing, features: e.target.value})}
                        />
                    </div>

                    <div className="flex gap-6 border-t pt-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none hover:bg-slate-50 p-1 rounded transition">
                            <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={editing.active} onChange={e => setEditing({...editing, active: e.target.checked})} />
                            <span className="font-bold text-slate-700">Ativo</span>
                        </label>
                        
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none hover:bg-slate-50 p-1 rounded transition">
                            <input type="checkbox" className="w-4 h-4 text-purple-600 rounded" checked={editing.recommended} onChange={e => setEditing({...editing, recommended: e.target.checked})} />
                            <span className="text-purple-600 font-bold">Destaque (Recomendado)</span>
                        </label>
                        
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none hover:bg-slate-50 p-1 rounded transition">
                            <input type="checkbox" className="w-4 h-4 text-slate-600 rounded" checked={editing.privado} onChange={e => setEditing({...editing, privado: e.target.checked})} />
                            <span className="text-slate-500 font-bold flex items-center gap-1"><Shield size={12}/> Oculto (Privado)</span>
                        </label>
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-blue-700 font-bold shadow-md transition">
                            <Save size={18}/> Salvar Dados
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* GRID DE PLANOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(plans || []).map(plan => (
            <div key={plan.id} className={`bg-white rounded-xl shadow-sm border relative overflow-hidden flex flex-col ${plan.recommended ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'} ${!plan.active ? 'opacity-60 grayscale' : ''}`}>
                <div className="p-6 flex-1">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg text-slate-800">{plan.name}</h3>
                                {plan.privado && (
                                    <div title="Plano Privado/Interno">
                                        <Shield size={14} className="text-slate-400" />
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 font-mono">{plan.slug}</p>
                        </div>
                        {plan.recommended && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">TOP</span>}
                    </div>

                    <div className="mb-4">
                        <p className="text-3xl font-black text-slate-900">R$ {Number(plan.priceMonthly).toFixed(2)}<span className="text-sm font-normal text-slate-500">/mês</span></p>
                    </div>
                    
                    {/* Regras Visuais */}
                    <div className="flex gap-2 mb-4">
                        <span className={`text-[10px] px-2 py-1 rounded font-bold border ${plan.maxNotasMensal === 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {plan.maxNotasMensal === 0 ? 'ILIMITADO' : plan.maxNotasMensal === -1 ? 'BLOQUEADO' : `${plan.maxNotasMensal} Notas`}
                        </span>
                        {plan.diasTeste > 0 && (
                             <span className="text-[10px] px-2 py-1 rounded font-bold border bg-yellow-50 text-yellow-700 border-yellow-200">
                                {plan.diasTeste} Dias Teste
                            </span>
                        )}
                    </div>

                    <div className="space-y-2 mb-6">
                        {plan.features.split(',').map((feat: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <Check size={14} className="text-green-500 mt-0.5 shrink-0"/> {feat.trim()}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                    <button onClick={() => handleDelete(plan.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition">
                        <Trash2 size={18}/>
                    </button>
                    <button onClick={() => setEditing(plan)} className="text-blue-600 hover:bg-blue-100 px-4 py-2 rounded flex items-center gap-2 text-sm font-bold transition">
                        <Edit size={16}/> Editar
                    </button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
}