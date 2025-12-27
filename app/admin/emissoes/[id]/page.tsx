'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Terminal, FileText, AlertTriangle, CheckCircle, Search, X, ChevronDown, ChevronRight, Activity, Loader2 } from 'lucide-react';

export default function DetalheEmissor() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [tab, setTab] = useState<'LOGS_GERAIS' | 'VENDAS'>('VENDAS');
  const [expandedVenda, setExpandedVenda] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/emissoes/${id}`)
        .then(async res => {
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Erro na API');
            return json;
        })
        .then(setData)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40}/></div>;
  
  // === TRATAMENTO DE ERRO VISUAL ===
  if (error) return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
          <AlertTriangle className="text-red-500" size={50}/>
          <h2 className="text-xl font-bold text-slate-700">Erro ao carregar agente</h2>
          <p className="text-red-600 bg-red-50 p-4 rounded border border-red-200 font-mono text-sm">{error}</p>
          <p className="text-slate-500 text-sm">Dica: Verifique se rodou 'npx prisma db push'</p>
      </div>
  );

  if (!data?.empresa) return null; // Segurança extra

  const { empresa, logs, vendas } = data;

  const toggleVenda = (vendaId: string) => {
      setExpandedVenda(expandedVenda === vendaId ? null : vendaId);
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="bg-white border-b px-8 py-6 shadow-sm shrink-0">
         <h1 className="text-2xl font-bold text-slate-800">{empresa.razaoSocial}</h1>
         <div className="text-sm text-slate-500 font-mono mt-1">CNPJ: {empresa.documento}</div>
         
         <div className="flex gap-6 mt-6 border-b -mb-6">
            <button onClick={() => setTab('VENDAS')} className={`pb-4 px-2 font-bold border-b-2 transition ${tab === 'VENDAS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
                <Activity size={18} className="inline mr-2"/> Vendas & Notas
            </button>
            <button onClick={() => setTab('LOGS_GERAIS')} className={`pb-4 px-2 font-bold border-b-2 transition ${tab === 'LOGS_GERAIS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
                <Terminal size={18} className="inline mr-2"/> Logs do Sistema
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        
        {/* ABA VENDAS (PRINCIPAL) */}
        {tab === 'VENDAS' && (
            <div className="space-y-4">
                {(!vendas || vendas.length === 0) && (
                    <div className="p-8 text-center text-slate-400 bg-white rounded border border-dashed">
                        Nenhuma venda/emissão registrada com o novo sistema.
                    </div>
                )}

                {vendas?.map((venda: any) => (
                    <div key={venda.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        
                        {/* CABEÇALHO DA VENDA */}
                        <div 
                            onClick={() => toggleVenda(venda.id)}
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
                        >
                            <div className="flex items-center gap-4">
                                {expandedVenda === venda.id ? <ChevronDown size={20} className="text-slate-400"/> : <ChevronRight size={20} className="text-slate-400"/>}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-700">{venda.cliente?.razaoSocial || 'Consumidor'}</span>
                                        <span className={`text-[10px] px-2 rounded-full font-bold ${venda.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700' : venda.status === 'ERRO_EMISSAO' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {venda.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {new Date(venda.createdAt).toLocaleString()} • R$ {Number(venda.valor).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="text-right">
                                {venda.notas && venda.notas.length > 0 ? (
                                    <div className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-100">
                                        Nota #{venda.notas[0].numero}
                                    </div>
                                ) : (
                                    <div className="text-xs text-slate-400">Sem nota</div>
                                )}
                            </div>
                        </div>

                        {/* DETALHES EXPANDIDOS (LOGS DAQUELA VENDA) */}
                        {expandedVenda === venda.id && (
                            <div className="border-t bg-slate-50 p-4">
                                
                                <div className="flex gap-4">
                                    {/* LISTA DE LOGS DA VENDA */}
                                    <div className="flex-1 space-y-2">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Histórico da Transação</h4>
                                        {venda.logs?.map((log: any) => (
                                            <div key={log.id} className="text-xs flex gap-2 p-2 bg-white rounded border border-slate-200">
                                                <span className={log.level === 'ERRO' ? 'text-red-600 font-bold' : 'text-slate-500'}>
                                                    [{log.level}]
                                                </span>
                                                <span className="text-slate-700 flex-1">{log.message}</span>
                                                <span className="text-slate-400 text-[10px]">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* AÇÕES DE SUPORTE */}
                                    <div className="w-48 space-y-2 border-l pl-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Ações</h4>
                                        {venda.status === 'ERRO_EMISSAO' && (
                                            <button className="w-full bg-blue-600 text-white text-xs py-2 rounded hover:bg-blue-700 font-bold shadow-sm">
                                                Corrigir e Reemitir
                                            </button>
                                        )}
                                        {venda.status === 'CONCLUIDA' && (
                                            <>
                                                <button className="w-full bg-white border border-slate-300 text-slate-600 text-xs py-2 rounded hover:bg-slate-50">
                                                    Baixar XML
                                                </button>
                                                <button className="w-full bg-red-50 border border-red-200 text-red-600 text-xs py-2 rounded hover:bg-red-100">
                                                    Cancelar Nota
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* DEBUG JSON (Se houver erro, mostra o ultimo detalhe) */}
                                {venda.logs?.find((l:any) => l.details) && (
                                    <div className="mt-4">
                                        <p className="text-xs font-bold text-slate-500 mb-1">Último Payload / Erro:</p>
                                        <pre className="bg-slate-900 text-green-400 p-3 rounded text-[10px] overflow-x-auto font-mono max-h-60">
                                            {venda.logs.find((l:any) => l.details)?.details}
                                        </pre>
                                    </div>
                                )}

                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}

        {/* ABA LOGS GERAIS (Para coisas fora de venda) */}
        {tab === 'LOGS_GERAIS' && (
            <div className="bg-white rounded-xl shadow border p-4">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b text-slate-500">
                            <th className="p-2">Nível</th>
                            <th className="p-2">Mensagem</th>
                            <th className="p-2">Data</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs?.map((log: any) => (
                            <tr key={log.id} className="border-b last:border-0 hover:bg-slate-50">
                                <td className={`p-2 font-bold ${log.level === 'ERRO' ? 'text-red-500' : 'text-green-500'}`}>{log.level}</td>
                                <td className="p-2">{log.message}</td>
                                <td className="p-2 text-slate-400 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

      </div>
    </div>
  );
}