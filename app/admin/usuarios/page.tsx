'use client';
import { useEffect, useState } from 'react';
import { Search, UserCog, LogIn, Edit, Save, X, Shield, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminUsers() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [term, setTerm] = useState('');
  
  // Estado de Edição
  const [editingUser, setEditingUser] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = () => {
    fetch('/api/admin/users').then(r => r.json()).then(setUsers);
  };

  // --- FUNÇÃO DE ACESSO SUPORTE ---
  const acessarComoUsuario = async (targetId: string) => {
    if(!confirm("⚠️ Atenção: Você sairá da sua conta de Admin e entrará como este usuário. Deseja continuar?")) return;

    try {
        const res = await fetch('/api/admin/impersonate', {
            method: 'POST',
            body: JSON.stringify({ targetUserId: targetId })
        });
        const data = await res.json();

        if (data.success) {
            // Troca as credenciais no navegador
            localStorage.setItem('userId', data.fakeSession.id);
            localStorage.setItem('userRole', data.fakeSession.role);
            localStorage.setItem('isSupportMode', 'true'); // Flag para mostrar aviso depois
            
            // Redireciona
            router.push('/cliente/dashboard');
        }
    } catch (error) {
        alert("Erro ao tentar acessar conta.");
    }
  };

  // --- SALVAR EDIÇÃO (PLANO/ROLE) ---
  const salvarEdicao = async () => {
    setLoadingAction(true);
    try {
        // Reutilizamos a rota PUT do perfil ou criamos uma específica para admin/users
        // Por praticidade, vamos assumir que o /api/admin/users aceita PUT (vamos criar abaixo se não existir, ou usar a lógica aqui)
        // Como não criamos a rota PUT no passo anterior, vamos adicionar a lógica aqui simulada ou você cria a rota.
        // Vamos assumir que você vai criar o PUT no /api/admin/users
        const res = await fetch('/api/admin/users', { 
            method: 'PUT',
            body: JSON.stringify(editingUser)
        });
        
        if (res.ok) {
            setEditingUser(null);
            carregarUsuarios();
            alert("Usuário atualizado!");
        }
    } catch (e) {
        alert("Erro ao salvar.");
    } finally {
        setLoadingAction(false);
    }
  }

  const filtered = users.filter(u => 
    u.nome.toLowerCase().includes(term.toLowerCase()) || 
    u.email.toLowerCase().includes(term.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Gestão de Usuários e Acesso</h1>
        <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
                placeholder="Buscar usuário..." 
                className="pl-10 p-2 border rounded-lg w-64 focus:outline-blue-500"
                onChange={e => setTerm(e.target.value)}
            />
        </div>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editingUser && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg shadow-xl w-96">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><UserCog /> Editar Acesso</h3>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase">Nome</label>
                          <input className="w-full p-2 border rounded bg-gray-100" value={editingUser.nome} disabled />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase">Role (Permissão)</label>
                          <select 
                            className="w-full p-2 border rounded"
                            value={editingUser.role}
                            onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                          >
                              <option value="COMUM">Usuário Comum</option>
                              <option value="ADMIN">Administrador</option>
                              <option value="SUPORTE">Suporte</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase">Plano</label>
                          <select 
                            className="w-full p-2 border rounded"
                            value={editingUser.plano}
                            onChange={e => setEditingUser({...editingUser, plano: e.target.value})}
                          >
                              <option value="GRATUITO">Gratuito</option>
                              <option value="PRO">Profissional (R$ 49,90)</option>
                              <option value="ENTERPRISE">Enterprise</option>
                          </select>
                      </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                      <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">Cancelar</button>
                      <button onClick={salvarEdicao} disabled={loadingAction} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                          <Save size={16} /> Salvar
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b">
                <tr>
                    <th className="p-4 font-semibold text-slate-600">Usuário</th>
                    <th className="p-4 font-semibold text-slate-600">Permissão</th>
                    <th className="p-4 font-semibold text-slate-600">Plano</th>
                    <th className="p-4 font-semibold text-slate-600 text-right">Ações</th>
                </tr>
            </thead>
            <tbody>
                {filtered.map(user => (
                    <tr key={user.id} className="border-b hover:bg-slate-50 transition">
                        <td className="p-4">
                            <p className="font-bold text-slate-800">{user.nome}</p>
                            <p className="text-slate-500 text-xs">{user.email}</p>
                        </td>
                        <td className="p-4">
                            <span className={`flex items-center gap-1 w-fit px-2 py-1 rounded text-xs font-bold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                <Shield size={12}/> {user.role}
                            </span>
                        </td>
                        <td className="p-4">
                            <span className="flex items-center gap-1 w-fit text-green-600 font-bold text-xs border border-green-200 px-2 py-1 rounded bg-green-50">
                                <CreditCard size={12}/> {user.plano}
                            </span>
                        </td>
                        <td className="p-4 text-right">
                            <div className="flex justify-end gap-2">
                                <button 
                                    onClick={() => acessarComoUsuario(user.id)}
                                    className="text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-3 py-1 rounded flex items-center gap-2 text-xs font-bold transition"
                                    title="Entrar no sistema como este usuário"
                                >
                                    <LogIn size={14} /> Acessar Conta
                                </button>
                                <button 
                                    onClick={() => setEditingUser(user)}
                                    className="text-blue-600 hover:bg-blue-50 p-2 rounded transition"
                                    title="Editar Plano/Permissão"
                                >
                                    <Edit size={18} />
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}