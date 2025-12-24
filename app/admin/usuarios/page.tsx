'use client';
import { useEffect, useState } from 'react';
import { Search, LogIn, Building, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function GestaoClientes() {
  const router = useRouter();
  const [clientes, setClientes] = useState<any[]>([]);
  const [term, setTerm] = useState('');

  useEffect(() => {
    // Busca todos e filtra no front ou cria endpoint específico
    fetch('/api/admin/users').then(r => r.json()).then(data => {
        // Filtra APENAS quem é cliente (COMUM)
        const apenasClientes = data.filter((u: any) => u.role === 'COMUM');
        setClientes(apenasClientes);
    });
  }, []);

  const acessarSuporte = async (targetId: string) => {
    // 1. Backup do Admin
    const adminId = localStorage.getItem('userId');
    if (adminId) localStorage.setItem('adminBackUpId', adminId);

    // 2. Impersonate
    try {
        const res = await fetch('/api/admin/impersonate', {
            method: 'POST', body: JSON.stringify({ targetUserId: targetId })
        });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('userId', data.fakeSession.id);
            localStorage.setItem('userRole', data.fakeSession.role);
            localStorage.setItem('isSupportMode', 'true');
            router.push('/cliente/dashboard');
        }
    } catch (error) { alert("Erro ao acessar."); }
  };

  const filtered = clientes.filter(c => c.nome.toLowerCase().includes(term.toLowerCase()));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Clientes (SaaS)</h1>
        <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input placeholder="Buscar cliente..." className="pl-10 p-2 border rounded-lg w-64" onChange={e => setTerm(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b">
                <tr>
                    <th className="p-4">Cliente (Usuário)</th>
                    <th className="p-4">Empresa Vinculada</th>
                    <th className="p-4">Contrato (Plano)</th>
                    <th className="p-4 text-right">Ações</th>
                </tr>
            </thead>
            <tbody>
                {filtered.map(cli => (
                    <tr key={cli.id} className="border-b hover:bg-slate-50">
                        <td className="p-4">
                            <p className="font-bold text-slate-800">{cli.nome}</p>
                            <p className="text-xs text-slate-500">{cli.email}</p>
                        </td>
                        <td className="p-4">
                            {cli.empresa ? (
                                <div>
                                    <p className="font-medium text-slate-700">{cli.empresa.razaoSocial}</p>
                                    <p className="text-xs text-slate-500 font-mono">CNPJ: {cli.empresa.documento}</p>
                                </div>
                            ) : (
                                <span className="text-red-500 text-xs bg-red-50 px-2 py-1 rounded">Sem Empresa</span>
                            )}
                        </td>
                        <td className="p-4">
                            <span className="flex items-center gap-1 w-fit text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-200">
                                <CreditCard size={12}/> {cli.plano || 'GRATUITO'}
                            </span>
                        </td>
                        <td className="p-4 text-right">
                            <button 
                                onClick={() => acessarSuporte(cli.id)}
                                className="bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-2 ml-auto transition"
                            >
                                <LogIn size={14}/> Acessar Painel
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