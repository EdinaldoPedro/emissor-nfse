'use client';

import Sidebar from '@/components/Sidebar';
import ListaVendas from '@/components/ListaVendas';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PaginaNotas() {
  return (
    <div className="min-h-screen bg-slate-50">
      
      {/* HEADER SIMPLES */}
      <header className="flex justify-between items-center p-6 border-b bg-white sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
            <Link href="/cliente/dashboard" className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
                <ArrowLeft size={20}/>
            </Link>
            <h1 className="text-xl font-bold text-slate-800">Notas Emitidas</h1>
        </div>
        <Sidebar />
      </header>

      {/* CONTEÚDO */}
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Gerenciamento Fiscal</h2>
            <p className="text-slate-500">Visualize todas as suas notas, status e realize cancelamentos.</p>
        </div>

        {/* Componente Reutilizável COMPLETO (sem compact=true) */}
        <ListaVendas />
        
      </div>
    </div>
  );
}