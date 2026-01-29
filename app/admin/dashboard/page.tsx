'use client';
import { useEffect, useState } from 'react';
import { Users, Building2, FileCheck, LifeBuoy, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>({ users: 0, empresas: 0, notas: 0, tickets: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    // Se não tiver token, redireciona pro login
    if (!token) {
        router.push('/login');
        return;
    }

    fetch('/api/admin/stats', {
        headers: {
            'Authorization': `Bearer ${token}` // <--- O SEGREDO ESTÁ AQUI
        }
    })
    .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
            throw new Error('Sem permissão');
        }
        return res.json();
    })
    .then(setStats)
    .catch((err) => {
        console.error(err);
        // Se der erro de permissão, talvez o token expirou
        if (err.message === 'Sem permissão') router.push('/login');
    })
    .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
      return <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2"/> Carregando dados...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Visão Geral</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-blue-100 rounded-full text-blue-600"><Users size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Clientes</p>
            <p className="text-3xl font-bold text-slate-800">{stats.clientes || stats.users || 0}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-purple-100 rounded-full text-purple-600"><Building2 size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Empresas</p>
            <p className="text-3xl font-bold text-slate-800">{stats.empresas || 0}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-green-100 rounded-full text-green-600"><FileCheck size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Notas</p>
            <p className="text-3xl font-bold text-slate-800">{stats.notas || 0}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-orange-100 rounded-full text-orange-600"><LifeBuoy size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Chamados</p>
            <p className="text-3xl font-bold text-slate-800">{stats.tickets || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}