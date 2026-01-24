'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Clock, Zap } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import ListaVendas from '@/components/ListaVendas';

export default function ClienteDashboard() {
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [planoDetalhes, setPlanoDetalhes] = useState<any>(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if(userId) {
        fetch('/api/perfil', { headers: {'x-user-id': userId}})
        .then(res => res.json())
        .then(data => {
            setNomeUsuario(data.nome);
            setPlanoDetalhes(data.planoDetalhado);
        });
    }
  }, []);
  
  const diasRestantes = planoDetalhes?.dataFim 
    ? Math.ceil((new Date(planoDetalhes.dataFim).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Lógica para esconder banner se for Admin
  const isAdminPlan = planoDetalhes?.slug === 'ADMIN_ACCESS';

  return (
    <div className="min-h-screen bg-slate-50">
      
      <header className="flex justify-between items-center p-6 border-b bg-white sticky top-0 z-30 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-blue-600">NFSe Fácil</h1>
          <p className="text-xs text-gray-500">Ambiente Beta</p>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden md:block">Olá, {nomeUsuario}</span>
            <Sidebar /> 
        </div>
      </header>

      <div className="p-8 max-w-6xl mx-auto space-y-8">
        
        {/* BANNER DE BOAS VINDAS (Só mostra se for Trial E não for Admin) */}
        {!isAdminPlan && planoDetalhes?.slug === 'TRIAL' && diasRestantes !== null && diasRestantes >= 0 && (
            <div className="tour-emitir-card bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4 animate-in slide-in-from-top duration-500">
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                        <Clock size={32} className="text-white"/>
                    </div>
                    <div>
                        <h2 className="font-bold text-xl">Período de Teste Grátis</h2>
                        <p className="text-indigo-100 text-sm mt-1">
                            Aproveite! Faltam <strong>{diasRestantes} dias</strong> para encerrar seu acesso.
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs bg-black/20 w-fit px-3 py-1 rounded-full">
                            <Zap size={12}/>
                            <span>{planoDetalhes.usoEmissoes} de {planoDetalhes.limiteEmissoes} notas utilizadas</span>
                        </div>
                    </div>
                </div>
                <Link href="/configuracoes/minha-conta" className="bg-white text-indigo-700 px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-50 transition shadow-md w-full md:w-auto text-center">
                    Assinar Agora 🚀
                </Link>
            </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href="/emitir">
                <div className="tour-emitir-card group p-8 border rounded-2xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition shadow-lg h-full flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                        <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Emitir Nova Nota</h2>
                        <p className="text-blue-100 text-sm">Integração com Portal Nacional.</p>
                    </div>
                    <div className="mt-6 flex items-center gap-2 font-bold text-sm bg-white/20 w-fit px-4 py-2 rounded-full backdrop-blur-sm">
                        Começar Agora ➜
                    </div>
                </div>
            </Link>

            <Link href="/cliente/notas"> 
                <div className="tour-minhas-notas group p-8 border rounded-2xl bg-white hover:border-blue-300 hover:shadow-md cursor-pointer transition h-full flex flex-col justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-700 mb-2">Minhas Notas</h2>
                        <p className="text-slate-500 text-sm">Consulte histórico completo, baixe XML/PDF e gerencie cancelamentos.</p>
                    </div>
                    <div className="mt-6 text-blue-600 font-medium group-hover:underline">
                        Ver todas as notas ➜
                    </div>
                </div>
            </Link>
        </div>

        <div>
            <div className="flex justify-between items-end mb-4">
                <h3 className="font-bold text-xl text-slate-700">Atividade Recente</h3>
                <Link href="/cliente/notas" className="text-sm text-blue-600 hover:underline">Ver tudo</Link>
            </div>
            <ListaVendas compact={true} />
        </div>
      </div>
    </div>
  );
}