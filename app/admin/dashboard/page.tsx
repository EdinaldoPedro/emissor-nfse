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

  const empresas = listaGeral.filter(u => u.cnpj && u.cnpj.length > 5); // Filtra quem tem CNPJ
  const usuarios = listaGeral.filter(u => !u.cnpj); // O resto são usuários comuns

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Visão Geral</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card Usuários */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-blue-100 rounded-full text-blue-600"><Users size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Usuários Totais</p>
            <p className="text-3xl font-bold text-slate-800">{stats.users}</p>
          </div>
        </div>

        {/* Card Empresas */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-purple-100 rounded-full text-purple-600"><Building2 size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Empresas (CNPJs)</p>
            <p className="text-3xl font-bold text-slate-800">{stats.empresas}</p>
          </div>
        </div>

        {/* Card Notas */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-green-100 rounded-full text-green-600"><FileCheck size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Notas Emitidas</p>
            <p className="text-3xl font-bold text-slate-800">{stats.notas}</p>
          </div>
        </div>
      </div>
      
      <div className="mt-8 bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400">
        <Activity className="mx-auto mb-2 opacity-50" size={40} />
        <p>Gráficos de desempenho em breve...</p>
      </div>
    </div>
  );
}