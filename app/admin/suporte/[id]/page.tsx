'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, Shield, User, Lock, CheckCircle, XCircle } from 'lucide-react';

export default function ResolucaoAdmin() {
  const { id } = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [novaMsg, setNovaMsg] = useState('');
  const [interno, setInterno] = useState(false); // Flag para nota interna
  const msgEndRef = useRef<HTMLDivElement>(null);

  const carregar = () => {
      fetch(`/api/suporte/tickets/${id}`).then(r => r.json()).then(setTicket);
  };

  useEffect(() => { 
      carregar(); 
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
          body: JSON.stringify({ ticketId: id, mensagem: novaMsg, interno })
      });
      setNovaMsg('');
      carregar();
  };

  const mudarStatus = async (novoStatus: string) => {
      await fetch(`/api/suporte/tickets/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: novoStatus })
      });
      carregar();
  };

  if (!ticket) return <div>Carregando...</div>;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
        
        {/* SIDEBAR DE INFORMAÇÕES DO TICKET */}
        <div className="w-80 bg-white border-r p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
            <div>
                <button onClick={() => router.back()} className="text-xs text-slate-500 hover:underline mb-4">← Voltar para lista</button>
                <h1 className="font-bold text-xl text-slate-800">#{ticket.protocolo}</h1>
                <p className="text-sm text-slate-600 mt-2 font-medium">{ticket.assunto}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border text-sm space-y-2">
                <p><span className="text-slate-400">Solicitante:</span> <br/><span className="font-bold">{ticket.solicitante.nome}</span></p>
                <p><span className="text-slate-400">Empresa:</span> <br/><span className="font-bold text-blue-600">{ticket.solicitante.empresa?.razaoSocial || 'Sem Empresa'}</span></p>
                <p><span className="text-slate-400">CNPJ:</span> <br/><span className="font-mono text-xs">{ticket.solicitante.empresa?.documento}</span></p>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Ações Rápidas</label>
                
                {ticket.status !== 'RESOLVIDO' ? (
                    <button onClick={() => mudarStatus('RESOLVIDO')} className="w-full bg-green-100 text-green-700 py-2 rounded font-bold hover:bg-green-200 flex items-center justify-center gap-2">
                        <CheckCircle size={16}/> Marcar Resolvido
                    </button>
                ) : (
                    <button onClick={() => mudarStatus('ABERTO')} className="w-full bg-slate-100 text-slate-700 py-2 rounded font-bold hover:bg-slate-200">
                        Reabrir Ticket
                    </button>
                )}
                
                <button onClick={() => mudarStatus('FECHADO')} className="w-full bg-red-50 text-red-700 py-2 rounded font-bold hover:bg-red-100 flex items-center justify-center gap-2">
                    <XCircle size={16}/> Fechar / Cancelar
                </button>
            </div>
        </div>

        {/* ÁREA DE CHAT */}
        <div className="flex-1 flex flex-col">
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {ticket.mensagens.map((msg: any) => {
                    const isStaff = ['ADMIN','SUPORTE','MASTER'].includes(msg.usuario.role);
                    
                    return (
                        <div key={msg.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] rounded-xl p-4 shadow-sm border ${
                                msg.interno ? 'bg-yellow-50 border-yellow-200' :
                                isStaff ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-200'
                            }`}>
                                <div className="flex items-center gap-2 mb-1 text-[10px] opacity-70">
                                    {isStaff ? <Shield size={12}/> : <User size={12}/>}
                                    <span className="font-bold uppercase">{msg.usuario.nome}</span>
                                    {msg.interno && <span className="bg-yellow-200 text-yellow-800 px-1 rounded flex items-center gap-1"><Lock size={8}/> NOTA INTERNA</span>}
                                </div>
                                <p className="text-sm whitespace-pre-wrap text-slate-800">{msg.mensagem}</p>
                            </div>
                        </div>
                    );
                })}
                <div ref={msgEndRef} />
            </div>

            {/* INPUT AREA */}
            <div className="p-4 bg-white border-t">
                <div className="flex items-center gap-4 mb-2">
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
                        <input type="checkbox" checked={interno} onChange={e => setInterno(e.target.checked)} className="rounded text-yellow-500 focus:ring-yellow-500"/>
                        <span className={interno ? 'text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded' : 'text-slate-400'}>
                            {interno ? '🔒 Nota Interna (Cliente não vê)' : '🔓 Resposta Pública (Cliente vê)'}
                        </span>
                    </label>
                </div>
                <div className="flex gap-2">
                    <textarea 
                        className={`flex-1 p-3 border rounded-lg outline-none resize-none h-14 ${interno ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 focus:bg-white'}`}
                        placeholder={interno ? "Escreva uma observação para a equipe..." : "Digite a resposta para o cliente..."}
                        value={novaMsg}
                        onChange={e => setNovaMsg(e.target.value)}
                        onKeyDown={e => {
                            if(e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                enviarMsg();
                            }
                        }}
                    />
                    <button onClick={enviarMsg} className={`text-white px-6 rounded-lg hover:opacity-90 ${interno ? 'bg-yellow-600' : 'bg-blue-600'}`}>
                        <Send size={20}/>
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}