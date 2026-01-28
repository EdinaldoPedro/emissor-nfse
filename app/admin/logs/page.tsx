'use client';
import { useEffect, useState } from 'react';
import { Terminal, AlertTriangle, CheckCircle, Info, X, Search } from 'lucide-react';

export default function SystemLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [filter, setFilter] = useState('');

  const carregar = () => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/logs', {
        headers: { 'Authorization': `Bearer ${token}` } // <--- Token
    }).then(r => r.json()).then(data => {
        if(Array.isArray(data.data)) setLogs(data.data);
    });
  };

  useEffect(() => { carregar(); }, []);

  // ... (RESTO IGUAL) ...
  // Apenas a função 'carregar' mudou
  
  const getIcon = (level: string) => {
      switch(level) {
          case 'ERRO': return <AlertTriangle className="text-red-500" size={18}/>;
          case 'ALERTA': return <AlertTriangle className="text-yellow-500" size={18}/>;
          case 'DEBUG': return <Terminal className="text-gray-500" size={18}/>;
          default: return <CheckCircle className="text-green-500" size={18}/>;
      }
  };

  const filteredLogs = logs.filter(l => 
      l.message.toLowerCase().includes(filter.toLowerCase()) || 
      l.action.toLowerCase().includes(filter.toLowerCase()) ||
      (l.empresa?.razaoSocial || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Terminal /> Logs do Sistema
        </h1>
        <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
            <input 
                className="pl-10 p-2 border rounded-lg w-64" 
                placeholder="Filtrar eventos..."
                onChange={e => setFilter(e.target.value)}
            />
        </div>
      </div>

      {/* ÁREA PRINCIPAL */}
      <div className="flex gap-6 flex-1 overflow-hidden">
          <div className="flex-1 bg-white rounded-xl shadow-sm border overflow-y-auto">
              <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b sticky top-0">
                      <tr>
                          <th className="p-3">Nível</th>
                          <th className="p-3">Hora</th>
                          <th className="p-3">Empresa</th>
                          <th className="p-3">Ação</th>
                          <th className="p-3">Mensagem</th>
                      </tr>
                  </thead>
                  <tbody>
                      {filteredLogs.map(log => (
                          <tr 
                            key={log.id} 
                            onClick={() => setSelectedLog(log)}
                            className={`border-b cursor-pointer hover:bg-blue-50 transition ${selectedLog?.id === log.id ? 'bg-blue-100' : ''}`}
                          >
                              <td className="p-3">{getIcon(log.level)}</td>
                              <td className="p-3 text-slate-500 font-mono text-xs">
                                  {new Date(log.createdAt).toLocaleTimeString()}
                              </td>
                              <td className="p-3 font-medium text-slate-700">
                                  {log.empresa?.razaoSocial?.substring(0, 20) || 'Sistema'}
                              </td>
                              <td className="p-3">
                                  <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">
                                      {log.action}
                                  </span>
                              </td>
                              <td className="p-3 text-slate-600 truncate max-w-xs">{log.message}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>

          {selectedLog && (
              <div className="w-1/3 bg-slate-900 text-slate-300 rounded-xl p-4 flex flex-col shadow-xl">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                      <h3 className="font-bold text-white">Detalhes do Evento</h3>
                      <button onClick={() => setSelectedLog(null)}><X size={18}/></button>
                  </div>
                  
                  <div className="space-y-4 font-mono text-xs overflow-y-auto flex-1">
                      <div><span className="text-slate-500">ID:</span> {selectedLog.id}</div>
                      <div><span className="text-slate-500">Data:</span> {new Date(selectedLog.createdAt).toLocaleString()}</div>
                      <div>
                          <span className="text-slate-500">Empresa:</span><br/>
                          <span className="text-yellow-400">{selectedLog.empresa?.razaoSocial || 'N/A'}</span>
                      </div>
                      
                      <div className="bg-black/50 p-2 rounded border border-slate-700">
                          <p className="text-blue-400 mb-1">// Payload / Detalhes</p>
                          <pre className="whitespace-pre-wrap break-all text-green-400">
                              {selectedLog.details || 'Nenhum detalhe adicional.'}
                          </pre>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
}