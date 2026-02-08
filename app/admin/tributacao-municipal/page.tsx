'use client';
import { useEffect, useState } from 'react';
import { Search, Edit, Save, X, Plus, Trash2, MapPin, ChevronLeft, ChevronRight, Briefcase } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';
import { useDialog } from '@/app/contexts/DialogContext';

export default function TributacaoMunicipalPage() {
  const dialog = useDialog();
  const [lista, setLista] = useState<any[]>([]);
  
  // Paginação e Busca
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [termoBusca, setTermoBusca] = useState('');
  
  const limit = 10; 

  // Dados Auxiliares
  const [listaCnaes, setListaCnaes] = useState<any[]>([]);
  const [listaCidades, setListaCidades] = useState<any[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  
  const [form, setForm] = useState({
    id: '',
    cnae: '',
    codigoIbge: '',
    codigoTributacaoMunicipal: '',
    descricaoServicoMunicipal: ''
  });

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      carregarRegras(page, termoBusca);
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [page, termoBusca]);

  useEffect(() => {
    carregarAuxiliares();
  }, []);

  const carregarRegras = (pagina: number, busca: string = '') => {
    const token = localStorage.getItem('token'); // <--- CORREÇÃO: Pegar Token
    
    fetch(`/api/admin/tributacao-municipal?page=${pagina}&limit=${limit}&search=${busca}`, {
        headers: { 
            'Authorization': `Bearer ${token}` // <--- CORREÇÃO: Enviar Token
        }
    })
      .then(r => r.json())
      .then(res => {
        setLista(res.data || []);
        setTotalPages(res.meta?.totalPages || 1);
        setTotalItems(res.meta?.total || 0);
      })
      .catch(err => console.error("Erro ao carregar regras:", err));
  };

  const carregarAuxiliares = async () => {
    const token = localStorage.getItem('token'); // <--- CORREÇÃO: Pegar Token

    // 1. Carrega CNAEs
    fetch('/api/admin/cnaes?limit=1000', {
        headers: { 'Authorization': `Bearer ${token}` } // <--- Envia Token
    }) 
        .then(r => r.json())
        .then(res => {
            const lista = Array.isArray(res) ? res : (res.data || []);
            setListaCnaes(lista);
        })
        .catch(() => setListaCnaes([]));

    // 2. Carrega Cidades
    fetch('/api/admin/empresas?limit=1000', {
        headers: { 'Authorization': `Bearer ${token}` } // <--- Envia Token
    })
        .then(r => r.json())
        .then((res: any) => {
            const listaEmpresas = res.data || (Array.isArray(res) ? res : []);
            const cidadesMap = new Map();
            listaEmpresas.forEach((emp: any) => {
                if (emp.codigoIbge && emp.cidade) {
                    cidadesMap.set(emp.codigoIbge, {
                        ibge: emp.codigoIbge,
                        nome: `${emp.cidade}/${emp.uf}`
                    });
                }
            });
            setListaCidades(Array.from(cidadesMap.values()));
        })
        .catch(err => console.error("Erro ao carregar cidades", err));
  };

  const handleSave = async () => {
    if (!form.cnae || !form.codigoIbge || !form.codigoTributacaoMunicipal) {
        return dialog.showAlert("Preencha os campos obrigatórios.");
    }

    const token = localStorage.getItem('token');
    
    const metodo = editing ? 'PUT' : 'POST';
    const res = await fetch('/api/admin/tributacao-municipal', {
        method: metodo,
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(form)
    });
    const data = await res.json();

    if (res.ok) {
        setModalOpen(false);
        carregarRegras(page, termoBusca);
        dialog.showAlert({ type: 'success', description: "Regra salva com sucesso!" });
    } else {
        dialog.showAlert({ type: 'danger', description: data.error || "Erro ao salvar." });
    }
  };

  const handleDelete = async (id: string) => {
      const confirmed = await dialog.showConfirm({
          title: 'Excluir Regra?',
          description: 'Esta ação removerá a configuração tributária para este município.',
          type: 'danger',
          confirmText: 'Sim, Excluir'
      });
      
      if(!confirmed) return;
      
      const token = localStorage.getItem('token');

      await fetch(`/api/admin/tributacao-municipal?id=${id}`, { 
          method: 'DELETE',
          headers: {
              'Authorization': `Bearer ${token}` 
          }
      });
      carregarRegras(page, termoBusca);
      dialog.showAlert({ type: 'success', description: "Regra removida." });
  };

  const getNomeCidade = (ibge: string) => {
      const cidade = listaCidades.find(c => c.ibge === ibge);
      return cidade ? cidade.nome : ibge; 
  }

  const opcoesCnae = listaCnaes.map(c => ({
      value: c.codigo,
      label: c.codigo,
      subLabel: c.descricao
  }));

  const opcoesCidade = listaCidades.map(c => ({
      value: c.ibge,
      label: c.nome,
      subLabel: `IBGE: ${c.ibge}`
  }));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Códigos Municipais</h1>
            <p className="text-sm text-slate-500">{totalItems} regras encontradas.</p>
        </div>
        
        <div className="flex gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                    className="pl-10 p-2 border rounded-lg w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Pesquisar..."
                    value={termoBusca}
                    onChange={e => {
                        setTermoBusca(e.target.value);
                        setPage(1);
                    }}
                />
            </div>

            <button onClick={() => { setEditing(null); setForm({ id:'', cnae:'', codigoIbge:'', codigoTributacaoMunicipal:'', descricaoServicoMunicipal:'' }); setModalOpen(true); }} 
                className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 font-bold shadow-sm">
                <Plus size={18}/> Nova Regra
            </button>
        </div>
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg overflow-visible">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">{editing ? 'Editar Regra' : 'Nova Regra Municipal'}</h3>
                    <button onClick={() => setModalOpen(false)}><X size={20}/></button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CNAE</label>
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-3 text-gray-400 z-10" size={16}/>
                            <div className="pl-8">
                                <SearchableSelect 
                                    options={opcoesCnae}
                                    value={form.cnae}
                                    onChange={(val) => setForm({...form, cnae: val})}
                                    placeholder="Busque pelo código ou nome..."
                                    disabled={!!editing}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cidade</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-3 text-gray-400 z-10" size={16}/>
                            <div className="pl-8">
                                <SearchableSelect 
                                    options={opcoesCidade}
                                    value={form.codigoIbge}
                                    onChange={(val) => setForm({...form, codigoIbge: val})}
                                    placeholder="Busque pela cidade..."
                                    disabled={!!editing}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <label className="block text-xs font-bold text-blue-700 uppercase mb-1">Cód. Municipal (CTM)</label>
                        <input className="w-full p-2 border rounded bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none" value={form.codigoTributacaoMunicipal} onChange={e => setForm({...form, codigoTributacaoMunicipal: e.target.value})} placeholder="Ex: 010700188" />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição (Opcional)</label>
                        <textarea className="w-full p-2 border rounded resize-none focus:ring-2 focus:ring-blue-500 outline-none" value={form.descricaoServicoMunicipal || ''} onChange={e => setForm({...form, descricaoServicoMunicipal: e.target.value})} rows={2} />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2 pt-4 border-t">
                    <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-blue-700 font-bold shadow-md"><Save size={18}/> Salvar</button>
                </div>
            </div>
        </div>
      )}

      {/* TABELA */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col justify-between min-h-[500px]">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b">
                <tr>
                    <th className="p-4 font-bold text-slate-500 uppercase text-xs">CNAE</th>
                    <th className="p-4 font-bold text-slate-500 uppercase text-xs">Cidade (IBGE)</th>
                    <th className="p-4 font-bold text-slate-500 uppercase text-xs">Cód. Municipal</th>
                    <th className="p-4 text-right font-bold text-slate-500 uppercase text-xs">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {lista.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-400">Nenhum registro encontrado.</td></tr>
                ) : (
                    lista.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition">
                            <td className="p-4 font-mono font-bold text-slate-700">{item.cnae}</td>
                            
                            <td className="p-4">
                                <div className="flex flex-col">
                                    <span className="flex items-center gap-1 font-medium text-slate-700">
                                        <MapPin size={14} className="text-blue-500"/> 
                                        {getNomeCidade(item.codigoIbge)}
                                    </span>
                                    <span className="text-[10px] text-gray-400 pl-5 font-mono">
                                        IBGE: {item.codigoIbge}
                                    </span>
                                </div>
                            </td>

                            <td className="p-4"><span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-bold border border-orange-200">{item.codigoTributacaoMunicipal}</span></td>
                            <td className="p-4 text-right flex justify-end gap-2">
                                <button onClick={() => { setEditing(item); setForm(item); setModalOpen(true); }} className="text-blue-500 hover:bg-blue-50 p-2 rounded transition" title="Editar"><Edit size={18}/></button>
                                <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded transition" title="Excluir"><Trash2 size={18}/></button>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>

        {/* Paginação */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
            <span className="text-xs text-slate-500">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 bg-white border rounded hover:bg-slate-100 disabled:opacity-50 text-slate-600"><ChevronLeft size={16} /></button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 bg-white border rounded hover:bg-slate-100 disabled:opacity-50 text-slate-600"><ChevronRight size={16} /></button>
            </div>
        </div>
      </div>
    </div>
  );
}