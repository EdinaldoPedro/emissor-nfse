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
    const token = localStorage.getItem('token'); // <--- 1. RECUPERA TOKEN

    fetch(`/api/admin/cnaes?page=${pagina}&limit=${limit}&search=${busca}`, {
        headers: { 
            'Authorization': `Bearer ${token}` // <--- 2. ENVIA TOKEN
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
    const token = localStorage.getItem('token'); // <--- 1. RECUPERA TOKEN
    
    const res = await fetch('/api/admin/cnaes', {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // <--- 2. ENVIA TOKEN
        },
        body: JSON.stringify(editing)
    });

    if (res.ok) {
        setEditing(null);
        carregar(page, termoBusca);
        dialog.showAlert({ type: 'success', description: "Tributação atualizada!" });
    } else {
        dialog.showAlert({ type: 'danger', description: "Erro ao salvar." });
    }
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
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex justify-between mb-4 border-b pb-2">
                    <h3 className="font-bold text-lg text-slate-800">Configurar Tributação</h3>
                    <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">CNAE (Bloqueado)</label>
                        <input className="w-full p-2.5 bg-gray-100 border rounded font-mono text-sm text-slate-600" value={editing.codigo} disabled />
                        <p className="text-xs text-gray-500 mt-1 italic">{editing.descricao}</p>
                    </div>
                    
                    {/* Campos Fiscais */}
                    <div className="grid grid-cols-2 gap-4">
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
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Cód. Trib. Nacional</label>
                            <input 
                                className="w-full p-2.5 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={editing.codigoTributacaoNacional || ''} 
                                onChange={e => setEditing({...editing, codigoTributacaoNacional: e.target.value})}
                                placeholder="Ex: 01.07.01"
                            />
                        </div>
                    </div>

                    {/* NOVOS CAMPOS: NBS e INSS */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-2">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Código NBS</label>
                            <input 
                                className="w-full p-2.5 border rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={editing.codigoNbs || ''} 
                                onChange={e => setEditing({...editing, codigoNbs: e.target.value})}
                                placeholder="Ex: 123456789"
                            />
                        </div>
                        <div className="flex items-center pt-6 pl-2">
                             <label className="flex items-center gap-2 cursor-pointer select-none p-2 hover:bg-slate-50 rounded transition">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                    checked={editing.temRetencaoInss || false}
                                    onChange={e => setEditing({...editing, temRetencaoInss: e.target.checked})}
                                />
                                <span className="text-sm font-bold text-slate-700">Reter INSS?</span>
                             </label>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-2 border-t pt-4">
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
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b">
                <tr>
                    <th className="p-4 w-24 font-bold text-slate-500 uppercase text-xs">CNAE</th>
                    <th className="p-4 font-bold text-slate-500 uppercase text-xs">Descrição</th>
                    <th className="p-4 w-24 font-bold text-slate-500 uppercase text-xs">Item LC</th>
                    <th className="p-4 w-32 font-bold text-slate-500 uppercase text-xs">Trib. Nac.</th>
                    <th className="p-4 w-28 font-bold text-slate-500 uppercase text-xs">NBS</th>
                    <th className="p-4 w-20 text-center font-bold text-slate-500 uppercase text-xs">INSS</th>
                    <th className="p-4 w-16 text-right font-bold text-slate-500 uppercase text-xs">Ação</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {cnaes.length === 0 ? (
                    <tr><td colSpan={7} className="p-12 text-center text-gray-400 italic">Nenhum CNAE encontrado.</td></tr>
                ) : (
                    cnaes.map(cnae => (
                        <tr key={cnae.id} className="hover:bg-slate-50 transition">
                            <td className="p-4 font-mono font-bold text-slate-700">{cnae.codigo}</td>
                            <td className="p-4 text-slate-600 text-xs leading-snug max-w-md truncate" title={cnae.descricao}>{cnae.descricao}</td>
                            <td className="p-4">
                                {cnae.itemLc ? (
                                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px] font-bold border border-green-200">{cnae.itemLc}</span>
                                ) : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="p-4">
                                {cnae.codigoTributacaoNacional ? (
                                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">{cnae.codigoTributacaoNacional}</span>
                                ) : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="p-4 font-mono text-xs text-slate-500">
                                {cnae.codigoNbs || '-'}
                            </td>
                            <td className="p-4 text-center">
                                {cnae.temRetencaoInss ? (
                                    <CheckCircle size={16} className="text-green-500 mx-auto"/>
                                ) : (
                                    <XCircle size={16} className="text-slate-200 mx-auto"/>
                                )}
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