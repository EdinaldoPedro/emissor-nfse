'use client';
import { useEffect, useState } from 'react';
import { Search, Filter, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

export default function AdminSuporte() {
  const [tickets, setTickets] = useState<any[]>([]); // Inicia como array vazio
  const [filtro, setFiltro] = useState('TODOS');
  const [loading, setLoading] = useState(true); // Adicionei loading

  const carregar = () => {
      const userId = localStorage.getItem('userId');
      fetch('/api/suporte/tickets', { headers: { 'x-user-id': userId || '' } })
        .then(r => r.json())
        .then(data => {
            // --- CORREÇÃO DE SEGURANÇA ---
            // Verifica se 'data' é realmente uma lista. Se for erro, define array vazio.
            if (Array.isArray(data)) {
                setTickets(data);
            } else {
                console.error("Erro ao buscar tickets:", data);
                setTickets([]); 
            }
        })
        .catch(err => {
            console.error("Falha na requisição:", err);
            setTickets([]);
        })
        .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  // Agora 'tickets' sempre será um array, então o filter não quebra
  const filtered = tickets.filter(t => {
      if (filtro === 'TODOS') return t.status !== 'FECHADO';
      if (filtro === 'ABERTO') return t.status === 'ABERTO';
      if (filtro === 'MEUS') return false; 
      return true;
  });

  const getPriorityColor = (p: string) => {
      if (p === 'CRITICA') return 'bg-red-100 text-red-700 border-red-200';
      if (p === 'ALTA') return 'bg-orange-100 text-orange-700 border-orange-200';
      return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando painel...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Helpdesk</h1>
          <div className="flex gap-2">
              {['TODOS', 'ABERTO', 'EM_ANDAMENTO'].map(s => (
                  <button 
                    key={s}
                    onClick={() => setFiltro(s)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold border transition ${filtro === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}
                  >
                      {s.replace('_', ' ')}
                  </button>
              ))}
          </div>
      </div>

      <div className="grid gap-3">
          {filtered.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-dashed text-gray-400">
                  Nenhum ticket encontrado neste filtro.
              </div>
          ) : (
              filtered.map(t => (
                  <Link key={t.id} href={`/admin/suporte/${t.id}`}>
                      <div className="bg-white p-4 rounded-xl border hover:border-blue-400 shadow-sm flex justify-between items-center group transition">
                          <div className="flex gap-4 items-center">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${t.status === 'RESOLVIDO' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                  #{t.protocolo}
                              </div>
                              <div>
                                  <h3 className="font-bold text-slate-800 group-hover:text-blue-600">{t.assunto}</h3>
                                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                      {/* Verifica se solicitante existe antes de acessar nome */}
                                      <span className="font-bold text-slate-700">{t.solicitante?.nome || 'Desconhecido'}</span>
                                      <span>•</span>
                                      <span>{new Date(t.createdAt).toLocaleString()}</span>
                                  </div>
                              </div>
                          </div>

                          <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${getPriorityColor(t.prioridade)}`}>
                                  {t.prioridade}
                              </span>
                              {t._count?.mensages > 0 && (
                                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs flex items-center gap-1">
                                      <Clock size={12}/> {t._count.mensages} msgs
                                  </span>
                              )}
                          </div>
                      </div>
                  </Link>
              ))
          )}
      </div>
    </div>
  );
}