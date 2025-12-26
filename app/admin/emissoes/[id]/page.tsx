'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Terminal, FileText, AlertTriangle, CheckCircle, Search, X } from 'lucide-react';

export default function DetalheEmissor() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<'LOGS' | 'NOTAS'>('LOGS');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    // Busca dados completos
    fetch(`/api/admin/emissoes/${id}`).then(r => r.json()).then(setData);
  }, [id]);

  if (!data) return <div className="p-10 text-center">Carregando Agente...</div>;

  const { empresa, logs, notas } = data;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      
      {/* CABEÇALHO DO AGENTE */}
      <div className="bg-white border-b px-8 py-6 shadow-sm shrink-0">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    {empresa.razaoSocial}
                </h1>
                <div className="flex gap-4 mt-2 text-sm text-slate-500 font-mono">
                    <span>CNPJ: {empresa.documento}</span>
                    <span>IM: {empresa.inscricaoMunicipal || 'N/A'}</span>
                    <span>IBGE: {empresa.codigoIbge}</span>
                </div>
            </div>
            <div className="flex gap-2">
                <div className="text-right px-4 border-r">
                    <p className="text-xs text-slate-400 uppercase font-bold">Certificado</p>
                    <p className={`font-bold ${empresa.certificadoA1 ? 'text-green-600' : 'text-red-500'}`}>
                        {empresa.certificadoA1 ? 'Ativo' : 'Pendente'}
                    </p>
                </div>
            </div>
        </div>

        {/* ABAS */}
        <div className="flex gap-6 mt-8 border-b -mb-6">
            <button 
                onClick={() => setTab('LOGS')}
                className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition ${tab === 'LOGS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <Terminal size={18}/> Logs de Comunicação
            </button>
            <button 
                onClick={() => setTab('NOTAS')}
                className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 border-b-2 transition ${tab === 'NOTAS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <FileText size={18}/> Notas Fiscais
            </button>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex-1 overflow-hidden flex p-6 gap-6">
          
          {/* === ABA: LOGS === */}
          {tab === 'LOGS' && (
             <>
                {/* LISTA ESQUERDA */}
                <div className="flex-1 bg-white rounded-xl shadow border overflow-y-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b sticky top-0">
                            <tr>
                                <th className="p-3 w-10"></th>
                                <th className="p-3">Hora</th>
                                <th className="p-3">Ação</th>
                                <th className="p-3">Mensagem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log: any) => (
                                <tr 
                                    key={log.id} 
                                    onClick={() => setSelectedLog(log)}
                                    className={`border-b cursor-pointer hover:bg-blue-50 transition ${selectedLog?.id === log.id ? 'bg-blue-100' : ''}`}
                                >
                                    <td className="p-3 text-center">
                                        {log.level === 'ERRO' && <AlertTriangle size={16} className="text-red-500"/>}
                                        {log.level === 'INFO' && <CheckCircle size={16} className="text-green-500"/>}
                                        {log.level === 'ALERTA' && <AlertTriangle size={16} className="text-yellow-500"/>}
                                        {log.level === 'DEBUG' && <Terminal size={16} className="text-slate-400"/>}
                                    </td>
                                    <td className="p-3 font-mono text-xs text-slate-500">
                                        {new Date(log.createdAt).toLocaleTimeString()}
                                    </td>
                                    <td className="p-3">
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{log.action}</span>
                                    </td>
                                    <td className="p-3 text-slate-700 truncate max-w-xs">{log.message}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* VISUALIZADOR DIREITA */}
                <div className="w-1/3 bg-slate-900 text-slate-300 rounded-xl p-4 flex flex-col shadow-xl border border-slate-800">
                    {selectedLog ? (
                        <>
                            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                                <h3 className="font-bold text-white flex items-center gap-2"><Terminal size={16}/> Detalhes</h3>
                                <button onClick={() => setSelectedLog(null)}><X size={18}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto font-mono text-xs space-y-4">
                                <div>
                                    <span className="text-slate-500">ID:</span> {selectedLog.id} <br/>
                                    <span className="text-slate-500">Data:</span> {new Date(selectedLog.createdAt).toLocaleString()}
                                </div>
                                
                                <div>
                                    <p className="text-slate-500 mb-1">Mensagem:</p>
                                    <p className="text-white bg-slate-800 p-2 rounded">{selectedLog.message}</p>
                                </div>

                                <div>
                                    <p className="text-blue-400 mb-1">// Payload / JSON</p>
                                    <pre className="whitespace-pre-wrap break-all bg-black/50 p-3 rounded border border-slate-700 text-green-400">
                                        {selectedLog.details || 'Nenhum detalhe técnico.'}
                                    </pre>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600">
                            <Search size={48} className="mb-4 opacity-20"/>
                            <p className="text-center text-sm">Selecione um log para ver<br/>o JSON enviado/recebido.</p>
                        </div>
                    )}
                </div>
             </>
          )}

          {/* === ABA: NOTAS === */}
          {tab === 'NOTAS' && (
              <div className="flex-1 bg-white rounded-xl shadow border overflow-y-auto p-4">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b">
                          <tr>
                              <th className="p-3">Número</th>
                              <th className="p-3">Emissão</th>
                              <th className="p-3">Tomador</th>
                              <th className="p-3">Valor</th>
                              <th className="p-3">Status</th>
                          </tr>
                      </thead>
                      <tbody>
                          {notas.map((nf: any) => (
                              <tr key={nf.id} className="border-b hover:bg-slate-50">
                                  <td className="p-3 font-bold">{nf.numero || '---'}</td>
                                  <td className="p-3">{new Date(nf.createdAt).toLocaleDateString()}</td>
                                  <td className="p-3">{nf.cliente?.nome || 'Consumidor'}</td>
                                  <td className="p-3">R$ {Number(nf.valor).toFixed(2)}</td>
                                  <td className="p-3">
                                      <span className={`px-2 py-1 rounded text-xs font-bold ${nf.status === 'AUTORIZADA' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                          {nf.status}
                                      </span>
                                  </td>
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