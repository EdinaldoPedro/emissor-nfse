'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { 
    Terminal, AlertTriangle, CheckCircle, 
    ChevronDown, ChevronRight, Activity, Loader2, 
    RefreshCcw, Ban, FileText, Send 
} from 'lucide-react';

export default function DetalheEmissor() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Controle de qual venda está aberta para ver os logs
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
  
  if (error) return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
          <AlertTriangle className="text-red-500" size={50}/>
          <h2 className="text-xl font-bold text-slate-700">Erro ao carregar dados</h2>
          <p className="text-red-600 bg-red-50 p-4 rounded border border-red-200 font-mono text-sm">{error}</p>
      </div>
  );

  if (!data?.empresa) return null;

  const { empresa, vendas } = data;

  const toggleVenda = (vendaId: string) => {
      setExpandedVenda(expandedVenda === vendaId ? null : vendaId);
  }

  const handleAction = (action: string, vendaId: string) => {
      alert(`Ação simulada: ${action}\nID Venda: ${vendaId}`);
      // Futuramente aqui entra a lógica real (reemitir, cancelar, etc)
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      
      {/* CABEÇALHO DA EMPRESA */}
      <div className="bg-white border-b px-8 py-6 shadow-sm shrink-0">
         <div className="flex justify-between items-start">
             <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    {empresa.razaoSocial}
                    <span className={`text-[10px] px-2 py-1 rounded border uppercase ${empresa.certificadoA1 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {empresa.certificadoA1 ? 'Certificado OK' : 'Sem Certificado'}
                    </span>
                </h1>
                <div className="text-sm text-slate-500 font-mono mt-1 flex gap-4">
                    <span>CNPJ: {empresa.documento}</span>
                    <span>IM: {empresa.inscricaoMunicipal || '-'}</span>
                    <span>IBGE: {empresa.codigoIbge}</span>
                </div>
             </div>
             
             <div className="text-right">
                 <p className="text-xs text-slate-400 font-bold uppercase">Total de Vendas</p>
                 <p className="text-2xl font-bold text-slate-700">{vendas?.length || 0}</p>
             </div>
         </div>
      </div>

      {/* ÁREA PRINCIPAL: LISTA DE VENDAS */}
      <div className="flex-1 overflow-y-auto p-6">
            
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
                    <Activity size={16}/> Histórico de Transações
                </h3>
            </div>

            {(!vendas || vendas.length === 0) && (
                <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                    Nenhuma venda registrada com o novo sistema.
                </div>
            )}

            <div className="space-y-4">
                {vendas?.map((venda: any) => (
                    <div key={venda.id} className={`bg-white rounded-xl shadow-sm border transition-all ${expandedVenda === venda.id ? 'ring-2 ring-blue-500 border-transparent' : 'border-slate-200 hover:border-blue-300'}`}>
                        
                        {/* BARRA DE RESUMO (Clicável) */}
                        <div 
                            onClick={() => toggleVenda(venda.id)}
                            className="p-4 flex items-center justify-between cursor-pointer"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-full transition-colors ${expandedVenda === venda.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {expandedVenda === venda.id ? <ChevronDown size={20}/> : <ChevronRight size={20}/>}
                                </div>
                                
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-slate-800 text-lg">
                                            {venda.cliente?.razaoSocial || 'Consumidor Final'}
                                        </span>
                                        {/* STATUS DA VENDA */}
                                        {venda.status === 'CONCLUIDA' && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded border border-green-200">AUTORIZADA</span>}
                                        {venda.status === 'ERRO_EMISSAO' && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200">FALHOU</span>}
                                        {venda.status === 'PROCESSANDO' && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200 animate-pulse">PROCESSANDO</span>}
                                        {venda.status === 'PENDENTE' && <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded border border-gray-200">PENDENTE</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5 font-mono">
                                        {new Date(venda.createdAt).toLocaleString()} • ID: {venda.id.split('-')[0]}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-lg font-bold text-slate-800">R$ {Number(venda.valor).toFixed(2)}</p>
                                {venda.notas && venda.notas.length > 0 ? (
                                    <p className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded mt-1">
                                        Nota #{venda.notas[0].numero}
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-1">Sem nota</p>
                                )}
                            </div>
                        </div>

                        {/* ÁREA EXPANDIDA (LOGS + AÇÕES) */}
                        {expandedVenda === venda.id && (
                            <div className="border-t border-slate-100 bg-slate-50 p-6 flex gap-6 animate-in slide-in-from-top-2">
                                
                                {/* COLUNA 1: LOGS DA TRANSAÇÃO */}
                                <div className="flex-1">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                        <Terminal size={14}/> Logs da Transação
                                    </h4>
                                    
                                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                        {venda.logs?.map((log: any) => (
                                            <div key={log.id} className="flex gap-3 items-start p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                                <div className="mt-0.5">
                                                    {log.level === 'ERRO' && <AlertTriangle size={14} className="text-red-500"/>}
                                                    {log.level === 'INFO' && <CheckCircle size={14} className="text-green-500"/>}
                                                    {log.level === 'ALERTA' && <AlertTriangle size={14} className="text-yellow-500"/>}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-bold text-slate-700">{log.action}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 leading-relaxed break-words">{log.message}</p>
                                                    
                                                    {/* DETALHES TÉCNICOS (JSON) */}
                                                    {log.details && (
                                                        <details className="mt-2 group">
                                                            <summary className="text-[10px] text-blue-500 cursor-pointer hover:underline list-none select-none">Ver JSON Técnico ▾</summary>
                                                            <pre className="mt-2 bg-slate-900 text-green-400 p-3 rounded text-[10px] overflow-x-auto font-mono max-h-60 border border-slate-700">
                                                                {log.details}
                                                            </pre>
                                                        </details>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {(!venda.logs || venda.logs.length === 0) && <p className="text-xs text-slate-400 italic">Nenhum log registrado para esta venda.</p>}
                                    </div>
                                </div>

                                {/* COLUNA 2: AÇÕES RÁPIDAS */}
                                <div className="w-64 space-y-3">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                        <FileText size={14}/> Ações de Suporte
                                    </h4>

                                    {/* CENÁRIO DE ERRO */}
                                    {venda.status === 'ERRO_EMISSAO' && (
                                        <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                                            <p className="text-xs text-red-700 mb-3 font-medium">A emissão falhou. Analise o log e tente reemitir.</p>
                                            <button onClick={() => handleAction('CORRIGIR', venda.id)} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition shadow-sm">
                                                <RefreshCcw size={14}/> Corrigir e Reemitir
                                            </button>
                                        </div>
                                    )}

                                    {/* CENÁRIO DE SUCESSO */}
                                    {venda.status === 'CONCLUIDA' && (
                                        <>
                                            <button onClick={() => handleAction('BAIXAR_XML', venda.id)} className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold py-2 rounded flex items-center justify-center gap-2 transition">
                                                <FileText size={14}/> Ver XML / PDF
                                            </button>
                                            
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                <button onClick={() => handleAction('CARTA', venda.id)} className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-bold py-2 rounded flex flex-col items-center gap-1 transition">
                                                    <Send size={14}/> Carta Correção
                                                </button>
                                                <button onClick={() => handleAction('CANCELAR', venda.id)} className="bg-white hover:bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold py-2 rounded flex flex-col items-center gap-1 transition">
                                                    <Ban size={14}/> Cancelar Nota
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {/* DADOS TÉCNICOS DA NOTA */}
                                    {venda.notas && venda.notas[0] && (
                                        <div className="mt-4 pt-4 border-t border-slate-200 text-[10px] text-slate-500 font-mono space-y-2">
                                            <div>
                                                <span className="block font-bold text-slate-400">Chave de Acesso:</span>
                                                <span className="text-slate-700 break-all select-all">{venda.notas[0].chaveAcesso || '---'}</span>
                                            </div>
                                            <div>
                                                <span className="block font-bold text-slate-400">Protocolo:</span>
                                                <span className="text-slate-700 select-all">{venda.notas[0].protocolo || '---'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}
                    </div>
                ))}
            </div>
      </div>
    </div>
  );
}