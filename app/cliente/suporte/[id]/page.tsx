'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, User, Shield, ArrowLeft, Loader2, Paperclip, Download, X, MessageSquare, CheckCircle, Clock } from 'lucide-react';

export default function DetalheTicketCliente() {
  const { id } = useParams();
  const router = useRouter();
  
  const [ticket, setTicket] = useState<any>(null);
  const [novaMsg, setNovaMsg] = useState('');
  const [anexo, setAnexo] = useState<{base64: string, nome: string} | null>(null);
  
  const msgEndRef = useRef<HTMLDivElement>(null);

  const carregar = () => {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token'); // <--- 1. Token
      fetch(`/api/suporte/tickets/${id}`, {
          headers: { 
              'x-user-id': userId || '',
              'Authorization': `Bearer ${token}` // <--- 2. Envio
          }
      }).then(r => r.json()).then(setTicket);
  };

  useEffect(() => { 
      carregar(); 
      const interval = setInterval(carregar, 5000); 
      return () => clearInterval(interval);
  }, [id]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticket?.mensagens?.length]);

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
      const token = localStorage.getItem('token'); // <--- 1. Token
      
      await fetch('/api/suporte/tickets/mensagem', {
          method: 'POST',
          headers: {
              'Content-Type':'application/json', 
              'x-user-id': userId || '',
              'Authorization': `Bearer ${token}` // <--- 2. Envio
          },
          body: JSON.stringify({ 
              ticketId: id, 
              mensagem: novaMsg,
              anexoBase64: anexo?.base64,
              anexoNome: anexo?.nome
          })
      });
      setNovaMsg('');
      setAnexo(null);
      carregar();
  };

  if (!ticket) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
        
        {/* HEADER */}
        <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm shrink-0 z-10">
            <div className="flex items-center gap-4 max-w-5xl mx-auto w-full">
                <button onClick={() => router.push('/cliente/suporte')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition border border-transparent hover:border-slate-200">
                    <ArrowLeft size={20}/>
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded border border-blue-200">#{ticket.protocolo}</span>
                        <h1 className="font-bold text-lg text-slate-800 line-clamp-1">{ticket.assunto}</h1>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Clock size={12}/> Atualizado em: {new Date(ticket.updatedAt).toLocaleString()}
                    </p>
                </div>
                <div className="hidden md:block">
                    <span className={`font-bold uppercase px-3 py-1 rounded-full text-xs border flex items-center gap-1 ${
                        ticket.status === 'RESOLVIDO' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                        {ticket.status === 'RESOLVIDO' && <CheckCircle size={12}/>}
                        {ticket.status.replace('_', ' ')}
                    </span>
                </div>
            </div>
        </div>

        {/* ÁREA DE MENSAGENS */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-slate-50">
            <div className="max-w-3xl mx-auto space-y-6"> {/* <--- CENTRALIZAÇÃO */}
                {ticket.mensagens.length === 0 && (
                    <div className="text-center text-slate-400 mt-20 flex flex-col items-center">
                        <div className="bg-white p-4 rounded-full shadow-sm mb-3">
                            <MessageSquare size={32} className="opacity-50"/>
                        </div>
                        <p>Início do atendimento. Descreva seu problema.</p>
                    </div>
                )}

                {ticket.mensagens.map((msg: any) => {
                    if (msg.interno) return null; 
                    
                    const isStaff = ['ADMIN','SUPORTE','MASTER', 'SUPORTE_TI', 'CONTADOR'].includes(msg.usuario.role);
                    const isMe = !isStaff; 

                    return (
                        <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex max-w-[85%] md:max-w-[70%] gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                
                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm border mt-auto ${
                                    isMe ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-slate-600 border-slate-200'
                                }`}>
                                    {isMe ? <User size={14}/> : <Shield size={14}/>}
                                </div>

                                {/* Balão */}
                                <div className={`p-4 rounded-2xl shadow-sm relative text-sm border leading-relaxed whitespace-pre-wrap ${
                                    isMe 
                                        ? 'bg-indigo-600 text-white border-indigo-600 rounded-br-none' 
                                        : 'bg-white text-slate-700 border-slate-200 rounded-bl-none'
                                }`}>
                                    <div className={`flex items-center justify-between gap-4 mb-1 text-[10px] font-bold uppercase tracking-wider ${
                                        isMe ? 'text-indigo-200' : 'text-slate-400'
                                    }`}>
                                        <span>{msg.usuario.nome}</span>
                                        <span>{new Date(msg.createdAt).toLocaleTimeString().slice(0,5)}</span>
                                    </div>
                                    
                                    {msg.mensagem}
                                    
                                    {msg.anexoBase64 && (
                                        <div className={`mt-3 pt-3 border-t ${isMe ? 'border-white/20' : 'border-slate-100'}`}>
                                            <a href={msg.anexoBase64} download={msg.anexoNome} className={`flex items-center gap-2 text-xs font-bold underline decoration-dotted ${isMe ? 'text-white' : 'text-blue-600'}`}>
                                                <Download size={14}/> {msg.anexoNome || 'Baixar Anexo'}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={msgEndRef} />
            </div>
        </div>

        {/* INPUT AREA */}
        <div className="p-4 bg-white border-t shrink-0">
            <div className="max-w-3xl mx-auto"> {/* <--- CENTRALIZAÇÃO */}
                {anexo && (
                    <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold w-fit border border-blue-200 mb-2 animate-in slide-in-from-bottom-2">
                        <Paperclip size={12}/> {anexo.nome}
                        <button onClick={() => setAnexo(null)} className="hover:text-red-500 ml-2"><X size={14}/></button>
                    </div>
                )}

                <div className="flex gap-3 items-end">
                    <label className="p-3 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-xl cursor-pointer transition border border-transparent hover:border-slate-200 h-12 flex items-center justify-center bg-slate-50" title="Anexar">
                        <Paperclip size={20}/>
                        <input type="file" className="hidden" onChange={handleFile} accept="image/*,.pdf"/>
                    </label>

                    <div className="flex-1 relative">
                        <textarea 
                            className="w-full p-3 border rounded-xl outline-none resize-none h-12 min-h-[48px] max-h-32 transition focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-slate-700 bg-slate-50 focus:bg-white"
                            placeholder="Digite sua resposta..."
                            value={novaMsg}
                            onChange={e => setNovaMsg(e.target.value)}
                            onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMsg(); } }}
                        />
                    </div>
                    
                    <button 
                        onClick={enviarMsg} 
                        disabled={!novaMsg.trim() && !anexo} 
                        className="bg-indigo-600 text-white h-12 w-12 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition shadow-md hover:shadow-lg flex items-center justify-center"
                    >
                        <Send size={20}/>
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}