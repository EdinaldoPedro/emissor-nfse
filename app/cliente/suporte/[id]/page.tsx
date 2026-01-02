'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, User, Shield, ArrowLeft } from 'lucide-react';

export default function DetalheTicketCliente() {
  const { id } = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [novaMsg, setNovaMsg] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);

  const carregar = () => {
      fetch(`/api/suporte/tickets/${id}`).then(r => r.json()).then(setTicket);
  };

  useEffect(() => { 
      carregar(); 
      // Polling simples a cada 10s para ver novas msgs
      const interval = setInterval(carregar, 10000);
      return () => clearInterval(interval);
  }, [id]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticket?.mensagens]);

  const enviarMsg = async () => {
      if(!novaMsg.trim()) return;
      const userId = localStorage.getItem('userId');
      await fetch('/api/suporte/mensagens', {
          method: 'POST',
          headers: {'Content-Type':'application/json', 'x-user-id': userId || ''},
          body: JSON.stringify({ ticketId: id, mensagem: novaMsg })
      });
      setNovaMsg('');
      carregar();
  };

  if (!ticket) return <div className="p-8">Carregando...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-100">
        {/* HEADER */}
        <div className="bg-white border-b p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()}><ArrowLeft className="text-gray-500"/></button>
                <div>
                    <h1 className="font-bold text-lg text-slate-800">#{ticket.protocolo} - {ticket.assunto}</h1>
                    <p className="text-xs text-slate-500">Status: <span className="font-bold uppercase">{ticket.status}</span></p>
                </div>
            </div>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {ticket.mensagens.map((msg: any) => {
                if (msg.interno) return null; // Cliente não vê msg interna
                const isMe = !['ADMIN','SUPORTE'].includes(msg.usuario.role); // Lógica simples: se não é staff, sou eu

                return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl p-4 shadow-sm ${
                            isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-800 rounded-bl-none'
                        }`}>
                            <div className="flex items-center gap-2 mb-1 text-[10px] opacity-70">
                                {isMe ? <User size={12}/> : <Shield size={12}/>}
                                <span className="font-bold uppercase">{msg.usuario.nome}</span>
                                <span>{new Date(msg.createdAt).toLocaleTimeString().slice(0,5)}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{msg.mensagem}</p>
                        </div>
                    </div>
                );
            })}
            <div ref={msgEndRef} />
        </div>

        {/* INPUT */}
        <div className="p-4 bg-white border-t">
            <div className="flex gap-2">
                <input 
                    className="flex-1 p-3 border rounded-lg bg-slate-50 outline-blue-500"
                    placeholder="Digite sua resposta..."
                    value={novaMsg}
                    onChange={e => setNovaMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && enviarMsg()}
                />
                <button onClick={enviarMsg} className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700">
                    <Send size={20}/>
                </button>
            </div>
        </div>
    </div>
  );
}