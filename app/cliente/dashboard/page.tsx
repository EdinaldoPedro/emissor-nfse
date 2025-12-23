'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar'; // Importamos o menu novo

export default function ClienteDashboard() {
  const [nomeUsuario, setNomeUsuario] = useState('');

  useEffect(() => {
    // Busca rápida do nome para saudação
    const userId = localStorage.getItem('userId');
    if(userId) {
        fetch('/api/perfil', { headers: {'x-user-id': userId}})
        .then(res => res.json())
        .then(data => setNomeUsuario(data.nome));
    }
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER NOVO */}
      <header className="flex justify-between items-center p-6 border-b bg-white sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-bold text-blue-600">NFSe Facil</h1>
          <p className="text-xs text-gray-500">Ambiente MEI</p>
        </div>
        
        <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden md:block">Olá, {nomeUsuario}</span>
            {/* AQUI ESTÁ O MENU HAMBÚRGUER */}
            <Sidebar /> 
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="p-8 max-w-5xl mx-auto">
        
        <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-800">Painel de Controle</h2>
            <p className="text-gray-500">Gerencie suas emissões de forma simples.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* CARD 1: EMITIR */}
            <Link href="/emitir">
            <div className="group p-8 border rounded-2xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition shadow-lg hover:shadow-xl h-full flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                    {/* Icone decorativo grande */}
                    <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
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

            {/* CARD 2: NOTAS EMITIDAS */}
            <Link href="/notas"> 
            <div className="group p-8 border rounded-2xl hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition shadow-sm hover:shadow-md h-full flex flex-col justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-700 mb-2">Notas Emitidas</h2>
                    <p className="text-gray-500 text-sm">Consulte histórico, baixe XML e PDF.</p>
                </div>
                <div className="mt-6 text-gray-400 group-hover:text-blue-600 transition">
                    Ver histórico ➜
                </div>
            </div>
            </Link>
        </div>

        {/* STATUS DO SISTEMA */}
        <div className="mt-12">
            <h3 className="font-bold text-gray-700 mb-4">Status da Conta</h3>
            <div className="bg-gray-50 rounded-lg p-4 border flex gap-4 items-center">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <p className="text-sm text-gray-600">Ambiente de Teste (Sandbox) conectado.</p>
            </div>
        </div>

      </div>
    </div>
  );
}