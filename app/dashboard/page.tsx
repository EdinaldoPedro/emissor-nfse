'use client';
import { useEffect, useState } from 'react';
import { Users, Building2, FileCheck, LifeBuoy } from 'lucide-react';

export default function AdminDashboard() {
  // Adicionei 'tickets' ao estado
  const [stats, setStats] = useState({ users: 0, empresas: 0, notas: 0, tickets: 0 });

  useEffect(() => {
    // Você precisará atualizar a API /api/admin/stats para retornar 'tickets' também
    // Por enquanto, o front está preparado
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-800 mb-8">Visão Geral</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6"> {/* Mudou para 4 colunas */}
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-blue-100 rounded-full text-blue-600"><Users size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Clientes</p>
            <p className="text-3xl font-bold text-slate-800">{stats.users}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-purple-100 rounded-full text-purple-600"><Building2 size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Empresas</p>
            <p className="text-3xl font-bold text-slate-800">{stats.empresas}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
          <div className="p-4 bg-green-100 rounded-full text-green-600"><FileCheck size={28} /></div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Notas</p>
            <p className="text-3xl font-bold text-slate-800">{stats.notas}</p>
          </div>
        </div>

        {/* --- NOVO CARD DE SUPORTE --- */}
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