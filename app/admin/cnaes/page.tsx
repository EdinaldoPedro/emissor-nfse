'use client';
import { useEffect, useState } from 'react';
import { Search, Edit, Save, X, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { useDialog } from '@/app/contexts/DialogContext';

export default function AdminCnaes() {
  const dialog = useDialog();
  const [cnaes, setCnaes] = useState<any[]>([]);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');
  const limit = 10;

  const [editing, setEditing] = useState<any>(null);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      carregar(page, termoBusca);
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [page, termoBusca]);

  const carregar = (pagina: number, busca: string) => {
    const token = localStorage.getItem('token'); 

    fetch(`/api/admin/cnaes?page=${pagina}&limit=${limit}&search=${busca}`, {
        headers: { 
            'Authorization': `Bearer ${token}` 
        }
    })
      .then(r => r.json())
      .then(res => {
        setCnaes(res.data || []);
        setTotalPages(res.meta?.totalPages || 1);
        setTotalItems(res.meta?.total || 0);
      })
      .catch(err => console.error("Erro ao carregar CNAEs:", err));
  };

  const handleSave = async () => {
    const token = localStorage.getItem('token'); 
    
    // Tratamento para garantir que enviamos nulo caso a flag seja falsa
    const payloadToSave = {
        ...editing,
        aliquotaCrsf: editing.retemCrsf ? editing.aliquotaCrsf : null,
        aliquotaIr: editing.retemIr ? editing.aliquotaIr : null
    };
    
    const res = await fetch('/api/admin/cnaes', {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payloadToSave)
    });

    if (res.ok) {
        setEditing(null);
        carregar(page, termoBusca);
        dialog.showAlert({ type: 'success', description: "Tributação atualizada!" });
    } else {
        dialog.showAlert({ type: 'danger', description: "Erro ao salvar." });
    }
  };
  
  // Helpers visuais para as retenções
  const handleToggleRetencao = (campoBooleano: string, campoAliquota: string, valorPadrao: number) => {
      setEditing((prev: any) => {
          const isAtivando = !prev[campoBooleano];
          return {
              ...prev,
              [campoBooleano]: isAtivando,
              [campoAliquota]: isAtivando ? valorPadrao : null
          };
      });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Tabela Nacional de CNAEs</h1>
            <p className="text-sm text-slate-500">Total de {totalItems} atividades encontradas.</p>
        </div>
        
        <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
                placeholder="Buscar CNAE ou Descrição..." 
                className="pl-10 p-2 border rounded-lg w-80 focus:ring-2 focus:ring-blue-500 outline-none"
                value={termoBusca}
                onChange={e => {
                    setTermoBusca(e.target.value);
                    setPage(1); 
                }}
            />
        </div>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between mb-4 border-b pb-2 sticky top-0 bg-white z-10">
                    <h3 className="font-bold text-lg text-slate-800">Configurar Tributação</h3>
                    <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                
                <div className="space-y-5">
                    <div className="bg-slate-50 p-3 rounded border">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">CNAE (Bloqueado)</label>
                        <input className="w-full p-2.5 bg-gray-100 border rounded font-mono text-sm text-slate-600" value={editing.codigo} disabled />
                        <p className="text-xs text-gray-500 mt-1 italic">{editing.descricao}</p>
                    </div>
                    
                    {/* Campos Fiscais */}
                    <div>
                        <h4 className="text-sm font-bold text-slate-700 border-b pb-1 mb-3">Padrão Nacional (Sefaz)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Item LC 116/03</label>
                                <input 
                                    className="w-full p-2.5 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={editing.itemLc || ''} 
                                    onChange={e => setEditing({...editing, itemLc: e.target.value})}
                                    placeholder="Ex: 1.07"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cód. Trib. Nac.</label>
                                <input 
                                    className="w-full p-2.5 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={editing.codigoTributacaoNacional || ''} 
                                    onChange={e => setEditing({...editing, codigoTributacaoNacional: e.target.value})}
                                    placeholder="Ex: 01.07.01"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Código NBS</label>
                                <input 
                                    className="w-full p-2.5 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={editing.codigoNbs || ''} 
                                    onChange={e => setEditing({...editing, codigoNbs: e.target.value})}
                                    placeholder="Ex: 123456789"
                                />
                            </div>
                        </div>
                    </div>

                    {/* BLOCO DE RETENÇÕES */}
                    <div>
                        <h4 className="text-sm font-bold text-slate-700 border-b pb-1 mb-3">Regras de Retenção (Lucro Presumido/Real)</h4>
                        <div className="space-y-3">
                            
                            {/* INSS */}
                            <div className="flex items-center justify-between p-3 border rounded bg-white hover:bg-slate-50 transition">
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                        checked={editing.temRetencaoInss || false}
                                        onChange={e => setEditing({...editing, temRetencaoInss: e.target.checked})}
                                    />
                                    <span className="text-sm font-bold text-slate-700">Reter INSS?</span>
                                </label>
                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">11% (Calculado no app)</span>
                            </div>

                            {/* PIS/COFINS/CSLL */}
                            <div className="flex items-center justify-between p-3 border rounded bg-white hover:bg-slate-50 transition">
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                        checked={editing.retemCrsf || false}
                                        onChange={() => handleToggleRetencao('retemCrsf', 'aliquotaCrsf', 4.65)}
                                    />
                                    <span className="text-sm font-bold text-slate-700">Reter CRSF (PIS/COFINS/CSLL)?</span>
                                </label>
                                {editing.retemCrsf && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">Alíquota %</span>
                                        <input 
                                            type="number" step="0.01"
                                            className="w-20 p-1.5 border rounded text-sm outline-blue-500 text-center" 
                                            value={editing.aliquotaCrsf || ''} 
                                            onChange={e => setEditing({...editing, aliquotaCrsf: e.target.value})}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* IMPOSTO DE RENDA */}
                            <div className="flex items-center justify-between p-3 border rounded bg-white hover:bg-slate-50 transition">
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                        checked={editing.retemIr || false}
                                        onChange={() => handleToggleRetencao('retemIr', 'aliquotaIr', 1.50)}
                                    />
                                    <span className="text-sm font-bold text-slate-700">Reter IR?</span>
                                </label>
                                {editing.retemIr && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">Alíquota %</span>
                                        <input 
                                            type="number" step="0.01"
                                            className="w-20 p-1.5 border rounded text-sm outline-blue-500 text-center" 
                                            value={editing.aliquotaIr || ''} 
                                            onChange={e => setEditing({...editing, aliquotaIr: e.target.value})}
                                        />
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-2 border-t pt-4 bg-white sticky bottom-0">
                    <button onClick={() => setEditing(null)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded transition">Cancelar</button>
                    <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-blue-700 font-bold shadow-md transition">
                        <Save size={18}/> Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* TABELA COM NOVAS COLUNAS */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col justify-between min-h-[500px]">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b">
                    <tr>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs">CNAE</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs w-1/3">Descrição</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center">Trib. Nac.</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center border-l">INSS</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center">CRSF</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-center">IR</th>
                        <th className="p-4 font-bold text-slate-500 uppercase text-xs text-right">Ação</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {cnaes.length === 0 ? (
                        <tr><td colSpan={7} className="p-12 text-center text-gray-400 italic">Nenhum CNAE encontrado.</td></tr>
                    ) : (
                        cnaes.map(cnae => (
                            <tr key={cnae.id} className="hover:bg-slate-50 transition">
                                <td className="p-4 font-mono font-bold text-slate-700">{cnae.codigo}</td>
                                <td className="p-4 text-slate-600 text-xs truncate max-w-[200px]" title={cnae.descricao}>{cnae.descricao}</td>
                                <td className="p-4 text-center">
                                    {cnae.codigoTributacaoNacional ? (
                                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">{cnae.codigoTributacaoNacional}</span>
                                    ) : <span className="text-gray-300">-</span>}
                                </td>
                                
                                <td className="p-4 text-center border-l">
                                    {cnae.temRetencaoInss ? <CheckCircle size={16} className="text-green-500 mx-auto"/> : <XCircle size={16} className="text-slate-200 mx-auto"/>}
                                </td>
                                <td className="p-4 text-center">
                                    {cnae.retemCrsf ? <span className="text-xs font-bold text-purple-600">{Number(cnae.aliquotaCrsf).toFixed(2)}%</span> : <XCircle size={16} className="text-slate-200 mx-auto"/>}
                                </td>
                                <td className="p-4 text-center">
                                    {cnae.retemIr ? <span className="text-xs font-bold text-orange-600">{Number(cnae.aliquotaIr).toFixed(2)}%</span> : <XCircle size={16} className="text-slate-200 mx-auto"/>}
                                </td>
                                
                                <td className="p-4 text-right">
                                    <button onClick={() => setEditing(cnae)} className="text-blue-600 hover:bg-blue-50 p-2 rounded transition" title="Editar">
                                        <Edit size={18}/>
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>

        {/* PAGINAÇÃO */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
            <span className="text-xs text-slate-500 font-medium">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
                <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    disabled={page === 1}
                    className="p-2 bg-white border rounded hover:bg-slate-100 disabled:opacity-50 text-slate-600 transition"
                >
                    <ChevronLeft size={16} />
                </button>
                <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                    disabled={page === totalPages}
                    className="p-2 bg-white border rounded hover:bg-slate-100 disabled:opacity-50 text-slate-600 transition"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}