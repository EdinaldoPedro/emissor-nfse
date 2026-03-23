'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Clock, Zap, AlertTriangle, Lock } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import ListaVendas from '@/components/ListaVendas';
import Vitrine from './Vitrine';

export default function ClienteDashboard() {
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [planoDetalhes, setPlanoDetalhes] = useState<any>(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');

    // Agora só verificamos o userId! O token vai sozinho no cookie.
    if(userId) {
        fetch('/api/perfil', { 
            headers: {
                'x-user-id': userId
                // Cabeçalho Authorization removido com sucesso!
            }
        })
        .then(res => {
            if (res.status === 401) {
                window.location.href = '/login';
                return null;
            }
            return res.json();
        })
        .then(data => {
            if(data) {
                setNomeUsuario(data.nome);
                setPlanoDetalhes(data.planoDetalhado);
            }
        })
        .catch(console.error);
    }
  }, []);
  
  const diasRestantes = planoDetalhes?.dataFim 
    ? Math.ceil((new Date(planoDetalhes.dataFim).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isAdminPlan = planoDetalhes?.slug === 'ADMIN_ACCESS';
  
  // === LÓGICA DE TRAVAMENTO ===
  const isBloqueado = planoDetalhes?.status === 'EXPIRADO' || planoDetalhes?.status === 'INATIVO' || (diasRestantes !== null && diasRestantes < 0);
  
  const tituloAlerta = planoDetalhes?.status === 'INATIVO' ? 'Nenhum Plano Ativo' : 'Plano Expirado';
  const descAlerta = planoDetalhes?.status === 'INATIVO' 
    ? 'Para começar a emitir notas, você precisa escolher um plano.' 
    : 'Suas funcionalidades estão bloqueadas. Renove para continuar.';

  return (
    <div className="min-h-screen bg-slate-50">
      
      <header className="flex justify-between items-center p-6 border-b bg-white sticky top-0 z-30 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-blue-600">NFSe Goo</h1>
          <p className="text-xs text-gray-500">Ambiente Beta</p>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden md:block">Olá, {nomeUsuario}</span>
            <Sidebar /> 
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-[1600px] mr-auto flex flex-col xl:flex-row gap-8">
        
        {/* === VITRINE (MARGEM ESQUERDA) === */}
        <div className="w-full xl:w-[320px] shrink-0">
            <div className="xl:sticky xl:top-32 h-[450px]">
                <Vitrine />
            </div>
        </div>

        {/* === CONTEÚDO PRINCIPAL === */}
        <div className="flex-1 space-y-8 min-w-0">
            
            {/* === ALERTAS DO SISTEMA (Topo) === */}
            {isBloqueado && (
                <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 animate-in slide-in-from-top">
                    <div className="flex items-center gap-4">
                        <div className="bg-red-100 p-3 rounded-full text-red-600">
                            <Lock size={32}/>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-red-700">{tituloAlerta}</h2>
                            <p className="text-red-600 text-sm mt-1">{descAlerta}</p>
                        </div>
                    </div>
                    <Link href="/configuracoes/minha-conta" className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition shadow-lg shadow-red-200">
                        {planoDetalhes?.status === 'INATIVO' ? 'Ver Planos' : 'Renovar Agora'}
                    </Link>
                </div>
            )}

            {!isAdminPlan && !isBloqueado && planoDetalhes?.slug === 'TRIAL' && diasRestantes !== null && diasRestantes >= 0 && (
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
                        </div>
                    </div>
                    <Link href="/configuracoes/minha-conta" className="bg-white text-indigo-700 px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-50 transition shadow-md w-full md:w-auto text-center">
                        Assinar Agora 🚀
                    </Link>
                </div>
            )}
            
            {/* Botões Rápidos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Link href={isBloqueado ? "/configuracoes/minha-conta" : "/emitir"} onClick={(e) => { if(isBloqueado) { e.preventDefault(); alert("Ação bloqueada! Verifique seu plano."); window.location.href="/configuracoes/minha-conta"; } }}>
                    <div className={`tour-emitir-card group p-8 border rounded-2xl transition shadow-sm h-full flex flex-col justify-between relative overflow-hidden ${isBloqueado ? 'bg-gray-100 border-gray-300 cursor-not-allowed grayscale' : 'bg-blue-600 border-blue-600 hover:bg-blue-700 hover:shadow-md text-white cursor-pointer'}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition transform group-hover:scale-110">
                            <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 drop-shadow-sm">
                                {isBloqueado && <Lock size={24}/>} Emitir Nova Nota
                            </h2>
                            <p className={`${isBloqueado ? 'text-gray-500' : 'text-blue-100'} text-sm font-medium`}>Integração com Portal Nacional.</p>
                        </div>
                        <div className={`mt-6 flex items-center gap-2 font-bold text-sm w-fit px-4 py-2 rounded-full backdrop-blur-sm ${isBloqueado ? 'bg-gray-200 text-gray-500' : 'bg-white/20'}`}>
                            {isBloqueado ? 'Bloqueado' : 'Começar Agora ➜'}
                        </div>
                    </div>
                </Link>

                <Link href="/cliente/notas"> 
                    <div className="tour-minhas-notas group p-8 border border-slate-200 rounded-2xl bg-white hover:border-blue-300 hover:shadow-md cursor-pointer transition h-full flex flex-col justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Minhas Notas</h2>
                            <p className="text-slate-500 text-sm">Consulte histórico completo. (Visualização liberada)</p>
                        </div>
                        <div className="mt-6 text-blue-600 font-bold group-hover:underline">
                            Ver todas as notas ➜
                        </div>
                    </div>
                </Link>
            </div>

            {/* Área de Atividade Recente */}
            <div className="bg-white p-6 md:p-8 border border-slate-200 rounded-2xl shadow-sm">
                <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
                    <h3 className="font-black text-xl text-slate-800">Atividade Recente</h3>
                    <Link href="/cliente/notas" className="text-sm font-bold text-blue-600 hover:text-blue-800 transition">Ver tudo</Link>
                </div>
                <ListaVendas compact={true} />
            </div>

        </div>
      </div>
    </div>
  );
}