'use client';
import { useEffect, useState } from 'react';
import { Shield, UserPlus, Trash2, Search, X, UserCog } from 'lucide-react';
import { checkIsStaff, ROLE_LABELS } from '@/app/utils/permissions';
// 1. Importar
import { useDialog } from '@/app/contexts/DialogContext';

export default function GestaoColaboradores() {
  const dialog = useDialog(); // 2. Init
  const [colabs, setColabs] = useState<any[]>([]);
  const [candidatos, setCandidatos] = useState<any[]>([]); 
  const [modalOpen, setModalOpen] = useState(false);
  
  // Estado do formulário de promoção
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('SUPORTE');
  const [filtroCandidato, setFiltroCandidato] = useState('');

  const carregarDados = () => {
    const token = localStorage.getItem('token');
    
    fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(async (r) => {
        if (!r.ok) throw new Error("Erro de permissão");
        return r.json();
    })
    .then(data => {
        if (Array.isArray(data)) {
            // Separa quem é STAFF de quem é COMUM
            const staff = data.filter((u: any) => checkIsStaff(u.role));
            const comuns = data.filter((u: any) => !checkIsStaff(u.role));
            
            setColabs(staff);
            setCandidatos(comuns);
        }
    })
    .catch(err => console.error(err));
  };

  useEffect(() => { carregarDados(); }, []);

  const handlePromover = async () => {
    if (!selectedUser) return dialog.showAlert("Selecione um usuário.");
    const token = localStorage.getItem('token');

    try {
        const res = await fetch('/api/admin/users', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ id: selectedUser, role: selectedRole })
        });

        if (res.ok) {
            dialog.showAlert({ type: 'success', description: "Usuário adicionado ao time!" });
            setModalOpen(false);
            carregarDados();
            setSelectedUser('');
        } else {
            dialog.showAlert({ type: 'danger', description: "Erro ao promover." });
        }
    } catch (error) { dialog.showAlert("Erro de conexão."); }
  };

  const handleDemitir = async (id: string) => {
      // PROMPT CONFIRM
      const confirmed = await dialog.showConfirm({
          title: 'Remover Colaborador',
          description: 'Este usuário perderá o acesso administrativo e voltará a ser um cliente comum.',
          type: 'danger',
          confirmText: 'Remover Acesso'
      });
      
      if(!confirmed) return;
      
      const token = localStorage.getItem('token');

      await fetch('/api/admin/users', {
          method: 'PUT',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ id, role: 'COMUM' }) 
      });
      carregarDados();
  }

  // ... (RESTO IGUAL) ...
  const candidatosFiltrados = candidatos.filter(c => 
      c.nome.toLowerCase().includes(filtroCandidato.toLowerCase()) || 
      c.email.includes(filtroCandidato)
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Time Interno</h1>
            <p className="text-sm text-slate-500">Gerencie quem tem acesso ao painel administrativo.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 font-bold shadow-sm">
            <UserPlus size={18} /> Novo Colaborador
        </button>
      </div>

      {/* MODAL DE PROMOÇÃO */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold text-lg">Adicionar ao Time</h3>
                    <button onClick={() => setModalOpen(false)}><X size={20}/></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buscar Usuário Existente</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-gray-400" size={16}/>
                            <input 
                                className="w-full pl-9 p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Nome ou Email do cliente..."
                                onChange={e => setFiltroCandidato(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto border rounded bg-gray-50 custom-scrollbar">
                        {candidatosFiltrados.length === 0 ? (
                            <p className="p-4 text-xs text-gray-400 text-center">Nenhum usuário 'COMUM' encontrado.</p>
                        ) : (
                            candidatosFiltrados.map(u => (
                                <div 
                                    key={u.id} 
                                    onClick={() => setSelectedUser(u.id)}
                                    className={`p-2 flex justify-between items-center cursor-pointer hover:bg-blue-100 transition ${selectedUser === u.id ? 'bg-blue-100 border-l-4 border-blue-600' : ''}`}
                                >
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">{u.nome}</p>
                                        <p className="text-xs text-slate-500">{u.email}</p>
                                    </div>
                                    {selectedUser === u.id && <UserCog size={16} className="text-blue-600"/>}
                                </div>
                            ))
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Definir Cargo</label>
                        <select 
                            className="w-full p-2 border rounded bg-white text-slate-700"
                            value={selectedRole}
                            onChange={e => setSelectedRole(e.target.value)}
                        >
                            <option value="SUPORTE">Suporte (Atendimento)</option>
                            <option value="SUPORTE_TI">Suporte T.I (Técnico)</option>
                            <option value="CONTADOR">Contador (Fiscal)</option>
                            <option value="ADMIN">Administrador</option>
                            <option value="MASTER">Master (Dono)</option>
                        </select>
                    </div>

                    <button 
                        onClick={handlePromover}
                        disabled={!selectedUser}
                        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 mt-4 font-bold transition shadow-md"
                    >
                        Confirmar Adição
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* TABELA */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b">
                <tr>
                    <th className="p-4 text-slate-500 font-bold uppercase text-xs">Nome</th>
                    <th className="p-4 text-slate-500 font-bold uppercase text-xs">Cargo Atual</th>
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
                            <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase ${
                                user.role === 'MASTER' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
                                user.role === 'ADMIN' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                                {ROLE_LABELS[user.role] || user.role}
                            </span>
                        </td>
                        <td className="p-4 text-right">
                            {user.role !== 'MASTER' && (
                                <button onClick={() => handleDemitir(user.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition" title="Remover acesso admin">
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