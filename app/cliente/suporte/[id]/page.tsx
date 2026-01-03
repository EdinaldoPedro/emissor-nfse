'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, User, Shield, ArrowLeft, Loader2, Paperclip, Download } from 'lucide-react';

export default function DetalheTicketCliente() {
  const { id } = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [novaMsg, setNovaMsg] = useState('');
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

  const enviarMsg = async () => {
      if(!novaMsg.trim()) return;
      const userId = localStorage.getItem('userId');
      
      await fetch('/api/suporte/tickets/mensagem', {
          method: 'POST',
          headers: {'Content-Type':'application/json', 'x-user-id': userId || ''},
          body: JSON.stringify({ 
              ticketId: id, 
              mensagem: novaMsg 
          })
      });
      setNovaMsg('');
      carregar();
  };

  if (!ticket) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <div className="flex flex-col h-screen bg-slate-100">
        <div className="bg-white border-b p-4 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={() => router.push('/cliente/suporte')} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft className="text-gray-500"/></button>
                <div>
                    <h1 className="font-bold text-lg text-slate-800">#{ticket.protocolo} - {ticket.assunto}</h1>
                    <p className="text-xs text-slate-500">Status: <span className="font-bold uppercase bg-slate-100 px-2 py-0.5 rounded">{ticket.status.replace('_', ' ')}</span></p>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {ticket.mensagens.map((msg: any) => {
                if (msg.interno) return null; 
                const isStaff = ['ADMIN','SUPORTE','MASTER', 'SUPORTE_TI', 'CONTADOR'].includes(msg.usuario.role);

                return (
                    <div key={msg.id} className={`flex ${!isStaff ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm relative ${
                            !isStaff ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                        }`}>
                            <div className={`flex items-center gap-2 mb-1 text-[10px] font-bold uppercase tracking-wider ${!isStaff ? 'text-blue-200' : 'text-slate-400'}`}>
                                {isStaff ? <Shield size={12}/> : <User size={12}/>}
                                <span>{msg.usuario.nome}</span>
                                <span>• {new Date(msg.createdAt).toLocaleTimeString().slice(0,5)}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.mensagem}</p>
                            
                            {msg.anexoBase64 && (
                                <div className={`mt-2 pt-2 border-t ${!isStaff ? 'border-white/20' : 'border-slate-100'}`}>
                                    <a href={msg.anexoBase64} download={msg.anexoNome} className={`flex items-center gap-2 text-xs font-bold underline ${!isStaff ? 'text-white' : 'text-blue-600'}`}>
                                        <Download size={14}/> {msg.anexoNome || 'Anexo'}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            <div ref={msgEndRef} />
        </div>

        <div className="p-4 bg-white border-t shrink-0">
            <div className="flex gap-2 max-w-4xl mx-auto">
                <input 
                    className="flex-1 p-3 border rounded-xl bg-slate-50 outline-blue-500 focus:bg-white transition"
                    placeholder="Digite sua resposta..."
                    value={novaMsg}
                    onChange={e => setNovaMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && enviarMsg()}
                />
                <button onClick={enviarMsg} disabled={!novaMsg.trim()} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition shadow-md hover:shadow-lg">
                    <Send size={20}/>
                </button>
            </div>
        </div>
    </div>
  );
}