'use client';
import { useEffect, useState } from 'react';
import { Shield, UserPlus, Trash2, Search, Save, X, UserCog } from 'lucide-react';
import { checkIsStaff, ROLE_LABELS } from '@/app/utils/permissions';

export default function GestaoColaboradores() {
  const [colabs, setColabs] = useState<any[]>([]);
  const [candidatos, setCandidatos] = useState<any[]>([]); // Lista de usuários COMUM para promover
  const [modalOpen, setModalOpen] = useState(false);
  
  // Estado do formulário de promoção
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('SUPORTE');
  const [filtroCandidato, setFiltroCandidato] = useState('');

  const carregarDados = () => {
    fetch('/api/admin/users').then(r => r.json()).then(data => {
        // Separa quem é STAFF de quem é COMUM
        const staff = data.filter((u: any) => checkIsStaff(u.role));
        const comuns = data.filter((u: any) => !checkIsStaff(u.role));
        
        setColabs(staff);
        setCandidatos(comuns);
    });
  };

  useEffect(() => { carregarDados(); }, []);

  const handlePromover = async () => {
    if (!selectedUser) return alert("Selecione um usuário.");

    try {
        const res = await fetch('/api/admin/users', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id: selectedUser, role: selectedRole })
        });

        if (res.ok) {
            alert("Usuário adicionado ao time!");
            setModalOpen(false);
            carregarDados();
            setSelectedUser('');
        } else {
            alert("Erro ao promover.");
        }
    } catch (error) { alert("Erro de conexão."); }
  };

  const handleDemitir = async (id: string) => {
      if(!confirm("Remover este usuário do time interno? Ele voltará a ser um cliente comum.")) return;
      
      await fetch('/api/admin/users', {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ id, role: 'COMUM' }) // Rebaixa para cliente
      });
      carregarDados();
  }

  // Filtra o dropdown de candidatos
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
        <button onClick={() => setModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700">
            <UserPlus size={18} /> Novo Colaborador
        </button>
      </div>

      {/* MODAL DE PROMOÇÃO */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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
                                className="w-full pl-9 p-2 border rounded focus:ring-2 focus:ring-blue-500"
                                placeholder="Nome ou Email do cliente..."
                                onChange={e => setFiltroCandidato(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto border rounded bg-gray-50">
                        {candidatosFiltrados.length === 0 ? (
                            <p className="p-4 text-xs text-gray-400 text-center">Nenhum usuário 'COMUM' encontrado.</p>
                        ) : (
                            candidatosFiltrados.map(u => (
                                <div 
                                    key={u.id} 
                                    onClick={() => setSelectedUser(u.id)}
                                    className={`p-2 flex justify-between items-center cursor-pointer hover:bg-blue-100 ${selectedUser === u.id ? 'bg-blue-100 border-l-4 border-blue-600' : ''}`}
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
                            className="w-full p-2 border rounded"
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
                        className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 mt-4 font-bold"
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
                    <th className="p-4">Nome</th>
                    <th className="p-4">Cargo Atual</th>
                    <th className="p-4 text-right">Ações</th>
                </tr>
            </thead>
            <tbody>
                {colabs.map(user => (
                    <tr key={user.id} className="border-b hover:bg-slate-50">
                        <td className="p-4">
                            <p className="font-bold text-slate-800">{user.nome}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                        </td>
                        <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                user.role === 'MASTER' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
                                user.role === 'ADMIN' ? 'bg-red-50 text-red-700 border-red-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                                {ROLE_LABELS[user.role] || user.role}
                            </span>
                        </td>
                        <td className="p-4 text-right">
                            <button onClick={() => handleDemitir(user.id)} className="text-red-500 hover:bg-red-50 p-2 rounded" title="Remover acesso admin">
                                <Trash2 size={16} />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}