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
    fetch(`/api/admin/cnaes?page=${pagina}&limit=${limit}&search=${busca}`)
      .then(r => r.json())
      .then(res => {
        setCnaes(res.data || []);
        setTotalPages(res.meta?.totalPages || 1);
        setTotalItems(res.meta?.total || 0);
      });
  };

  const handleSave = async () => {
    const res = await fetch('/api/admin/cnaes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-lg">Configurar Tributação</h3>
                    <button onClick={() => setEditing(null)}><X size={20}/></button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase">CNAE (Bloqueado)</label>
                        <input className="w-full p-2 bg-gray-100 border rounded font-mono text-sm" value={editing.codigo} disabled />
                        <p className="text-xs text-gray-500 mt-1">{editing.descricao}</p>
                    </div>
                    
                    {/* Campos Fiscais */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Item LC 116/03</label>
                            <input 
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" 
                                value={editing.itemLc || ''} 
                                onChange={e => setEditing({...editing, itemLc: e.target.value})}
                                placeholder="Ex: 1.07"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Cód. Trib. Nacional</label>
                            <input 
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" 
                                value={editing.codigoTributacaoNacional || ''} 
                                onChange={e => setEditing({...editing, codigoTributacaoNacional: e.target.value})}
                                placeholder="Ex: 01.07.01"
                            />
                        </div>
                    </div>

                    {/* NOVOS CAMPOS: NBS e INSS */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Código NBS</label>
                            <input 
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500" 
                                value={editing.codigoNbs || ''} 
                                onChange={e => setEditing({...editing, codigoNbs: e.target.value})}
                                placeholder="Ex: 123456789"
                            />
                        </div>
                        <div className="flex items-center pt-5">
                             <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    className="w-5 h-5 text-blue-600 rounded"
                                    checked={editing.temRetencaoInss || false}
                                    onChange={e => setEditing({...editing, temRetencaoInss: e.target.checked})}
                                />
                                <span className="text-sm font-bold text-slate-700">Reter INSS?</span>
                             </label>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700">
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
                    <th className="p-4 w-20 font-semibold text-slate-600">CNAE</th>
                    <th className="p-4 font-semibold text-slate-600">Descrição</th>
                    <th className="p-4 w-24 font-semibold text-slate-600">Item LC</th>
                    <th className="p-4 w-32 font-semibold text-slate-600">Trib. Nac.</th>
                    <th className="p-4 w-24 font-semibold text-slate-600">NBS</th>
                    <th className="p-4 w-20 text-center font-semibold text-slate-600">INSS</th>
                    <th className="p-4 w-16 text-right">Ação</th>
                </tr>
            </thead>
            <tbody>
                {cnaes.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-400">Nenhum CNAE encontrado.</td></tr>
                ) : (
                    cnaes.map(cnae => (
                        <tr key={cnae.id} className="border-b hover:bg-slate-50">
                            <td className="p-4 font-mono font-bold text-slate-700">{cnae.codigo}</td>
                            <td className="p-4 text-slate-600 text-xs">{cnae.descricao}</td>
                            <td className="p-4">
                                {cnae.itemLc ? (
                                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-[10px] font-bold">{cnae.itemLc}</span>
                                ) : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="p-4">
                                {cnae.codigoTributacaoNacional ? (
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[10px] font-bold">{cnae.codigoTributacaoNacional}</span>
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
                                <button onClick={() => setEditing(cnae)} className="text-blue-500 hover:bg-blue-50 p-2 rounded transition">
                                    <Edit size={18}/>
                                </button>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>

        {/* PAGINAÇÃO */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
            <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
                <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    disabled={page === 1}
                    className="p-2 border rounded hover:bg-white disabled:opacity-50"
                >
                    <ChevronLeft size={16} />
                </button>
                <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                    disabled={page === totalPages}
                    className="p-2 border rounded hover:bg-white disabled:opacity-50"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}