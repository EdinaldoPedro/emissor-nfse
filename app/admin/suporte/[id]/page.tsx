'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, Shield, User, Lock, Clock, UserCog, Save, ArrowLeft, Paperclip, Download, X, MessageCircle, Book, Loader2 } from 'lucide-react';

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
  
  const msgEndRef = useRef<HTMLDivElement>(null);

  const carregarDados = async () => {
      try {
          const resTicket = await fetch(`/api/suporte/tickets/${id}`);
          const dataTicket = await resTicket.json();
          setTicket(dataTicket);

          const resUsers = await fetch('/api/admin/users');
          const dataUsers = await resUsers.json();
          const staff = dataUsers.filter((u: any) => ['ADMIN', 'MASTER', 'SUPORTE', 'SUPORTE_TI', 'CONTADOR'].includes(u.role));
          setStaffMembers(staff);
      } catch (e) { console.error("Erro ao carregar", e); }
  };

  useEffect(() => { 
      carregarDados(); 
      const interval = setInterval(carregarDados, 10000); 
      return () => clearInterval(interval);
  }, [id]);

  // Cronômetro
  useEffect(() => {
      if (!ticket) return;
      const calcTempo = () => {
          const inicio = new Date(ticket.createdAt).getTime();
          const isFinalizado = ['RESOLVIDO', 'FECHADO'].includes(ticket.status);
          const fim = isFinalizado ? new Date(ticket.updatedAt).getTime() : new Date().getTime();

          const diff = fim - inicio;
          const dias = Math.floor(diff / 86400000);
          const horas = Math.floor((diff % 86400000) / 3600000);
          const minutos = Math.floor((diff % 3600000) / 60000);

          let str = '';
          if(dias > 0) str += `${dias}d `;
          str += `${horas}h ${minutos}m`;
          if(isFinalizado) str += ' (Encerrado)';
          
          setTempoDecorrido(str);
      };
      calcTempo();
      const timer = setInterval(calcTempo, 60000);
      return () => clearInterval(timer);
  }, [ticket]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticket?.mensagens, activeTab]);

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
      const isInterno = activeTab === 'INTERNO';

      try {
          await fetch('/api/suporte/tickets/mensagem', {
              method: 'POST',
              headers: {'Content-Type':'application/json', 'x-user-id': userId || ''},
              body: JSON.stringify({ 
                  ticketId: id, 
                  mensagem: novaMsg, 
                  interno: isInterno,
                  anexoBase64: anexo?.base64,
                  anexoNome: anexo?.nome
              })
          });
          setNovaMsg('');
          setAnexo(null);
          carregarDados();
      } catch (e) { alert("Erro ao enviar mensagem."); }
  };

  const atualizarTicket = async (campo: string, valor: string) => {
      if (campo === 'status') {
          const nomeStatus = STATUS_MAP[valor] || valor;
          if (!confirm(`Tem certeza que deseja alterar o status para "${nomeStatus}"?`)) return;
      }

      await fetch(`/api/suporte/tickets/${id}`, {
          method: 'PUT', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ [campo]: valor })
      });
      carregarDados();
  };

  if (!ticket) return <div className="flex h-screen items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2"/> Carregando...</div>;

  const mensagensFiltradas = ticket.mensagens.filter((m: any) => 
      activeTab === 'INTERNO' ? m.interno : !m.interno
  );

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
        
        {/* SIDEBAR */}
        <div className="w-80 bg-white border-r flex flex-col shrink-0 h-full shadow-lg z-10">
            <div className="p-6 border-b">
                <button onClick={() => router.back()} className="text-xs text-slate-500 hover:text-blue-600 mb-4 flex items-center gap-1"><ArrowLeft size={12}/> Voltar</button>
                <div className="flex justify-between items-start">
                    <h1 className="font-bold text-xl text-slate-800">#{ticket.protocolo}</h1>
                    <div className={`flex items-center gap-1 text-xs font-mono px-2 py-1 rounded ${['RESOLVIDO','FECHADO'].includes(ticket.status) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        <Clock size={12}/> {tempoDecorrido}
                    </div>
                </div>
                <p className="text-sm text-slate-600 mt-2 font-medium line-clamp-3" title={ticket.assunto}>{ticket.assunto}</p>
                
                {ticket.anexoBase64 && (
                    <a href={ticket.anexoBase64} download={ticket.anexoNome} className="mt-3 flex items-center gap-2 p-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-100 transition truncate w-full">
                        <Paperclip size={14}/> Anexo Inicial
                    </a>
                )}
            </div>

            {/* INSTRUÇÕES DO CATÁLOGO */}
            {ticket.catalogItem?.instrucoes && (
                <div className="p-4 bg-yellow-50 border-b border-yellow-200">
                    <h4 className="text-xs font-bold text-yellow-800 uppercase mb-2 flex items-center gap-2">
                        <Book size={12}/> Procedimento Interno
                    </h4>
                    <p className="text-xs text-yellow-900 leading-relaxed whitespace-pre-line bg-white/50 p-2 rounded border border-yellow-100">
                        {ticket.catalogItem.instrucoes}
                    </p>
                </div>
            )}
            
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Status do Atendimento</label>
                    <select className={`w-full p-2.5 rounded-lg border text-sm font-bold cursor-pointer outline-none ${STATUS_COLORS[ticket.status]}`}
                        value={ticket.status} onChange={(e) => atualizarTicket('status', e.target.value)}>
                        {Object.entries(STATUS_MAP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Atendente</label>
                    <select className="w-full p-2.5 rounded-lg border text-sm bg-white outline-blue-500" value={ticket.atendenteId || ''} onChange={(e) => atualizarTicket('atendenteId', e.target.value)}>
                        <option value="">-- Atribuir a --</option>
                        {staffMembers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                </div>
                <div className="pt-4 border-t text-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase">Cliente</span>
                    <p className="font-bold text-slate-700">{ticket.solicitante.nome}</p>
                    <p className="text-slate-500 text-xs mb-2">{ticket.solicitante.email}</p>
                    <p className="font-bold text-blue-600 text-xs truncate bg-blue-50 p-2 rounded">
                        {ticket.solicitante.empresa?.razaoSocial || 'Sem Empresa Vinculada'}
                    </p>
                </div>
            </div>
        </div>

        {/* ÁREA DE CHAT */}
        <div className="flex-1 flex flex-col bg-slate-100">
            {/* ABAS */}
            <div className="bg-white border-b flex px-6 shadow-sm z-10">
                <button onClick={() => setActiveTab('CLIENTE')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'CLIENTE' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                    <MessageCircle size={18}/> Chat Cliente
                </button>
                <button onClick={() => setActiveTab('INTERNO')} className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'INTERNO' ? 'border-yellow-500 text-yellow-700 bg-yellow-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>
                    <Lock size={16}/> Notas Internas
                </button>
            </div>

            <div className={`flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar ${activeTab === 'INTERNO' ? 'bg-yellow-50/30' : ''}`}>
                <div className="flex justify-center mb-4">
                    <div className="bg-slate-200 text-slate-500 text-[10px] px-3 py-1 rounded-full uppercase font-bold shadow-sm">
                        {activeTab === 'INTERNO' ? 'Área Exclusiva da Equipe' : 'Visível para o Cliente'}
                    </div>
                </div>

                {mensagensFiltradas.length === 0 && (
                    <div className="text-center text-slate-400 mt-10 italic">
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
                        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold w-fit border border-blue-200 mb-2">
                            <Paperclip size={12}/> {anexo.nome}
                            <button onClick={() => setAnexo(null)}><X size={12}/></button>
                        </div>
                    )}
                    <div className="flex gap-3 items-end">
                        <label className="p-3 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-xl cursor-pointer transition border border-transparent hover:border-slate-200 h-14 flex items-center">
                            <Paperclip size={20}/>
                            <input type="file" className="hidden" onChange={handleFile} accept="image/*,.pdf"/>
                        </label>
                        <textarea 
                            className={`flex-1 p-3 border-2 rounded-xl outline-none resize-none h-14 transition ${activeTab === 'INTERNO' ? 'border-yellow-300 bg-yellow-100 focus:border-yellow-500 text-yellow-900 placeholder-yellow-600' : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-400'}`}
                            placeholder={activeTab === 'INTERNO' ? "Escreva uma nota interna..." : "Escreva para o cliente..."}
                            value={novaMsg} onChange={e => setNovaMsg(e.target.value)}
                            onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMsg(); } }}
                        />
                        <button onClick={enviarMsg} disabled={!novaMsg.trim() && !anexo} className={`h-14 w-14 rounded-xl transition flex items-center justify-center text-white shadow-md hover:shadow-lg disabled:opacity-50 ${activeTab === 'INTERNO' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            <Send size={20}/>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}