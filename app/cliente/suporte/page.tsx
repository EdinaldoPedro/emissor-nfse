'use client';
import { useEffect, useState } from 'react';
import { Plus, MessageSquare, Clock, CheckCircle, UserCheck, Check, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

export default function MeusChamados() {
  const [tickets, setTickets] = useState<any[]>([]); 
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]); // Estado para solicitações de contador
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    const userId = localStorage.getItem('userId');
    const headers = { 'x-user-id': userId || '' };
    
    setLoading(true);
    try {
        // 1. Busca Tickets
        const resTickets = await fetch('/api/suporte/tickets', { headers });
        const dataTickets = await resTickets.json();
        if (Array.isArray(dataTickets)) setTickets(dataTickets);
        else setTickets([]);

        // 2. Busca Solicitações de Contador (NOVO)
        const resSolicitacoes = await fetch('/api/contador/vinculo?mode=cliente', { headers });
        const dataSolicitacoes = await resSolicitacoes.json();
        if (Array.isArray(dataSolicitacoes)) setSolicitacoes(dataSolicitacoes);

    } catch (err) {
        console.error("Erro ao carregar dados:", err);
    } finally {
        setLoading(false);
    }
  };

  const responderSolicitacao = async (vinculoId: string, acao: 'APROVAR' | 'REJEITAR', nomeContador: string) => {
      const termo = acao === 'APROVAR' 
        ? `ATENÇÃO: Ao aprovar, você confirma que conhece o contador(a) "${nomeContador}" e AUTORIZA o acesso dele(a) aos dados fiscais e cadastrais da sua empresa nesta plataforma.\n\nDeseja confirmar o acesso?`
        : `Deseja recusar o acesso de "${nomeContador}"?`;

      if(!confirm(termo)) return;

      const userId = localStorage.getItem('userId');
      try {
          const res = await fetch('/api/contador/vinculo', {
              method: 'PUT',
              headers: {'Content-Type': 'application/json', 'x-user-id': userId || ''},
              body: JSON.stringify({ vinculoId, acao })
          });
          
          if(res.ok) {
              alert(acao === 'APROVAR' ? "Acesso concedido com sucesso!" : "Solicitação recusada.");
              // Remove da lista visualmente
              setSolicitacoes(prev => prev.filter(s => s.id !== vinculoId));
          } else {
              alert("Erro ao processar solicitação.");
          }
      } catch (e) { alert("Erro de conexão."); }
  };

  // --- FUNÇÃO DE STATUS ---
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
              <MessageSquare className="text-blue-600" size={24}/> Central de Suporte
          </h1>
          <Sidebar />
      </header>

      <div className="p-6 max-w-5xl mx-auto">
        
        {/* --- ÁREA DE SOLICITAÇÕES DE ACESSO (CONTADOR) --- */}
        {solicitacoes.length > 0 && (
            <div className="mb-10 bg-orange-50 border border-orange-200 rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4">
                <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-full shrink-0">
                        <UserCheck size={28}/>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-orange-900">Solicitações de Acesso Pendentes</h2>
                        <p className="text-orange-800 text-sm mt-1">
                            Os profissionais abaixo solicitaram acesso aos dados da sua empresa. 
                            Ao aceitar, você concede permissão para visualizarem notas e dados fiscais.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {solicitacoes.map(sol => (
                        <div key={sol.id} className="bg-white p-4 rounded-lg border border-orange-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500">
                                    {sol.contador.nome.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{sol.contador.nome}</p>
                                    <p className="text-xs text-slate-500">{sol.contador.email}</p>
                                </div>
                            </div>
                            
                            <div className="flex gap-2 w-full md:w-auto">
                                <button 
                                    onClick={() => responderSolicitacao(sol.id, 'APROVAR', sol.contador.nome)}
                                    className="flex-1 md:flex-none bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 flex items-center justify-center gap-2 transition"
                                >
                                    <Check size={16}/> Autorizar Acesso
                                </button>
                                <button 
                                    onClick={() => responderSolicitacao(sol.id, 'REJEITAR', sol.contador.nome)}
                                    className="flex-1 md:flex-none bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-50 flex items-center justify-center gap-2 transition"
                                >
                                    <X size={16}/> Negar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="mt-4 pt-3 border-t border-orange-200/50 flex items-center gap-2 text-[11px] text-orange-700/70 font-medium">
                    <AlertTriangle size={12}/>
                    <span>Atenção: A responsabilidade pelo compartilhamento de dados é exclusiva do titular da conta.</span>
                </div>
            </div>
        )}
        {/* -------------------------------------------------- */}

        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Meus Chamados</h2>
                <p className="text-slate-500 text-sm">Histórico de atendimento e dúvidas.</p>
            </div>
            <Link href="/cliente/suporte/novo" className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 font-bold shadow-lg shadow-blue-100 transition">
                <Plus size={20}/> Abrir Novo Chamado
            </Link>
        </div>

        {loading ? (
            <div className="text-center p-12 text-slate-400">Carregando informações...</div>
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