'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search, FileText, MoreVertical, Ban, RefreshCcw, Loader2, AlertCircle, FileCode, Printer, AlertTriangle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ListaVendasProps {
  compact?: boolean; 
  onlyValid?: boolean;
}

export default function ListaVendas({ compact = false, onlyValid = false }: ListaVendasProps) {
  const router = useRouter();
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Controle
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // === LÓGICA DE CANCELAMENTO ===
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelData, setCancelData] = useState({ vendaId: '', tipo: '', detalhe: '' });
  const [cancelando, setCancelando] = useState(false);

  const MOTIVOS_CANCELAMENTO = [
      "Erro na emissão", "Serviço não prestado", "Erro de assinatura", "Duplicidade da nota", "Outros"
  ];

  // --- FUNÇÕES DE DOWNLOAD ---
  const handleDownloadPdf = async (notaId: string, numeroNota: number, isCancelada: boolean) => {
      try {
          setDownloadingPdfId(notaId); 
          const userId = localStorage.getItem('userId');
          const res = await fetch('/api/notas/pdf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
              body: JSON.stringify({ notaId })
          });
          if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || "Erro ao buscar documento.");
          }
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          // Nome do arquivo muda se for cancelado
          link.download = isCancelada ? `NFSe-CANCELADA-${numeroNota}.pdf` : `NFSe-${numeroNota}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (e: any) { alert("Erro: " + e.message); } 
      finally { setDownloadingPdfId(null); }
  };

  const downloadBase64 = (base64: string, filename: string, mime: string) => {
    try {
        const link = document.createElement('a');
        link.href = `data:${mime};base64,${base64}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) { alert("Erro ao baixar arquivo."); }
  };

  // --- BUSCA E PAGINAÇÃO ---
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchTerm); if (searchTerm !== debouncedSearch) setPage(1); }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchVendas = useCallback(() => {
    setLoading(true);
    const userId = localStorage.getItem('userId');
    const contextId = localStorage.getItem('empresaContextId');
    const limit = compact ? 5 : 10;
    const typeFilter = onlyValid ? 'valid' : 'all';

    fetch(`/api/notas?page=${page}&limit=${limit}&search=${debouncedSearch}&type=${typeFilter}`, {
        headers: {   'Authorization': 'Bearer ' + localStorage.getItem('token'),  'x-empresa-id': localStorage.getItem('empresaContextId') || ''
        }
    })
    .then(r => r.json())
    .then(res => { setVendas(res.data || []); setTotalPages(res.meta?.totalPages || 1); })
    .finally(() => setLoading(false));
  }, [page, debouncedSearch, compact, onlyValid]);

  useEffect(() => { fetchVendas(); }, [fetchVendas]);

  // --- FUNÇÕES DO MODAL ---
  const abrirModalCancelamento = (vendaId: string) => {
      setCancelData({ vendaId, tipo: '', detalhe: '' });
      setCancelModalOpen(true);
      setOpenMenuId(null); 
  };

  const confirmarCancelamento = async () => {
      const justificativaCompleta = `${cancelData.tipo}: ${cancelData.detalhe}`;
      if (!cancelData.tipo) return alert("Selecione um motivo.");
      if (justificativaCompleta.length < 15) return alert("A justificativa deve ter no mínimo 15 caracteres.");

      if(!confirm("Atenção: O cancelamento é irreversível. Deseja continuar?")) return;

      setCancelando(true);
      const userId = localStorage.getItem('userId');
      try {
          const res = await fetch('/api/notas/gerenciar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
              body: JSON.stringify({ acao: 'CANCELAR', vendaId: cancelData.vendaId, motivo: justificativaCompleta })
          });
          const data = await res.json();
          if(res.ok) { 
              alert("✅ Sucesso! Nota cancelada e arquivos atualizados."); 
              setCancelModalOpen(false);
              fetchVendas(); 
          } else { 
              alert("Erro: " + data.error); 
          }
      } catch(e) { alert("Erro de conexão."); }
      finally { setCancelando(false); }
  };

  const handleCorrigir = (vendaId: string) => router.push(`/emitir?retry=${vendaId}`);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
      
      {/* === MODAL DE CANCELAMENTO === */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
                    <h3 className="font-bold text-red-700 flex items-center gap-2"><AlertTriangle size={20}/> Cancelar Nota</h3>
                    <button onClick={() => setCancelModalOpen(false)} className="text-red-400 hover:text-red-600"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Motivo</label>
                        <select className="w-full p-2.5 border rounded-lg bg-white outline-none focus:ring-2 focus:ring-red-500 text-slate-700 text-sm"
                            value={cancelData.tipo} onChange={(e) => setCancelData({...cancelData, tipo: e.target.value})}>
                            <option value="">Selecione...</option>
                            {MOTIVOS_CANCELAMENTO.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Justificativa</label>
                        <textarea className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-slate-700 h-24 resize-none text-sm"
                            placeholder="Descreva o motivo (min 15 caracteres)..." value={cancelData.detalhe} onChange={(e) => setCancelData({...cancelData, detalhe: e.target.value})}/>
                    </div>
                    <button onClick={confirmarCancelamento} disabled={cancelando} className="w-full bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-70 text-sm">
                        {cancelando ? <Loader2 className="animate-spin" size={16}/> : <><Ban size={16}/> Confirmar Cancelamento</>}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* CABEÇALHO */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <FileText size={20} className="text-blue-600"/> 
            {compact ? 'Últimas Vendas' : 'Histórico de Notas'}
        </h3>
        {!compact && (
            <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                <input 
                    className="w-full pl-10 p-2 border rounded-lg text-sm outline-none focus:border-blue-500 transition"
                    placeholder="Buscar cliente, nota..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                />
            </div>
        )}
      </div>

      {/* TABELA */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                <tr>
                    <th className="p-4">Nota</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Item (Serviço)</th>
                    <th className="p-4 text-right">Valor</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {loading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2"/>Carregando...</td></tr>
                ) : vendas.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhuma venda encontrada.</td></tr>
                ) : (
                    vendas.map(venda => {
                        const nota = venda.notas[0]; 
                        const isCancelada = venda.status === 'CANCELADA' || nota?.status === 'CANCELADA';
                        const isAutorizada = venda.status === 'CONCLUIDA' || isCancelada;

                        return (
                            <tr key={venda.id} className="hover:bg-slate-50 transition">
                                <td className="p-4 font-mono font-medium text-slate-700">
                                    {nota?.numero || '-'}
                                </td>
                                <td className="p-4">
                                    <div className="font-bold text-slate-800">{venda.cliente.razaoSocial}</div>
                                    <div className="text-xs text-slate-400">{venda.cliente.documento}</div>
                                </td>
                                
                                {/* === ALTERAÇÃO AQUI: MOSTRAR ITEM EM VEZ DE DESCRIÇÃO === */}
                                <td className="p-4">
                                    {nota?.codigoTribNacional ? (
                                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200" title={venda.descricao}>
                                            {nota.codigoTribNacional}
                                        </span>
                                    ) : <span className="text-slate-300">-</span>}
                                </td>

                                <td className="p-4 text-right font-bold text-slate-700">
                                    R$ {Number(venda.valor).toFixed(2)}
                                </td>
                                <td className="p-4 text-center">
                                    {venda.status === 'ERRO_EMISSAO' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200" title={venda.motivoErro}>
                                            <AlertCircle size={10}/> FALHOU
                                        </span>
                                    ) : (
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                                            isCancelada ? 'bg-gray-100 text-gray-500 border-gray-200 line-through' :
                                            venda.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700 border-green-200' :
                                            'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>
                                            {isCancelada ? 'CANCELADA' : (venda.status === 'CONCLUIDA' ? 'AUTORIZADA' : venda.status)}
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-right relative">
                                    {venda.status === 'ERRO_EMISSAO' ? (
                                        <button onClick={() => handleCorrigir(venda.id)} className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg inline-flex items-center gap-1">
                                            <RefreshCcw size={12}/> Corrigir
                                        </button>
                                    ) : isAutorizada && (
                                        <div className="relative inline-block">
                                            <button onClick={() => setOpenMenuId(openMenuId === venda.id ? null : venda.id)} 
                                                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition">
                                                <MoreVertical size={18}/>
                                            </button>
                                            
                                            {openMenuId === venda.id && (
                                                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                    
                                                    {/* === BOTÕES INTELIGENTES === */}
                                                    <button onClick={() => handleDownloadPdf(nota.id, nota.numero, isCancelada)} disabled={downloadingPdfId === nota.id} 
                                                        className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 ${isCancelada ? 'text-red-600 font-medium' : 'text-slate-700'}`}>
                                                        {downloadingPdfId === nota.id ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16}/>} 
                                                        {downloadingPdfId === nota.id ? 'Baixando...' : (isCancelada ? 'PDF Cancelamento' : 'PDF Oficial')}
                                                    </button>
                                                    
                                                    {nota.xmlBase64 && (
                                                        <button onClick={() => downloadBase64(nota.xmlBase64, `nota-${nota.numero}${isCancelada ? '-CANCELADA' : ''}.xml`, 'text/xml')} 
                                                            className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50">
                                                            <FileCode size={16} className="text-blue-500"/> {isCancelada ? 'XML Cancelado' : 'XML Sefaz'}
                                                        </button>
                                                    )}

                                                    {!isCancelada && (
                                                        <button onClick={() => abrirModalCancelamento(venda.id)} 
                                                            className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium">
                                                            <Ban size={16}/> Cancelar Nota
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {openMenuId === venda.id && <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)}></div>}
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

      {/* PAGINAÇÃO */}
      {!compact && totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-white">
              <span className="text-xs text-slate-500">Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50 text-slate-600"><ChevronLeft size={16}/></button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50 text-slate-600"><ChevronRight size={16}/></button>
              </div>
          </div>
      )}
    </div>
  );
}