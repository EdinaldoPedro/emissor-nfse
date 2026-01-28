'use client';
import { useEffect, useState } from 'react';
import { Building2, Search, User, Loader2, Edit, Save, X, MapPin, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useDialog } from '@/app/contexts/DialogContext';

export default function BaseEmpresas() {
  const dialog = useDialog();
  
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [termo, setTermo] = useState('');
  
  const [editingEmpresa, setEditingEmpresa] = useState<any>(null);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      carregarEmpresas(page, termo);
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [page, termo]);

  const carregarEmpresas = (pagina: number, busca: string) => {
    setLoading(true);
    const token = localStorage.getItem('token'); // <--- Pega Token

    fetch(`/api/admin/empresas?page=${pagina}&limit=10&search=${busca}`, {
        headers: { 'Authorization': `Bearer ${token}` } // <--- Envia Token
    })
      .then(r => r.json())
      .then(res => {
        setEmpresas(res.data || []);
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
                  'Authorization': `Bearer ${token}` // <--- Envia Token
              },
              body: JSON.stringify(editingEmpresa)
          });
          
          if(res.ok) {
              await dialog.showAlert({ type: 'success', title: 'Sucesso', description: "Cadastro atualizado!" });
              setEditingEmpresa(null);
              carregarEmpresas(page, termo);
          } else {
              dialog.showAlert({ type: 'danger', description: "Erro ao salvar." });
          }
      } catch (e) { dialog.showAlert("Erro de conexão."); }
  };

  const handleDelete = async (id: string) => {
      const confirmacao = await dialog.showPrompt({
          type: 'danger',
          title: 'Zona de Perigo',
          description: 'Esta ação apagará PERMANENTEMENTE a empresa. Digite EXCLUIR:',
          validationText: 'EXCLUIR',
          placeholder: "Digite 'EXCLUIR'"
      });
      
      if (confirmacao !== 'EXCLUIR') return;

      const token = localStorage.getItem('token');
      try {
          const res = await fetch(`/api/admin/empresas?id=${id}`, { 
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` } // <--- Envia Token
          });
          const data = await res.json();

          if (res.ok) {
              await dialog.showAlert({ type: 'success', description: "Empresa removida." });
              setEditingEmpresa(null);
              carregarEmpresas(page, termo);
          } else {
              dialog.showAlert({ type: 'danger', title: 'Falha', description: data.error });
          }
      } catch (e) {
          dialog.showAlert("Erro de conexão.");
      }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Base de Empresas</h1>
            <p className="text-sm text-slate-500">
                {totalItems} registros encontrados.
            </p>
        </div>
        <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
            <input 
                className="pl-10 p-2 border rounded-lg w-80 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Buscar Razão ou CNPJ..."
                value={termo}
                onChange={e => {
                    setTermo(e.target.value);
                    setPage(1); 
                }}
            />
        </div>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editingEmpresa && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between mb-6 border-b pb-4">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Edit size={20}/> Editar Cadastro
                    </h3>
                    <button onClick={() => setEditingEmpresa(null)}><X size={24}/></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="md:col-span-2">
                        <label className="block font-bold text-slate-500 mb-1">Razão Social</label>
                        <input className="w-full p-2 border rounded" value={editingEmpresa.razaoSocial} onChange={e => setEditingEmpresa({...editingEmpresa, razaoSocial: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block font-bold text-slate-500 mb-1">Nome Fantasia</label>
                        <input className="w-full p-2 border rounded" value={editingEmpresa.nomeFantasia || ''} onChange={e => setEditingEmpresa({...editingEmpresa, nomeFantasia: e.target.value})} />
                    </div>
                    
                    <div>
                        <label className="block font-bold text-slate-500 mb-1">CNPJ</label>
                        <input className="w-full p-2 border rounded bg-gray-100 text-gray-500 cursor-not-allowed" value={editingEmpresa.documento} disabled />
                    </div>
                    <div>
                        <label className="block font-bold text-slate-500 mb-1">Inscrição Municipal</label>
                        <input className="w-full p-2 border rounded" value={editingEmpresa.inscricaoMunicipal || ''} onChange={e => setEditingEmpresa({...editingEmpresa, inscricaoMunicipal: e.target.value})} />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block font-bold text-slate-500 mb-1">Regime Tributário</label>
                        <select className="w-full p-2 border rounded" value={editingEmpresa.regimeTributario || 'MEI'} onChange={e => setEditingEmpresa({...editingEmpresa, regimeTributario: e.target.value})}>
                            <option value="MEI">MEI</option>
                            <option value="SIMPLES">Simples Nacional</option>
                            <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
                        </select>
                    </div>

                    <div className="md:col-span-2 mt-4 pt-4 border-t">
                        <h4 className="font-bold text-blue-600 mb-3 flex items-center gap-2"><MapPin size={16}/> Endereço</h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs text-gray-400">CEP</label>
                                <input className="w-full p-2 border rounded" value={editingEmpresa.cep || ''} onChange={e => setEditingEmpresa({...editingEmpresa, cep: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs text-gray-400">Logradouro</label>
                                <input className="w-full p-2 border rounded" value={editingEmpresa.logradouro || ''} onChange={e => setEditingEmpresa({...editingEmpresa, logradouro: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400">Cidade</label>
                                <input className="w-full p-2 border rounded" value={editingEmpresa.cidade || ''} onChange={e => setEditingEmpresa({...editingEmpresa, cidade: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400">UF</label>
                                <input className="w-full p-2 border rounded" maxLength={2} value={editingEmpresa.uf || ''} onChange={e => setEditingEmpresa({...editingEmpresa, uf: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs text-blue-600 font-bold">Código IBGE</label>
                                <input className="w-full p-2 border rounded bg-blue-50 border-blue-200" value={editingEmpresa.codigoIbge || ''} onChange={e => setEditingEmpresa({...editingEmpresa, codigoIbge: e.target.value})} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-between items-center border-t pt-4">
                    <button 
                        onClick={() => handleDelete(editingEmpresa.id)} 
                        className="text-red-500 hover:bg-red-50 px-4 py-2 rounded flex items-center gap-2 font-bold transition text-xs border border-transparent hover:border-red-200"
                    >
                        <Trash2 size={16}/> Excluir
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
                <Loader2 className="animate-spin mr-2"/> Carregando...
            </div>
        ) : empresas.length === 0 ? (
            <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-dashed">
                Nenhum CNPJ encontrado na base.
            </div>
        ) : (
            empresas.map(emp => (
                <div key={emp.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-blue-300 transition group">
                    <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                        <div className="p-3 bg-slate-50 border rounded-lg text-slate-500">
                            <Building2 size={24}/>
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-800 truncate">{emp.razaoSocial}</h3>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1 font-mono uppercase">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">CNPJ: {emp.documento}</span>
                                {emp.codigoIbge && <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">IBGE: {emp.codigoIbge}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-1/4 md:border-l md:pl-4 border-slate-100">
                        <div className={`p-2 rounded-full ${emp.donos && emp.donos.length > 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            <User size={16}/>
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Vinculado a</p>
                            {emp.donos && emp.donos.length > 0 ? (
                                <>
                                    <p className="text-xs text-slate-800 font-bold truncate">{emp.donos[0].nome}</p>
                                    <p className="text-[10px] text-slate-500 truncate">{emp.donos[0].email}</p>
                                </>
                            ) : (
                                <p className="text-xs text-red-400 italic">Nenhum Usuário</p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                        <button 
                            onClick={() => setEditingEmpresa(emp)}
                            className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1 hover:bg-slate-50 px-3 py-2 rounded transition border border-transparent hover:border-slate-200"
                        >
                            <Edit size={16}/> Editar Dados
                        </button>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* PAGINAÇÃO */}
      <div className="mt-6 flex justify-between items-center border-t pt-4">
          <span className="text-xs text-slate-500">Página {page} de {totalPages}</span>
          <div className="flex gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1}
                className="p-2 border rounded hover:bg-white disabled:opacity-50 bg-slate-50"
              >
                  <ChevronLeft size={16}/>
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                disabled={page === totalPages}
                className="p-2 border rounded hover:bg-white disabled:opacity-50 bg-slate-50"
              >
                  <ChevronRight size={16}/>
              </button>
          </div>
      </div>
    </div>
  );
}