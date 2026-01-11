'use client';
import { useState, useEffect, useCallback } from 'react';
import { Search, FileText, MoreVertical, Ban, RefreshCcw, Share2, ChevronLeft, ChevronRight, Loader2, AlertCircle, AlertTriangle, FileCode, Download, RefreshCw, Printer } from 'lucide-react';
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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // --- FUNÇÃO PARA ABRIR PDF (Base64) EM NOVA ABA ---
  const openPdfInNewTab = (base64Data: string) => {
    try {
        // Converte Base64 para Blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const file = new Blob([byteArray], { type: 'application/pdf' });
        const fileURL = URL.createObjectURL(file);
        
        // Abre nova janela com o PDF
        const pdfWindow = window.open(fileURL);
        if (pdfWindow) {
            pdfWindow.focus();
        } else {
            alert("Pop-up bloqueado. Permita pop-ups para visualizar o PDF.");
        }
    } catch (e) {
        console.error("Erro ao gerar PDF:", e);
        alert("Erro ao processar o arquivo PDF.");
    }
  };

  // --- FUNÇÃO PARA BAIXAR XML ---
  const downloadBase64 = (base64: string, filename: string, mime: string) => {
    try {
        let finalBase64 = base64;
        // Se vier como string XML pura, converte para base64
        if (base64.trim().startsWith('<')) {
            finalBase64 = btoa(base64);
        }

        const link = document.createElement('a');
        link.href = `data:${mime};base64,${finalBase64}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        alert("Erro ao baixar arquivo.");
    }
  };

  const handleConsultarNota = async (notaId: string) => {
    if(!confirm("Consultar status atualizado na Sefaz?")) return;
    try {
        const res = await fetch('/api/notas/consultar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notaId })
        });
        const data = await res.json();
        if (res.ok) {
            alert("✅ Nota atualizada com sucesso!");
            fetchVendas(); // Recarrega a lista para mostrar novos dados
        } else {
            alert("Erro: " + (data.error || "Falha na consulta"));
        }
    } catch (e) {
        alert("Erro de conexão.");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearch(searchTerm);
        if (searchTerm !== debouncedSearch) setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchVendas = useCallback(() => {
    setLoading(true);
    const userId = localStorage.getItem('userId');
    const contextId = localStorage.getItem('empresaContextId');

    const limit = compact ? 10 : 10; 
    const typeFilter = onlyValid ? 'valid' : 'all';

    fetch(`/api/notas?page=${page}&limit=${limit}&search=${debouncedSearch}&type=${typeFilter}`, {
        headers: { 
            'x-user-id': userId || '',
            'x-empresa-id': contextId || ''
        }
    })
    .then(r => r.json())
    .then(res => {
        setVendas(res.data || []);
        setTotalPages(res.meta?.totalPages || 1);
    })
    .catch(err => console.error(err))
    .finally(() => setLoading(false));
  }, [page, debouncedSearch, compact, onlyValid]);

  useEffect(() => {
    fetchVendas();
  }, [fetchVendas]);

  const handleCorrigir = (vendaId: string) => {
      router.push(`/emitir?retry=${vendaId}`);
  };

  const getFriendlyError = (rawMessage: string | null) => {
      if (!rawMessage) return "Erro desconhecido. Tente novamente.";
      const msg = rawMessage.toLowerCase();
      if (msg.includes('certificado') || msg.includes('pfx')) return "Certificado Digital ausente. Verifique as configurações.";
      if (msg.includes('cnpj') || msg.includes('cpf') || msg.includes('documento')) return "Dados do cliente inválidos.";
      if (msg.includes('tributação') || msg.includes('serviço')) return "Configuração fiscal incompleta.";
      return rawMessage.length > 100 ? rawMessage.substring(0, 100) + '...' : rawMessage;
  };

  const handleAction = async (action: string, vendaId: string) => {
      let motivo = '';
      if (action === 'cancelar') {
          motivo = prompt("Motivo do cancelamento (mínimo 15 caracteres):") || '';
          if (motivo.length < 15) return alert("Motivo muito curto. O cancelamento exige justificativa.");
      } else if (!confirm(`Deseja realmente ${action}?`)) {
          return;
      }

      const userId = localStorage.getItem('userId');
      try {
          const res = await fetch('/api/notas/gerenciar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
              body: JSON.stringify({ 
                  acao: action === 'cancelar' ? 'CANCELAR' : 'CORRIGIR', 
                  vendaId,
                  motivo 
              })
          });
          const data = await res.json();
          if(res.ok) { 
              alert(data.message); 
              fetchVendas(); 
          } else { 
              alert("Erro: " + data.error); 
          }
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
                value={searchTerm} 
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
                                    {/* 1. REMOVIDO O '#' DO NÚMERO DA NOTA */}
                                    {nota?.numero ? `${nota.numero}` : <span className="text-gray-300">-</span>}
                                </td>
                                <td className="p-4">
                                    <p className="font-bold text-slate-800">{venda.cliente.razaoSocial}</p>
                                    <p className="text-xs text-slate-500">{venda.cliente.documento}</p>
                                </td>
                                
                                <td className="p-4">
                                    {/* 3. EXIBINDO CÓDIGO TRIBUTAÇÃO NACIONAL */}
                                    {nota?.codigoTribNacional && nota.codigoTribNacional !== '---' ? (
                                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                            {nota.codigoTribNacional}
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
                                            {/* Tooltip de Erro */}
                                            <div className="absolute bottom-full mb-2 w-72 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition pointer-events-none z-20 text-left border border-slate-600">
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5"/>
                                                    <div>
                                                        <p className="font-bold mb-1 text-red-200 uppercase text-[10px]">Atenção Necessária</p>
                                                        <div className="text-slate-200 leading-relaxed">
                                                            {getFriendlyError(venda.motivoErro)}
                                                        </div>
                                                    </div>
                                                </div>
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
                                        <div className="flex items-center justify-end gap-2">
                                            
                                            {/* Botão de Atualizar/Consultar se necessário */}
                                            {nota && (nota.numero === 0 || !nota.xmlBase64) && (
                                                <button 
                                                    onClick={() => handleConsultarNota(nota.id)}
                                                    className="p-1.5 text-orange-600 hover:bg-orange-50 rounded border border-orange-200 transition"
                                                    title="Atualizar da Sefaz"
                                                >
                                                    <RefreshCw size={16}/>
                                                </button>
                                            )}

                                            {/* 2. MENU DE AÇÕES: PDF/XML MOVIDOS PARA DENTRO */}
                                            <div className="relative inline-block">
                                                <button onClick={() => setOpenMenuId(openMenuId === venda.id ? null : venda.id)} className="p-2 hover:bg-slate-200 rounded-full transition">
                                                    <MoreVertical size={16} className="text-slate-500"/>
                                                </button>
                                                
                                                {openMenuId === venda.id && (
                                                    <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                        
                                                        {/* Visualizar PDF */}
                                                        {nota?.pdfBase64 ? (
                                                            <button onClick={() => openPdfInNewTab(nota.pdfBase64)} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                                                                <Printer size={14} className="text-red-500"/> Visualizar PDF
                                                            </button>
                                                        ) : (
                                                            <button onClick={() => alert("PDF ainda não processado pela Sefaz. Tente atualizar a nota.")} className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:bg-slate-50 flex items-center gap-2 cursor-not-allowed">
                                                                <Printer size={14}/> PDF Indisponível
                                                            </button>
                                                        )}

                                                        {/* Baixar XML */}
                                                        {nota?.xmlBase64 && (
                                                            <button onClick={() => downloadBase64(nota.xmlBase64, `nota-${nota.numero}.xml`, 'text/xml')} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                                                                <FileCode size={14} className="text-blue-500"/> Baixar XML
                                                            </button>
                                                        )}

                                                        <div className="border-t my-1"></div>

                                                        <button onClick={() => alert("Compartilhar em breve!")} className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                                                            <Share2 size={14}/> Compartilhar
                                                        </button>
                                                        
                                                        <button onClick={() => handleAction('cancelar', venda.id)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t font-medium">
                                                            <Ban size={14}/> Cancelar Nota
                                                        </button>
                                                    </div>
                                                )}
                                                {openMenuId === venda.id && <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)}></div>}
                                            </div>
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