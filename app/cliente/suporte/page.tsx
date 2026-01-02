'use client';
import { useEffect, useState } from 'react';
import { Plus, MessageSquare, Clock, CheckCircle, Search, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

export default function MeusChamados() {
  const [tickets, setTickets] = useState<any[]>([]); // Inicia vazio
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    
    fetch('/api/suporte/tickets', { headers: { 'x-user-id': userId || '' } })
      .then(r => r.json())
      .then(data => { 
          // --- CORREÇÃO DE SEGURANÇA ---
          if (Array.isArray(data)) {
              setTickets(data); 
          } else {
              console.error("API retornou erro:", data);
              setTickets([]); 
          }
      })
      .catch(err => {
          console.error("Erro de conexão:", err);
          setTickets([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // FUNÇÃO CORRETA DE CORES E NOMES
  const getStatusInfo = (s: string) => {
      switch(s) {
          case 'ABERTO': 
              return { label: 'Não Iniciado', class: 'bg-blue-100 text-blue-700 border-blue-200' };
          case 'EM_ANDAMENTO': 
              return { label: 'Em Andamento', class: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
          case 'AGUARDANDO_CLIENTE': 
              return { label: 'Aguardando Você', class: 'bg-orange-100 text-orange-700 border-orange-200' };
          case 'RESOLVIDO': 
              return { label: 'Concluído', class: 'bg-green-100 text-green-700 border-green-200' };
          case 'FECHADO': 
              return { label: 'Inconclusivo/Fechado', class: 'bg-gray-100 text-gray-600 border-gray-200' };
          default: 
              return { label: s, class: 'bg-gray-100 text-gray-600' };
      }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex justify-between items-center p-6 border-b bg-white sticky top-0 z-10 shadow-sm">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare className="text-blue-600" size={24}/> Meus Chamados
          </h1>
          <Sidebar />
      </header>

      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Central de Ajuda</h2>
                <p className="text-slate-500 text-sm">Acompanhe suas solicitações e tire dúvidas.</p>
            </div>
            <Link href="/cliente/suporte/novo" className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 font-bold shadow-lg shadow-blue-100 transition">
                <Plus size={20}/> Abrir Novo Chamado
            </Link>
        </div>

        {loading ? (
            <div className="text-center p-12 text-slate-400">Carregando seus chamados...</div>
        ) : tickets.length === 0 ? (
            <div className="text-center p-12 bg-white rounded-xl shadow-sm border border-dashed border-slate-300">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="text-slate-300" size={32}/>
                </div>
                <h3 className="font-bold text-slate-700 text-lg">Nenhum chamado encontrado</h3>
                <p className="text-slate-500 mb-6">Precisa de ajuda com alguma nota ou configuração?</p>
                <Link href="/cliente/suporte/novo" className="text-blue-600 font-bold hover:underline">
                    Abra seu primeiro ticket
                </Link>
            </div>
        ) : (
            <div className="space-y-4">
                {tickets.map(t => (
                    <Link key={t.id} href={`/cliente/suporte/${t.id}`}>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition flex justify-between items-center group cursor-pointer">
                            <div className="flex gap-5 items-center">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition`}>
                                    #{t.protocolo}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition">{t.assunto}</h3>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                        <span className="flex items-center gap-1"><Clock size={12}/> {new Date(t.createdAt).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span className="font-medium bg-slate-100 px-2 py-0.5 rounded">{t.categoria || 'Geral'}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                                {/* CORREÇÃO AQUI: Usando a função correta */}
                                {(() => {
                                    const statusInfo = getStatusInfo(t.status);
                                    return (
                                        <span className={`px-3 py-1 rounded text-xs font-bold uppercase border flex items-center gap-1 ${statusInfo.class}`}>
                                            {t.status === 'RESOLVIDO' && <CheckCircle size={12}/>}
                                            {statusInfo.label}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}