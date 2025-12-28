'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search, FileText, MoreVertical, Ban, RefreshCcw, Share2, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ListaVendasProps {
  compact?: boolean; 
  onlyValid?: boolean;
}

export default function ListaVendas({ compact = false, onlyValid = false }: ListaVendasProps) {
  const router = useRouter();
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Separa o texto do input (imediato) do termo de busca (com delay)
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // 1. Lógica de Debounce (Delay na digitação)
  // Só atualiza 'debouncedSearch' quando o usuário para de digitar por 500ms
  useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearch(searchTerm);
        // Se o termo mudou, volta para a primeira página
        if (searchTerm !== debouncedSearch) {
            setPage(1);
        }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. Função de Busca (Memoizada)
  const fetchVendas = useCallback(() => {
    setLoading(true);
    const userId = localStorage.getItem('userId');
    const limit = compact ? 10 : 10; 
    const typeFilter = onlyValid ? 'valid' : 'all';

    // Usa 'debouncedSearch' para a requisição
    fetch(`/api/notas?page=${page}&limit=${limit}&search=${debouncedSearch}&type=${typeFilter}`, {
        headers: { 'x-user-id': userId || '' }
    })
    .then(r => r.json())
    .then(res => {
        setVendas(res.data || []);
        setTotalPages(res.meta?.totalPages || 1);
    })
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
  }, [page, debouncedSearch, compact, onlyValid]);

  // 3. Gatilho Único de Carregamento
  // Dispara apenas quando os parâmetros reais (página ou busca confirmada) mudam
  useEffect(() => {
    fetchVendas();
    // Nota: Removemos propositalmente o listener de 'window focus' para evitar recarregamentos constantes
  }, [fetchVendas]);

  const handleCorrigir = (vendaId: string) => {
      router.push(`/emitir?retry=${vendaId}`);
  };

  const handleAction = async (action: string, vendaId: string) => {
      if(!confirm(`Deseja realmente ${action}?`)) return;
      const userId = localStorage.getItem('userId');
      try {
          const res = await fetch('/api/notas/gerenciar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
              body: JSON.stringify({ acao: action === 'cancelar' ? 'CANCELAR' : 'CORRIGIR', vendaId })
          });
          if(res.ok) { alert("Solicitação enviada!"); fetchVendas(); }
          else { alert("Erro ao processar."); }
      } catch(e) { alert("Erro de conexão."); }
      setOpenMenuId(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* HEADER */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <FileText size={20} className="text-blue-600"/> 
            {compact ? 'Últimas Transações' : (onlyValid ? 'Histórico de Notas Fiscais' : 'Histórico de Vendas')}
        </h3>
        
        <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-3 text-slate-400" size={16}/>
            <input 
                className="w-full pl-9 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={onlyValid ? "Buscar nota, cliente..." : "Buscar cliente, erro..."}
                value={searchTerm} // Liga ao estado imediato
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                    <th className="p-4">Nota</th>
                    <th className="p-4">Tomador (Cliente)</th>
                    <th className="p-4">Item de Serviço</th> 
                    <th className="p-4 text-right whitespace-nowrap min-w-[120px]">Valor</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {loading ? (
                    <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-500"/></td></tr>
                ) : vendas.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">
                        {onlyValid ? "Nenhuma nota emitida encontrada." : "Nenhuma venda registrada."}
                    </td></tr>
                ) : (
                    vendas.map(venda => {
                        const nota = venda.notas[0]; 
                        return (
                            <tr key={venda.id} className="hover:bg-slate-50 transition">
                                <td className="p-4 font-mono font-bold text-slate-700">
                                    {nota?.numero ? `#${nota.numero}` : <span className="text-gray-300">-</span>}
                                </td>
                                <td className="p-4">
                                    <p className="font-bold text-slate-800">{venda.cliente.razaoSocial}</p>
                                    <p className="text-xs text-slate-500">{venda.cliente.documento}</p>
                                </td>
                                
                                <td className="p-4">
                                    {nota?.itemLc && nota.itemLc !== '---' ? (
                                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                            {nota.itemLc}
                                        </span>
                                    ) : (
                                        <span className="text-gray-300 text-xs italic">...</span>
                                    )}
                                </td>

                                <td className="p-4 font-bold text-slate-700 text-right whitespace-nowrap">
                                    R$ {Number(venda.valor).toFixed(2)}
                                </td>

                                <td className="p-4 text-center">
                                    {venda.status === 'ERRO_EMISSAO' ? (
                                        <div className="group relative flex justify-center">
                                            <span className="cursor-help px-2 py-1 rounded text-[10px] font-bold uppercase border bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                                                FALHOU <AlertCircle size={10}/>
                                            </span>
                                            <div className="absolute bottom-full mb-2 w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 text-left">
                                                <p className="font-bold mb-1 text-red-300">Motivo da Falha:</p>
                                                {venda.motivoErro || 'Erro desconhecido. Tente novamente.'}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                                            venda.status === 'CONCLUIDA' ? 'bg-green-50 text-green-700 border-green-200' :
                                            venda.status === 'CANCELADA' ? 'bg-gray-100 text-gray-500 border-gray-200 line-through' :
                                            'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>
                                            {venda.status === 'CONCLUIDA' ? 'AUTORIZADA' : venda.status}
                                        </span>
                                    )}
                                </td>

                                <td className="p-4 text-right relative">
                                    {venda.status === 'ERRO_EMISSAO' ? (
                                        <button 
                                            onClick={() => handleCorrigir(venda.id)}
                                            className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded shadow-sm flex items-center gap-1 ml-auto"
                                        >
                                            <RefreshCcw size={12}/> Corrigir
                                        </button>
                                    ) : venda.status === 'CONCLUIDA' && (
                                        <div className="relative inline-block">
                                            <button onClick={() => setOpenMenuId(openMenuId === venda.id ? null : venda.id)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                                <MoreVertical size={16} className="text-slate-500"/>
                                            </button>
                                            
                                            {openMenuId === venda.id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                    <button onClick={() => alert("Compartilhar em breve!")} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                                                        <Share2 size={14}/> Compartilhar
                                                    </button>
                                                    <button onClick={() => handleAction('cancelar', venda.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t">
                                                        <Ban size={14}/> Cancelar Nota
                                                    </button>
                                                </div>
                                            )}
                                            
                                            {openMenuId === venda.id && (
                                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)}></div>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
      </div>

      {/* RODAPÉ PAGINAÇÃO */}
      {!compact && (
          <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-500">Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-2 bg-white border rounded hover:bg-slate-100 disabled:opacity-50 transition">
                      <ChevronLeft size={16}/>
                  </button>
                  <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-2 bg-white border rounded hover:bg-slate-100 disabled:opacity-50 transition">
                      <ChevronRight size={16}/>
                  </button>
              </div>
          </div>
      )}
    </div>
  );
}