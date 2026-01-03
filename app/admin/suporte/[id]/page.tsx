'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, Shield, User, Lock, Clock, Book, Save, ArrowLeft, Paperclip, Download, X, MessageCircle, Loader2, AlertTriangle } from 'lucide-react';

const STATUS_MAP: Record<string, string> = {
    'ABERTO': 'Não Iniciado',
    'EM_ANDAMENTO': 'Em Andamento',
    'AGUARDANDO_CLIENTE': 'Aguardando retorno do cliente',
    'RESOLVIDO': 'Finalizado',
    'FECHADO': 'Inconclusivo'
};

const STATUS_COLORS: Record<string, string> = {
    'ABERTO': 'bg-gray-100 text-gray-700 border-gray-300',
    'EM_ANDAMENTO': 'bg-blue-50 text-blue-700 border-blue-200',
    'AGUARDANDO_CLIENTE': 'bg-orange-50 text-orange-700 border-orange-200',
    'RESOLVIDO': 'bg-green-50 text-green-700 border-green-200',
    'FECHADO': 'bg-red-50 text-red-700 border-red-200'
};

export default function ResolucaoAdmin() {
  const { id } = useParams();
  const router = useRouter();
  
  const [ticket, setTicket] = useState<any>(null);
  const [staffMembers, setStaffMembers] = useState<any[]>([]); 
  const [novaMsg, setNovaMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'CLIENTE' | 'INTERNO'>('CLIENTE');
  const [anexo, setAnexo] = useState<{base64: string, nome: string} | null>(null);
  const [tempoDecorrido, setTempoDecorrido] = useState('');
  
  // Estados de controle de UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const msgEndRef = useRef<HTMLDivElement>(null);

  // 1. Função de Carregamento Otimizada
  const carregarDados = useCallback(async () => {
      try {
          // Busca Ticket
          const resTicket = await fetch(`/api/suporte/tickets/${id}`);
          if (!resTicket.ok) throw new Error("Erro ao buscar ticket");
          const dataTicket = await resTicket.json();
          
          if (dataTicket.error) throw new Error(dataTicket.error);
          
          setTicket(dataTicket);

          // Busca Staff (apenas se ainda não tiver carregado)
          if (staffMembers.length === 0) {
              const resUsers = await fetch('/api/admin/users');
              if (resUsers.ok) {
                  const dataUsers = await resUsers.json();
                  const staff = dataUsers.filter((u: any) => ['ADMIN', 'MASTER', 'SUPORTE', 'SUPORTE_TI', 'CONTADOR'].includes(u.role));
                  setStaffMembers(staff);
              }
          }
          
          setError(''); // Limpa erros se der sucesso
      } catch (e: any) { 
          console.error("Erro no carregamento:", e);
          // Só define erro se não tiver dados anteriores (para não piscar a tela no refresh automático)
          if (!ticket) setError(e.message || "Erro desconhecido");
      } finally {
          setLoading(false);
      }
  }, [id, staffMembers.length, ticket]);

  // 2. Efeito Inicial e Polling (Timer)
  useEffect(() => { 
      carregarDados(); 
      const interval = setInterval(() => {
          // Polling silencioso (não ativa loading spinner)
          carregarDados();
      }, 10000); 
      return () => clearInterval(interval);
  }, [carregarDados]);

  // 3. Cronômetro Inteligente (Otimizado para não loopar)
  useEffect(() => {
      if (!ticket) return;
      
      const updateTimer = () => {
          const inicio = new Date(ticket.createdAt).getTime();
          const isFinalizado = ['RESOLVIDO', 'FECHADO'].includes(ticket.status);
          const fim = isFinalizado ? new Date(ticket.updatedAt).getTime() : new Date().getTime();

          const diff = fim - inicio;
          const dias = Math.floor(diff / 86400000);
          const horas = Math.floor((diff % 86400000) / 3600000);
          const minutos = Math.floor((diff % 3600000) / 60000);
          
          let str = dias > 0 ? `${dias}d ` : '';
          str += `${horas}h ${minutos}m`;
          if(isFinalizado) str += ' (Finalizado)';
          
          setTempoDecorrido(str);
      };

      updateTimer(); // Roda a primeira vez
      
      // Só cria o intervalo se o ticket NÃO estiver finalizado
      if (!['RESOLVIDO', 'FECHADO'].includes(ticket.status)) {
          const timer = setInterval(updateTimer, 60000);
          return () => clearInterval(timer);
      }
  }, [ticket?.status, ticket?.createdAt, ticket?.updatedAt]); // Dependências específicas para evitar loop

  // 4. Scroll Automático
  useEffect(() => { 
      msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [ticket?.mensagens?.length, activeTab]); // Só roda se mudar o número de mensagens ou a aba

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(file) {
          if (file.size > 10 * 1024 * 1024) return alert("Máximo 10MB");
          const reader = new FileReader();
          reader.onload = () => setAnexo({ base64: reader.result as string, nome: file.name });
          reader.readAsDataURL(file);
      }
  };

  const enviarMsg = async () => {
      if(!novaMsg.trim() && !anexo) return;
      const userId = localStorage.getItem('userId');
      
      // Feedback visual imediato (Opcional, mas bom para UX)
      const tempMsg = novaMsg;
      setNovaMsg(''); 
      
      try {
          await fetch('/api/suporte/tickets/mensagem', {
              method: 'POST',
              headers: {'Content-Type':'application/json', 'x-user-id': userId || ''},
              body: JSON.stringify({ 
                  ticketId: id, 
                  mensagem: tempMsg, 
                  interno: activeTab === 'INTERNO',
                  anexoBase64: anexo?.base64, 
                  anexoNome: anexo?.nome
              })
          });
          setAnexo(null);
          carregarDados(); // Recarrega para mostrar a msg oficial
      } catch (e) { 
          alert("Erro ao enviar mensagem."); 
          setNovaMsg(tempMsg); // Devolve o texto em caso de erro
      }
  };

  const atualizarTicket = async (campo: string, valor: string) => {
      if (campo === 'status' && !confirm(`Alterar status para "${STATUS_MAP[valor] || valor}"?`)) return;
      
      try {
          await fetch(`/api/suporte/tickets/${id}`, {
              method: 'PUT', headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ [campo]: valor })
          });
          carregarDados();
      } catch (e) { alert("Erro ao atualizar status."); }
  };

  // --- TRATAMENTO DE ESTADOS DE CARREGAMENTO E ERRO ---
  if (loading) return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-blue-600 gap-2">
          <Loader2 className="animate-spin" size={32}/>
          <span className="font-bold">Carregando atendimento...</span>
      </div>
  );

  if (error) return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-red-100 text-center max-w-md">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                  <AlertTriangle size={32}/>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Erro ao carregar</h2>
              <p className="text-slate-500 mb-6">{error}</p>
              <button onClick={() => router.push('/admin/suporte')} className="bg-slate-800 text-white px-6 py-2 rounded-lg hover:bg-slate-900 transition">
                  Voltar para Lista
              </button>
          </div>
      </div>
  );

  if (!ticket) return null; // Fallback final

  // Filtro de Mensagens
  const mensagensFiltradas = ticket.mensagens?.filter((m: any) => 
      activeTab === 'INTERNO' ? m.interno : !m.interno
  ) || [];

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
        
        {/* SIDEBAR DE INFORMAÇÕES */}
        <div className="w-80 bg-white border-r flex flex-col shrink-0 h-full shadow-lg z-10">
            <div className="p-6 border-b">
                <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-blue-600 mb-4 flex items-center gap-1 transition">
                    <ArrowLeft size={12}/> Voltar
                </button>
                <div className="flex justify-between items-start">
                    <h1 className="font-bold text-xl text-slate-800">#{ticket.protocolo}</h1>
                    <div className={`flex items-center gap-1 text-xs font-mono px-2 py-1 rounded border ${['RESOLVIDO','FECHADO'].includes(ticket.status) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        <Clock size={12}/> {tempoDecorrido}
                    </div>
                </div>
                <p className="text-sm text-slate-600 mt-2 font-medium line-clamp-3 bg-slate-50 p-2 rounded border border-slate-100" title={ticket.assunto}>
                    {ticket.assunto}
                </p>
                
                {ticket.anexoBase64 && (
                    <a href={ticket.anexoBase64} download={ticket.anexoNome} className="mt-3 flex items-center gap-2 p-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-100 transition w-full truncate">
                        <Paperclip size={14}/> Anexo Inicial
                    </a>
                )}
            </div>

            {/* INSTRUÇÕES DO CATÁLOGO (Se existir) */}
            {ticket.catalogItem?.instrucoes && (
                <div className="p-4 bg-yellow-50 border-b border-yellow-200">
                    <h4 className="text-[10px] font-black text-yellow-800 uppercase mb-2 flex items-center gap-2 tracking-wider">
                        <Book size={12}/> Procedimento Padrão
                    </h4>
                    <p className="text-xs text-yellow-900 leading-relaxed whitespace-pre-line bg-white/60 p-3 rounded border border-yellow-200/50">
                        {ticket.catalogItem.instrucoes}
                    </p>
                </div>
            )}
            
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Status do Atendimento</label>
                    <select className={`w-full p-2.5 rounded-lg border text-sm font-bold cursor-pointer outline-none transition ${STATUS_COLORS[ticket.status]}`}
                        value={ticket.status} onChange={(e) => atualizarTicket('status', e.target.value)}>
                        {Object.entries(STATUS_MAP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Atendente Responsável</label>
                    <select className="w-full p-2.5 rounded-lg border text-sm bg-white outline-blue-500 text-slate-700" value={ticket.atendenteId || ''} onChange={(e) => atualizarTicket('atendenteId', e.target.value)}>
                        <option value="">-- Atribuir a --</option>
                        {staffMembers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                </div>
                <div className="pt-4 border-t text-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Solicitante</span>
                    <p className="font-bold text-slate-700 mt-1">{ticket.solicitante.nome}</p>
                    <p className="text-slate-500 text-xs mb-2">{ticket.solicitante.email}</p>
                    
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4 block">Empresa Vinculada</span>
                    <p className="font-bold text-blue-600 text-xs truncate bg-blue-50 p-2 rounded border border-blue-100 mt-1">
                        {ticket.solicitante.empresa?.razaoSocial || 'Sem Empresa Vinculada'}
                    </p>
                </div>
            </div>
        </div>

        {/* ÁREA DE CHAT */}
        <div className="flex-1 flex flex-col bg-slate-100">
            {/* ABAS */}
            <div className="bg-white border-b flex px-6 shadow-sm z-10">
                <button onClick={() => setActiveTab('CLIENTE')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'CLIENTE' ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                    <MessageCircle size={18}/> Chat Cliente
                </button>
                <button onClick={() => setActiveTab('INTERNO')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'INTERNO' ? 'border-yellow-500 text-yellow-700 bg-yellow-50/30' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                    <Lock size={16}/> Notas Internas
                </button>
            </div>

            <div className={`flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar ${activeTab === 'INTERNO' ? 'bg-yellow-50/30' : ''}`}>
                <div className="flex justify-center mb-4">
                    <div className="bg-slate-200/80 text-slate-500 text-[10px] px-3 py-1 rounded-full uppercase font-bold shadow-sm backdrop-blur-sm">
                        {activeTab === 'INTERNO' ? '🔒 Área Exclusiva da Equipe' : '🌎 Visível para o Cliente'}
                    </div>
                </div>

                {mensagensFiltradas.length === 0 && (
                    <div className="text-center text-slate-400 mt-10 italic flex flex-col items-center gap-2">
                        <MessageCircle size={40} className="opacity-20"/>
                        Nenhuma mensagem nesta aba.
                    </div>
                )}

                {mensagensFiltradas.map((msg: any) => {
                    const isStaff = ['ADMIN','SUPORTE','MASTER', 'SUPORTE_TI', 'CONTADOR'].includes(msg.usuario.role);
                    return (
                        <div key={msg.id} className={`flex w-full ${isStaff ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl p-4 shadow-sm relative border ${
                                msg.interno ? 'bg-yellow-100 border-yellow-200 text-yellow-900' :
                                isStaff ? 'bg-blue-600 text-white border-blue-600 rounded-br-none' : 
                                'bg-white text-slate-800 border-slate-200 rounded-bl-none'
                            }`}>
                                <div className={`flex items-center gap-2 mb-1 text-[10px] uppercase font-bold tracking-wider ${isStaff && !msg.interno ? 'text-blue-200' : 'text-slate-400'}`}>
                                    {isStaff ? <Shield size={10}/> : <User size={10}/>}
                                    <span>{msg.usuario.nome}</span>
                                    <span>• {new Date(msg.createdAt).toLocaleTimeString().slice(0,5)}</span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.mensagem}</p>
                                {msg.anexoBase64 && (
                                    <div className={`mt-2 pt-2 border-t ${isStaff && !msg.interno ? 'border-white/20' : 'border-black/10'}`}>
                                        <a href={msg.anexoBase64} download={msg.anexoNome} className={`flex items-center gap-2 text-xs font-bold underline ${isStaff && !msg.interno ? 'text-white' : 'text-blue-600'}`}>
                                            <Download size={14}/> {msg.anexoNome}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                <div ref={msgEndRef} />
            </div>

            {/* INPUT */}
            <div className={`p-4 border-t ${activeTab === 'INTERNO' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
                <div className="max-w-4xl mx-auto">
                    {anexo && (
                        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold w-fit border border-blue-200 mb-2 animate-in slide-in-from-bottom-2">
                            <Paperclip size={12}/> {anexo.nome}
                            <button onClick={() => setAnexo(null)} className="hover:text-red-500"><X size={12}/></button>
                        </div>
                    )}
                    <div className="flex gap-3 items-end">
                        <label className="p-3 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-xl cursor-pointer transition border border-transparent hover:border-slate-200 h-14 flex items-center" title="Anexar Arquivo">
                            <Paperclip size={20}/>
                            <input type="file" className="hidden" onChange={handleFile} accept="image/*,.pdf"/>
                        </label>
                        
                        <textarea 
                            className={`flex-1 p-3 border-2 rounded-xl outline-none resize-none h-14 transition focus:ring-0 ${activeTab === 'INTERNO' ? 'border-yellow-300 bg-yellow-50 focus:border-yellow-500 text-yellow-900 placeholder-yellow-600/50' : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400'}`}
                            placeholder={activeTab === 'INTERNO' ? "Escreva uma nota interna (invisível ao cliente)..." : "Escreva sua resposta para o cliente..."}
                            value={novaMsg} 
                            onChange={e => setNovaMsg(e.target.value)}
                            onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMsg(); } }}
                        />
                        
                        <button 
                            onClick={enviarMsg} 
                            disabled={!novaMsg.trim() && !anexo}
                            className={`h-14 w-14 rounded-xl transition flex items-center justify-center text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none ${activeTab === 'INTERNO' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            <Send size={20}/>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}