'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import ListaVendas from '@/components/ListaVendas'; // <--- IMPORT NOVO

export default function ClienteDashboard() {
  const [nomeUsuario, setNomeUsuario] = useState('');

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if(userId) {
        fetch('/api/perfil', { headers: {'x-user-id': userId}})
        .then(res => res.json())
        .then(data => setNomeUsuario(data.nome));
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      
      {/* HEADER */}
      <header className="flex justify-between items-center p-6 border-b bg-white sticky top-0 z-30 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-blue-600">NFSe Facil</h1>
          <p className="text-xs text-gray-500">Ambiente Beta</p>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden md:block">Olá, {nomeUsuario}</span>
            <Sidebar /> 
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        
        {/* CARDS DE AÇÃO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href="/emitir">
                <div className="group p-8 border rounded-2xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition shadow-lg h-full flex flex-col justify-between relative overflow-hidden">
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
                <div className="group p-8 border rounded-2xl bg-white hover:border-blue-300 hover:shadow-md cursor-pointer transition h-full flex flex-col justify-between">
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

        {/* LISTA DE VENDAS RECENTES (SUBSTITUI O STATUS DA CONTA) */}
        <div>
            <div className="flex justify-between items-end mb-4">
                <h3 className="font-bold text-xl text-slate-700">Atividade Recente</h3>
                <Link href="/cliente/notas" className="text-sm text-blue-600 hover:underline">Ver tudo</Link>
            </div>
            
            {/* Componente Reutilizável em modo compacto */}
            <ListaVendas compact={true} />
        </div>

        {/* STATUS DISCRETO NO RODAPÉ */}
        <div className="flex items-center gap-2 justify-center text-xs text-slate-400 mt-8">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Sistema Operacional • Ambiente de Testes
        </div>

      </div>
    </div>
  );
}