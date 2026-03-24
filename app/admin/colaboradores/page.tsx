'use client';
import { useEffect, useState } from 'react';
import { Shield, UserPlus, Trash2, Search, X, UserCog, Edit, Save, Briefcase, Building2, Ban } from 'lucide-react';
import { checkIsStaff, ROLE_LABELS } from '@/app/utils/permissions';
import { useDialog } from '@/app/contexts/DialogContext';

export default function GestaoColaboradores() {
  const dialog = useDialog();
  const [colabs, setColabs] = useState<any[]>([]);
  const [candidatos, setCandidatos] = useState<any[]>([]); 
  
  // Modais
  const [modalNewOpen, setModalNewOpen] = useState(false);
  const [modalEditOpen, setModalEditOpen] = useState(false);
  
  // Estado para Criar/Promover
  const [searchUser, setSearchUser] = useState('');
  const [roleInput, setRoleInput] = useState('SUPORTE');
  const [filtroCandidato, setFiltroCandidato] = useState('');

  // Estado para Edição
  const [selectedUserFull, setSelectedUserFull] = useState<any>(null); 
  const [editLimit, setEditLimit] = useState(5); // Limite Empresas
  const [editLimiteNotas, setEditLimiteNotas] = useState<number | ''>(''); // NOVO: Limite Notas
  const [editLimiteClientes, setEditLimiteClientes] = useState<number | ''>(''); // NOVO: Limite Clientes
  const [loadingEdit, setLoadingEdit] = useState(false);

  const carregarDados = () => {
    fetch('/api/admin/users', { headers: {} })
    .then(r => r.json())
    .then(data => {
        if (Array.isArray(data)) {
            setColabs(data.filter((u: any) => checkIsStaff(u.role)));
            setCandidatos(data.filter((u: any) => !checkIsStaff(u.role)));
        }
    });
  };

  useEffect(() => { carregarDados(); }, []);

  // --- ABRIR EDIÇÃO ---
  const handleOpenEdit = async (userId: string) => {
      setLoadingEdit(true);
      setModalEditOpen(true);
      
      try {
          const res = await fetch(`/api/admin/users/${userId}`, { headers: {} });
          const data = await res.json();
          
          setSelectedUserFull(data);
          setRoleInput(data.role);
          setEditLimit(data.limiteEmpresas || 5);

          // Procura o plano ativo do Parceiro para preencher os inputs de notas e clientes
          const activePlanHistory = data.planHistories?.find((h: any) => h.status === 'ATIVO');
          if (activePlanHistory && activePlanHistory.plan) {
              setEditLimiteNotas(activePlanHistory.plan.maxNotasMensal);
              setEditLimiteClientes(activePlanHistory.plan.maxClientes);
          } else {
              setEditLimiteNotas('');
              setEditLimiteClientes('');
          }

      } catch (e) {
          dialog.showAlert("Erro ao carregar detalhes.");
          setModalEditOpen(false);
      } finally {
          setLoadingEdit(false);
      }
  };

  // --- PROMOVER (Novo) ---
  const handlePromover = async () => {
    if (!searchUser) return dialog.showAlert("Selecione um usuário.");

    try {
        const res = await fetch('/api/admin/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({ id: searchUser, role: roleInput })
        });

        if (res.ok) {
            dialog.showAlert({ type: 'success', description: "Usuário promovido com sucesso!" });
            setModalNewOpen(false);
            carregarDados();
            setSearchUser('');
        } else {
            dialog.showAlert({ type: 'danger', description: "Erro ao promover." });
        }
    } catch (error) { dialog.showAlert("Erro de conexão."); }
  };

  // --- SALVAR EDIÇÃO ---
  const handleSaveEdit = async () => {
      if(!selectedUserFull) return;

      // Monta o payload de envio com os novos limites se for contador
      const payload: any = { role: roleInput, limiteEmpresas: editLimit };
      if (roleInput === 'CONTADOR') {
          if (editLimiteNotas !== '') payload.limiteNotas = editLimiteNotas;
          if (editLimiteClientes !== '') payload.limiteClientes = editLimiteClientes;
      }

      try {
          // 1. Atualiza Limites e Role (PATCH)
          const res = await fetch(`/api/admin/users/${selectedUserFull.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json'},
              body: JSON.stringify(payload)
          });

          // 2. Se mudou para Contador do zero (legado), garante o put secundário
          if(roleInput === 'CONTADOR' && selectedUserFull.role !== 'CONTADOR') {
               await fetch('/api/admin/users', {
                   method: 'PUT',
                   headers: { 'Content-Type': 'application/json'},
                   body: JSON.stringify({ id: selectedUserFull.id, role: 'CONTADOR' })
               });
          }

          if(res.ok) {
              dialog.showAlert({ type: 'success', description: "Dados e limites atualizados!" });
              setModalEditOpen(false);
              carregarDados();
          }
      } catch(e) { dialog.showAlert("Erro ao salvar."); }
  };

  // --- DESVINCULAR EMPRESA ---
  const handleUnlinkCompany = async (vinculoId: string) => {
      if(!await dialog.showConfirm({ 
          title: 'Desvincular?', 
          description: 'O contador perderá o acesso a esta empresa.',
          type: 'warning'
      })) return;
      
      await fetch(`/api/contador/vinculo?id=${vinculoId}`, { method: 'DELETE', headers: {} });
      
      setSelectedUserFull((prev: any) => ({
          ...prev,
          empresasContabeis: prev.empresasContabeis.filter((v: any) => v.id !== vinculoId)
      }));
  };

  // --- DEMITIR ---
  const handleDemitir = async (id: string) => {
      if(!await dialog.showConfirm({ type: 'danger', title: 'Remover Acesso', description: 'O usuário voltará a ser um cliente comum.' })) return;
      await fetch('/api/admin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json'},
          body: JSON.stringify({ id, role: 'COMUM' }) 
      });
      carregarDados();
  }

  const candidatosFiltrados = candidatos.filter(c => c.nome.toLowerCase().includes(filtroCandidato.toLowerCase()) || c.email.includes(filtroCandidato));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Time Interno & Parceiros</h1>
            <p className="text-sm text-slate-500">Gerencie acessos e limites de contadores.</p>
        </div>
        <button onClick={() => { setSearchUser(''); setModalNewOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 font-bold shadow-sm">
            <UserPlus size={18} /> Novo Colaborador
        </button>
      </div>

      {/* MODAL NOVO */}
      {modalNewOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-lg">Adicionar ao Time</h3>
                    <button onClick={() => setModalNewOpen(false)}><X size={20}/></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buscar Usuário</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-gray-400" size={16}/>
                            <input className="w-full pl-9 p-2 border rounded outline-none" placeholder="Nome ou Email..." onChange={e => setFiltroCandidato(e.target.value)}/>
                        </div>
                    </div>
                    <div className="max-h-40 overflow-y-auto border rounded bg-gray-50">
                        {candidatosFiltrados.map(u => (
                            <div key={u.id} onClick={() => setSearchUser(u.id)} className={`p-2 flex justify-between items-center cursor-pointer hover:bg-blue-100 ${searchUser === u.id ? 'bg-blue-100 border-l-4 border-blue-600' : ''}`}>
                                <div><p className="text-sm font-bold">{u.nome}</p><p className="text-xs text-slate-500">{u.email}</p></div>
                                {searchUser === u.id && <UserCog size={16} className="text-blue-600"/>}
                            </div>
                        ))}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cargo</label>
                        <select className="w-full p-2 border rounded" value={roleInput} onChange={e => setRoleInput(e.target.value)}>
                            <option value="SUPORTE">Suporte</option>
                            <option value="CONTADOR">Contador (Parceiro)</option>
                            <option value="ADMIN">Administrador</option>
                        </select>
                    </div>
                    <button onClick={handlePromover} disabled={!searchUser} className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 font-bold">Confirmar</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL EDIÇÃO */}
      {modalEditOpen && selectedUserFull && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-0 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2"><UserCog size={20}/> Editar Colaborador</h3>
                    <button onClick={() => setModalEditOpen(false)}><X size={20} className="text-slate-400 hover:text-red-500"/></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div className="bg-blue-50 p-3 rounded border border-blue-100 flex justify-between items-center">
                        <div>
                            <p className="font-bold text-blue-900">{selectedUserFull.nome}</p>
                            <p className="text-sm text-blue-700">{selectedUserFull.email}</p>
                        </div>
                        <span className="bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded font-bold uppercase">{roleInput}</span>
                    </div>

                    {/* DADOS E LIMITES DO PARCEIRO */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cargo do Usuário</label>
                            <select className="w-full p-2 border rounded bg-white font-semibold" value={roleInput} onChange={e => setRoleInput(e.target.value)}>
                                <option value="SUPORTE">Suporte</option>
                                <option value="SUPORTE_TI">Suporte T.I</option>
                                <option value="CONTADOR">Contador Parceiro</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>
                        
                        {roleInput === 'CONTADOR' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-purple-600 uppercase mb-1">Limite Empresas (CNPJs)</label>
                                    <input type="number" placeholder="Ex: 5" className="w-full p-2 border border-purple-200 focus:border-purple-500 rounded bg-purple-50/50" value={editLimit} onChange={e => setEditLimit(Number(e.target.value))}/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-green-600 uppercase mb-1">Limite Notas (Global/Mês)</label>
                                    <input type="number" placeholder="Ex: 5000" className="w-full p-2 border border-green-200 focus:border-green-500 rounded bg-green-50/50" value={editLimiteNotas} onChange={e => setEditLimiteNotas(e.target.value !== '' ? Number(e.target.value) : '')}/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-blue-600 uppercase mb-1">Limite Clientes (Carteira)</label>
                                    <input type="number" placeholder="Ex: 100" className="w-full p-2 border border-blue-200 focus:border-blue-500 rounded bg-blue-50/50" value={editLimiteClientes} onChange={e => setEditLimiteClientes(e.target.value !== '' ? Number(e.target.value) : '')}/>
                                </div>
                            </>
                        )}
                    </div>

                    {/* LISTA DE EMPRESAS VINCULADAS */}
                    {roleInput === 'CONTADOR' && (
                        <div className="border-t pt-4">
                            <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2"><Building2 size={16}/> Carteira de Empresas Ativas ({selectedUserFull.empresasContabeis?.length || 0})</h4>
                            <div className="bg-slate-50 rounded border max-h-40 overflow-y-auto">
                                {selectedUserFull.empresasContabeis?.length === 0 ? (
                                    <p className="p-4 text-xs text-center text-slate-400">Nenhuma empresa vinculada.</p>
                                ) : (
                                    selectedUserFull.empresasContabeis?.map((v: any) => (
                                        <div key={v.id} className="p-2 border-b last:border-0 flex justify-between items-center hover:bg-white text-sm">
                                            <div>
                                                <p className="font-bold text-slate-700">{v.empresa.razaoSocial}</p>
                                                <p className="text-[10px] text-slate-500">CNPJ: {v.empresa.documento}</p>
                                            </div>
                                            <button onClick={() => handleUnlinkCompany(v.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded border border-transparent hover:border-red-200 transition" title="Desvincular do Contador">
                                                <Ban size={14}/>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                    <button onClick={() => setModalEditOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded transition font-bold text-sm">Cancelar</button>
                    <button onClick={handleSaveEdit} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-bold text-sm flex items-center gap-2 shadow-md">
                        <Save size={16}/> Salvar Configurações
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* LISTA DE COLABORADORES */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b">
                <tr>
                    <th className="p-4 text-slate-500 font-bold uppercase text-xs">Nome</th>
                    <th className="p-4 text-slate-500 font-bold uppercase text-xs">Cargo</th>
                    <th className="p-4 text-right text-slate-500 font-bold uppercase text-xs">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {colabs.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50 transition">
                        <td className="p-4">
                            <p className="font-bold text-slate-800">{user.nome}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                        </td>
                        <td className="p-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase flex items-center gap-1 w-fit ${
                                user.role === 'CONTADOR' ? 'bg-green-50 text-green-700 border-green-200' : 
                                'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                                {user.role === 'CONTADOR' && <Briefcase size={10}/>}
                                {ROLE_LABELS[user.role] || user.role}
                            </span>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                            <button onClick={() => handleOpenEdit(user.id)} className="text-blue-600 hover:bg-blue-50 p-2 border border-transparent hover:border-blue-200 rounded transition" title="Editar Limites / Cargo">
                                <Edit size={16} />
                            </button>
                            {user.role !== 'MASTER' && (
                                <button onClick={() => handleDemitir(user.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition" title="Remover acesso">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}