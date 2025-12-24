'use client';
import { useEffect, useState } from 'react';
import { Users, Building2, FileCheck, Activity } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, empresas: 0, notas: 0 });

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  // --- REMOVIDO O CÓDIGO QUE CAUSAVA O ERRO (filtros de lista) ---

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Visão Geral</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-blue-100 rounded-full text-blue-600"><Users size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Clientes Ativos</p>
            <p className="text-3xl font-bold text-slate-800">{stats.users}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-purple-100 rounded-full text-purple-600"><Building2 size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Empresas Cadastradas</p>
            <p className="text-3xl font-bold text-slate-800">{stats.empresas}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-green-100 rounded-full text-green-600"><FileCheck size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Notas Emitidas</p>
            <p className="text-3xl font-bold text-slate-800">{stats.notas}</p>
          </div>
        </div>
      </div>
    </div>
  );
}