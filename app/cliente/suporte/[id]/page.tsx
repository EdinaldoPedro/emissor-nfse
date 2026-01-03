'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, User, Shield, ArrowLeft, Loader2, Paperclip, Download, X, MessageSquare } from 'lucide-react';

export default function DetalheTicketCliente() {
  const { id } = useParams();
  const router = useRouter();
  
  const [ticket, setTicket] = useState<any>(null);
  const [novaMsg, setNovaMsg] = useState('');
  // Estado para o anexo
  const [anexo, setAnexo] = useState<{base64: string, nome: string} | null>(null);
  
  const msgEndRef = useRef<HTMLDivElement>(null);

  // Carrega e limpa a notificação (graças ao header x-user-id)
  const carregar = () => {
      const userId = localStorage.getItem('userId');
      fetch(`/api/suporte/tickets/${id}`, {
          headers: { 'x-user-id': userId || '' }
      }).then(r => r.json()).then(setTicket);
  };

  useEffect(() => { 
      carregar(); 
      const interval = setInterval(carregar, 5000); 
      return () => clearInterval(interval);
  }, [id]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticket?.mensagens]);

  // Função de Upload (Igual ao Admin)
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
      
      await fetch('/api/suporte/tickets/mensagem', {
          method: 'POST',
          headers: {'Content-Type':'application/json', 'x-user-id': userId || ''},
          body: JSON.stringify({ 
              ticketId: id, 
              mensagem: novaMsg,
              // Envia o anexo se existir
              anexoBase64: anexo?.base64,
              anexoNome: anexo?.nome
          })
      });
      setNovaMsg('');
      setAnexo(null); // Limpa anexo após envio
      carregar();
  };

  if (!ticket) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="flex flex-col h-screen bg-slate-100">
        {/* HEADER */}
        <div className="bg-white border-b p-4 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={() => router.push('/cliente/suporte')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                    <ArrowLeft size={20}/>
                </button>
                <div>
                    <h1 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        #{ticket.protocolo} <span className="text-sm font-normal text-slate-500 truncate max-w-[200px] hidden md:inline">- {ticket.assunto}</span>
                    </h1>
                    <p className="text-xs text-slate-500">
                        Status: <span className={`font-bold uppercase px-2 py-0.5 rounded text-[10px] ${
                            ticket.status === 'RESOLVIDO' ? 'bg-green-100 text-green-700' : 'bg-slate-100'
                        }`}>{ticket.status.replace('_', ' ')}</span>
                    </p>
                </div>
            </div>
        </div>

        {/* ÁREA DE MENSAGENS */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {ticket.mensagens.length === 0 && (
                <div className="text-center text-slate-400 mt-10">
                    <MessageSquare size={40} className="mx-auto mb-2 opacity-20"/>
                    <p>Nenhuma mensagem ainda.</p>
                </div>
            )}

            {ticket.mensagens.map((msg: any) => {
                if (msg.interno) return null; // Cliente não vê nota interna
                
                const isStaff = ['ADMIN','SUPORTE','MASTER', 'SUPORTE_TI', 'CONTADOR'].includes(msg.usuario.role);

                return (
                    <div key={msg.id} className={`flex ${!isStaff ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm relative ${
                            !isStaff ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                        }`}>
                            <div className={`flex items-center gap-2 mb-1 text-[10px] font-bold uppercase tracking-wider ${!isStaff ? 'text-blue-200' : 'text-slate-400'}`}>
                                {isStaff ? <Shield size={12}/> : <User size={12}/>}
                                <span>{msg.usuario.nome}</span>
                                <span>• {new Date(msg.createdAt).toLocaleTimeString().slice(0,5)}</span>
                            </div>
                            
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.mensagem}</p>
                            
                            {/* EXIBIÇÃO DE ANEXO NA MENSAGEM */}
                            {msg.anexoBase64 && (
                                <div className={`mt-2 pt-2 border-t ${!isStaff ? 'border-white/20' : 'border-slate-100'}`}>
                                    {msg.anexoBase64.startsWith('data:image') && (
                                        <img src={msg.anexoBase64} alt="Anexo" className="max-w-full h-auto rounded-lg mb-2 cursor-pointer border border-black/10" onClick={() => window.open(msg.anexoBase64)}/>
                                    )}
                                    <a href={msg.anexoBase64} download={msg.anexoNome} className={`flex items-center gap-2 text-xs font-bold underline ${!isStaff ? 'text-white' : 'text-blue-600'}`}>
                                        <Download size={14}/> {msg.anexoNome || 'Baixar Anexo'}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            <div ref={msgEndRef} />
        </div>

        {/* INPUT AREA (COM ANEXO) */}
        <div className="p-4 bg-white border-t shrink-0">
            <div className="max-w-4xl mx-auto">
                {/* Preview do Anexo Selecionado */}
                {anexo && (
                    <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold w-fit border border-blue-200 mb-2">
                        <Paperclip size={12}/> {anexo.nome}
                        <button onClick={() => setAnexo(null)} className="hover:text-red-500"><X size={12}/></button>
                    </div>
                )}

                <div className="flex gap-2">
                    {/* Botão de Clipe */}
                    <label className="p-3 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-xl cursor-pointer transition border border-transparent hover:border-slate-200 h-12 flex items-center justify-center">
                        <Paperclip size={20}/>
                        <input type="file" className="hidden" onChange={handleFile} accept="image/*,.pdf"/>
                    </label>

                    <input 
                        className="flex-1 p-3 border rounded-xl bg-slate-50 outline-blue-500 focus:bg-white transition"
                        placeholder="Digite sua resposta..."
                        value={novaMsg}
                        onChange={e => setNovaMsg(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && enviarMsg()}
                    />
                    
                    <button 
                        onClick={enviarMsg} 
                        disabled={!novaMsg.trim() && !anexo} // Habilita se tiver texto OU anexo
                        className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition shadow-md hover:shadow-lg h-12 w-12 flex items-center justify-center"
                    >
                        <Send size={20}/>
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}