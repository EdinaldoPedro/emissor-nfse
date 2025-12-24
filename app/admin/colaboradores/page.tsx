'use client';
import { useEffect, useState } from 'react';
import { Shield, UserPlus, Trash2 } from 'lucide-react';

export default function GestaoColaboradores() {
  const [colabs, setColabs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(data => {
        // Filtra quem NÃO é comum (ou seja, Admins e Suporte)
        const staff = data.filter((u: any) => u.role !== 'COMUM');
        setColabs(staff);
    });
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Time Interno (Colaboradores)</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm hover:bg-blue-700">
            <UserPlus size={16} /> Novo Colaborador
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b">
                <tr>
                    <th className="p-4">Nome</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Permissão (Role)</th>
                    <th className="p-4 text-right">Ações</th>
                </tr>
            </thead>
            <tbody>
                {colabs.map(user => (
                    <tr key={user.id} className="border-b hover:bg-slate-50">
                        <td className="p-4 font-bold">{user.nome}</td>
                        <td className="p-4 text-slate-600">{user.email}</td>
                        <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                <Shield size={12} className="inline mr-1"/> {user.role}
                            </span>
                        </td>
                        <td className="p-4 text-right">
                            <button className="text-red-500 hover:bg-red-50 p-2 rounded">
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