'use client';
import { useEffect, useState } from 'react';
import { Building2, Search, User, Loader2, Edit, Save, X, MapPin, ChevronLeft, ChevronRight, Trash2, Mail, Users, Globe, Briefcase } from 'lucide-react';
import { useDialog } from '@/app/contexts/DialogContext';

export default function BaseEmpresas() {
  const dialog = useDialog();
  
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ESTADO DA ABA ATIVA
  const [viewType, setViewType] = useState<'PRESTADOR' | 'TOMADOR'>('PRESTADOR');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [termo, setTermo] = useState('');
  
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      carregarDados(page, termo, viewType);
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [page, termo, viewType]);

  const carregarDados = (pagina: number, busca: string, tipo: string) => {
    setLoading(true);
    const token = localStorage.getItem('token');

    fetch(`/api/admin/empresas?page=${pagina}&limit=10&search=${busca}&type=${tipo}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(res => {
        setItems(res.data || []);
        setTotalPages(res.meta?.totalPages || 1);
        setTotalItems(res.meta?.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleSave = async () => {
      const token = localStorage.getItem('token');
      try {
          const res = await fetch('/api/admin/empresas', {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(editingItem)
          });
          
          if(res.ok) {
              await dialog.showAlert({ type: 'success', title: 'Sucesso', description: "Cadastro atualizado!" });
              setEditingItem(null);
              carregarDados(page, termo, viewType);
          } else {
              dialog.showAlert({ type: 'danger', description: "Erro ao salvar." });
          }
      } catch (e) { dialog.showAlert("Erro de conexão."); }
  };

  const handleDelete = async (id: string) => {
      const confirmacao = await dialog.showPrompt({
          type: 'danger',
          title: 'Zona de Perigo',
          description: `Esta ação apagará este cadastro. Digite EXCLUIR:`,
          validationText: 'EXCLUIR',
          placeholder: "Digite 'EXCLUIR'"
      });
      
      if (confirmacao !== 'EXCLUIR') return;

      const token = localStorage.getItem('token');
      try {
          const res = await fetch(`/api/admin/empresas?id=${id}&type=${viewType}`, { 
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
              await dialog.showAlert({ type: 'success', description: "Registro removido." });
              setEditingItem(null);
              carregarDados(page, termo, viewType);
          } else {
              const data = await res.json();
              dialog.showAlert({ type: 'danger', title: 'Falha', description: data.error || 'Erro ao excluir.' });
          }
      } catch (e) {
          dialog.showAlert("Erro de conexão.");
      }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                {viewType === 'PRESTADOR' ? <Building2 className="text-blue-600"/> : <Users className="text-green-600"/>} 
                Base de Cadastros
            </h1>
            <p className="text-sm text-slate-500">
                {totalItems} registros encontrados.
            </p>
        </div>
        <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
            <input 
                className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={viewType === 'PRESTADOR' ? "Buscar Empresa ou Dono..." : "Buscar Cliente ou Tomador..."}
                value={termo}
                onChange={e => {
                    setTermo(e.target.value);
                    setPage(1); 
                }}
            />
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit mb-6 border border-slate-200">
          <button 
            onClick={() => { setViewType('PRESTADOR'); setPage(1); }}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${viewType === 'PRESTADOR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Briefcase size={16}/> Emissores (Prestadores)
          </button>
          <button 
            onClick={() => { setViewType('TOMADOR'); setPage(1); }}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${viewType === 'TOMADOR' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Users size={16}/> Tomadores (Clientes)
          </button>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between mb-6 border-b pb-4">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Edit size={20}/> Editar {viewType === 'PRESTADOR' ? 'Prestador' : 'Tomador'}
                    </h3>
                    <button onClick={() => setEditingItem(null)}><X size={24} className="text-slate-400 hover:text-red-500"/></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="md:col-span-2">
                        <label className="block font-bold text-slate-500 mb-1">Razão Social / Nome</label>
                        <input className="w-full p-2 border rounded" value={editingItem.razaoSocial || editingItem.nome} onChange={e => setEditingItem({...editingItem, razaoSocial: e.target.value})} />
                    </div>
                    
                    {viewType === 'PRESTADOR' && (
                        <div className="md:col-span-2">
                            <label className="block font-bold text-slate-500 mb-1">Nome Fantasia</label>
                            <input className="w-full p-2 border rounded" value={editingItem.nomeFantasia || ''} onChange={e => setEditingItem({...editingItem, nomeFantasia: e.target.value})} />
                        </div>
                    )}
                    
                    <div>
                        <label className="block font-bold text-slate-500 mb-1">Documento (CNPJ/CPF)</label>
                        <input className="w-full p-2 border rounded bg-gray-100 text-gray-500 cursor-not-allowed font-mono" value={editingItem.documento || 'EXTERIOR'} disabled />
                    </div>
                    <div>
                        <label className="block font-bold text-slate-500 mb-1">Inscrição Municipal</label>
                        <input className="w-full p-2 border rounded" value={editingItem.inscricaoMunicipal || ''} onChange={e => setEditingItem({...editingItem, inscricaoMunicipal: e.target.value})} />
                    </div>

                    <div className="md:col-span-2 mt-4 pt-4 border-t">
                        <h4 className="font-bold text-blue-600 mb-3 flex items-center gap-2"><MapPin size={16}/> Endereço Oficial</h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400">CEP</label>
                                <input className="w-full p-2 border rounded" value={editingItem.cep || ''} onChange={e => setEditingItem({...editingItem, cep: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs text-gray-400">Logradouro</label>
                                <input className="w-full p-2 border rounded" value={editingItem.logradouro || ''} onChange={e => setEditingItem({...editingItem, logradouro: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400">Cidade</label>
                                <input className="w-full p-2 border rounded" value={editingItem.cidade || ''} onChange={e => setEditingItem({...editingItem, cidade: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400">UF</label>
                                <input className="w-full p-2 border rounded" maxLength={2} value={editingItem.uf || ''} onChange={e => setEditingItem({...editingItem, uf: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs text-blue-600 font-bold">Código IBGE</label>
                                <input className="w-full p-2 border rounded bg-blue-50 border-blue-200" value={editingItem.codigoIbge || ''} onChange={e => setEditingItem({...editingItem, codigoIbge: e.target.value})} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-between items-center border-t pt-4">
                    <button 
                        onClick={() => handleDelete(editingItem.id)} 
                        className="text-red-500 hover:bg-red-50 px-4 py-2 rounded flex items-center gap-2 font-bold transition text-xs border border-transparent hover:border-red-200"
                    >
                        <Trash2 size={16}/> Excluir Cadastro
                    </button>

                    <button onClick={handleSave} className="bg-green-600 text-white px-6 py-2 rounded flex items-center gap-2 hover:bg-green-700 font-bold shadow-lg shadow-green-100">
                        <Save size={18}/> Salvar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* LISTAGEM */}
      <div className="grid gap-3 min-h-[400px] content-start">
        {loading ? (
             <div className="flex h-64 items-center justify-center text-slate-500">
                <Loader2 className="animate-spin mr-2"/> Carregando base...
            </div>
        ) : items.length === 0 ? (
            <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-dashed">
                Nenhum cadastro encontrado nesta categoria.
            </div>
        ) : (
            items.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-blue-300 transition group">
                    
                    {/* COLUNA 1: DADOS DA ENTIDADE */}
                    <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                        <div className={`p-3 border rounded-lg ${viewType === 'PRESTADOR' ? 'bg-blue-50 text-blue-500 border-blue-100' : 'bg-green-50 text-green-500 border-green-100'}`}>
                            {viewType === 'PRESTADOR' ? <Building2 size={24}/> : <Users size={24}/>}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-800 truncate text-lg" title={item.razaoSocial}>{item.razaoSocial}</h3>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1 font-mono uppercase">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">DOC: {item.documento || 'EXTERIOR'}</span>
                                {item.codigoIbge && <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">IBGE: {item.codigoIbge}</span>}
                                {viewType === 'TOMADOR' && item.tipo === 'EXT' && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 flex items-center gap-1"><Globe size={10}/> Exterior</span>}
                            </div>
                        </div>
                    </div>

                    {/* COLUNA 2: VÍNCULO (Dono ou Empresa Mãe) */}
                    <div className="flex items-center gap-3 w-full md:w-1/3 md:border-l md:pl-6 border-slate-100 min-w-0">
                        <div className="p-2 rounded-full shrink-0 bg-gray-100 text-gray-400">
                            {viewType === 'PRESTADOR' ? <User size={18}/> : <Building2 size={18}/>}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                                {viewType === 'PRESTADOR' ? 'Cliente Proprietário' : 'Empresa Vinculada'}
                            </p>
                            
                            {viewType === 'PRESTADOR' ? (
                                item.donos && item.donos.length > 0 ? (
                                    <>
                                        <p className="text-sm text-slate-800 font-bold truncate" title={item.donos[0].nome}>{item.donos[0].nome}</p>
                                        <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                                            <Mail size={10}/> {item.donos[0].email}
                                        </p>
                                    </>
                                ) : <p className="text-xs text-red-400 italic">Órfão (Sem Dono)</p>
                            ) : (
                                item.vinculo ? (
                                    <>
                                        <p className="text-sm text-slate-800 font-bold truncate">{item.vinculo.razaoSocial}</p>
                                        <p className="text-xs text-slate-500 font-mono">CNPJ: {item.vinculo.documento}</p>
                                    </>
                                ) : <p className="text-xs text-red-400 italic">Sem Empresa Mãe</p>
                            )}
                        </div>
                    </div>

                    {/* AÇÕES */}
                    <div className="flex flex-col items-end gap-2 w-full md:w-auto pl-2">
                        <button 
                            onClick={() => setEditingItem(item)}
                            className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-2 hover:bg-slate-50 px-4 py-2 rounded transition border border-slate-100 hover:border-blue-200 w-full md:w-auto justify-center"
                        >
                            <Edit size={16}/> Editar
                        </button>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* PAGINAÇÃO */}
      <div className="mt-6 flex justify-between items-center border-t pt-4">
          <span className="text-xs text-slate-500 font-medium">Página {page} de {totalPages}</span>
          <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1}
                className="p-2 border rounded hover:bg-white disabled:opacity-50 bg-slate-50 text-slate-600 transition"
              >
                  <ChevronLeft size={16}/>
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                disabled={page === totalPages}
                className="p-2 border rounded hover:bg-white disabled:opacity-50 bg-slate-50 text-slate-600 transition"
              >
                  <ChevronRight size={16}/>
              </button>
          </div>
      </div>
    </div>
  );
}