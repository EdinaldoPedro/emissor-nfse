'use client';

import { useState, useEffect } from 'react';
import { 
    Calendar, Search, Filter, Download, FileText, 
    FileCode, Archive, CheckSquare, Square, 
    Loader2, ChevronLeft, ChevronRight, X, Printer 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useDialog } from '@/app/contexts/DialogContext';

// Importações do PDF
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function RelatoriosPage() {
    const router = useRouter();
    const dialog = useDialog();

    // Filtros
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [search, setSearch] = useState('');
    const [incluirCanceladas, setIncluirCanceladas] = useState(false);

    // Dados
    const [notas, setNotas] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // Paginação
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Seleção em Lote
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(date.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        if(!startDate || !endDate) return;
        fetchData();
    }, [page, startDate, endDate, incluirCanceladas]); 

    const fetchData = async () => {
        setLoading(true);
        const userId = localStorage.getItem('userId');
        const contextId = localStorage.getItem('empresaContextId');
        
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                startDate,
                endDate,
                incluirCanceladas: String(incluirCanceladas),
                search
            });

            const res = await fetch(`/api/relatorios?${query.toString()}`, {
                headers: { 
                    'x-user-id': userId || '',
                    'x-empresa-id': contextId || ''
                }
            });
            
            const data = await res.json();
            if (data.data) {
                setNotas(data.data);
                setSummary(data.summary);
                setTotalPages(data.meta.totalPages);
                setSelectedIds([]); 
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: any) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val || 0));
    };

    // === NOVA FUNÇÃO: GERAR PDF RESUMIDO ===
    const handleGeneratePDF = () => {
        if (!summary) return;

        const doc = new jsPDF();

        // 1. Cabeçalho
        doc.setFontSize(18);
        doc.text("Relatório de Faturamento", 14, 20);
        
        doc.setFontSize(10);
        doc.text(`Período: ${new Date(startDate).toLocaleDateString()} a ${new Date(endDate).toLocaleDateString()}`, 14, 28);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 34);

        // 2. Resumo em Cards (Desenhados)
        doc.setFillColor(240, 240, 240);
        doc.rect(14, 40, 180, 25, 'F'); // Fundo cinza

        doc.setFontSize(12);
        doc.text("Total Autorizado:", 20, 50);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(22, 163, 74); // Verde
        doc.text(formatCurrency(summary.totalValor), 20, 58);

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text("Qtd. Notas:", 100, 50);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(String(summary.qtdAutorizadas), 100, 58);

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("Canceladas:", 150, 50);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text(String(summary.qtdCanceladas), 150, 58);

        // Reset cores
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");

        // 3. Tabela de Dados
        const tableBody = notas.map(n => [
            new Date(n.dataEmissao || n.createdAt).toLocaleDateString(),
            n.numero || '-',
            n.cliente?.razaoSocial || 'Consumidor',
            formatCurrency(n.valor),
            n.status
        ]);

        autoTable(doc, {
            startY: 75,
            head: [['Data', 'Número', 'Tomador', 'Valor', 'Status']],
            body: tableBody,
            headStyles: { fillColor: [37, 99, 235] }, // Azul
            theme: 'striped'
        });

        // 4. Salvar
        doc.save(`relatorio_${startDate}_${endDate}.pdf`);
    };

    // Funções de Seleção e Exportação
    const toggleSelectAll = () => {
        if (selectedIds.length === notas.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(notas.map(n => n.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(i => i !== id));
        } else {
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const handleExport = async (formato: 'XML' | 'PDF' | 'AMBOS') => {
        if (selectedIds.length === 0) return dialog.showAlert("Selecione pelo menos uma nota.");
        setDownloading(true);
        const userId = localStorage.getItem('userId');
        try {
            const res = await fetch('/api/relatorios/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
                body: JSON.stringify({ ids: selectedIds, formato })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const link = document.createElement('a');
                link.href = `data:application/zip;base64,${data.fileBase64}`;
                link.download = data.fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                dialog.showAlert({ type: 'success', description: "Arquivo gerado com sucesso!" });
            } else {
                dialog.showAlert({ type: 'danger', description: "Erro ao gerar arquivo." });
            }
        } catch (e) { dialog.showAlert("Erro de conexão."); } 
        finally { setDownloading(false); }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="flex justify-between items-center p-6 border-b bg-white sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
                        <ChevronLeft size={24}/>
                    </button>
                    <h1 className="text-xl font-bold text-slate-800">Relatórios Fiscais</h1>
                </div>
                <Sidebar />
            </header>

            <div className="p-6 max-w-7xl mx-auto space-y-6">
                
                {/* 1. RESUMO (SUMMARY) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                        <div>
                            <h2 className="text-sm font-bold text-slate-400 uppercase mb-1">Resumo do Período</h2>
                            <p className="text-slate-500 text-xs">
                                De {new Date(startDate).toLocaleDateString()} até {new Date(endDate).toLocaleDateString()}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-2">Consulta realizada em: {new Date().toLocaleString()}</p>
                        </div>
                        
                        <div className="flex gap-8 items-center">
                            <div className="text-right">
                                <p className="text-xs text-slate-500 font-bold uppercase">Valor Total (Autorizadas)</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {loading ? '...' : formatCurrency(summary?.totalValor)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500 font-bold uppercase">Notas Emitidas</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {loading ? '...' : summary?.qtdAutorizadas}
                                </p>
                            </div>
                             <div className="text-right border-l pl-8">
                                <p className="text-xs text-slate-400 font-bold uppercase">Canceladas</p>
                                <p className="text-2xl font-bold text-slate-500">
                                    {loading ? '...' : summary?.qtdCanceladas}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. FILTROS E AÇÕES */}
                <div className="flex flex-col xl:flex-row gap-4 justify-between items-end bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    
                    {/* Filtros Visuais */}
                    <div className="flex flex-wrap items-end gap-3 w-full xl:w-auto">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Data Início</label>
                            <input type="date" className="p-2 border rounded-lg text-sm bg-slate-50" 
                                value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Data Fim</label>
                            <input type="date" className="p-2 border rounded-lg text-sm bg-slate-50" 
                                value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                        <div className="relative">
                             <label className="block text-xs font-bold text-slate-500 mb-1">Buscar (Tomador/Número)</label>
                             <div className="flex">
                                <input 
                                    className="pl-8 p-2 border rounded-l-lg text-sm w-48 outline-none focus:border-blue-500"
                                    placeholder="Nome, CNPJ ou Nº..."
                                    value={search} onChange={e => setSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && fetchData()}
                                />
                                <button onClick={fetchData} className="px-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700">
                                    <Search size={16}/>
                                </button>
                             </div>
                             <Search className="absolute left-2.5 top-8 text-slate-400" size={14}/>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer bg-slate-100 p-2 rounded-lg border h-[38px] select-none hover:bg-slate-200 transition">
                            <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" 
                                checked={incluirCanceladas} 
                                onChange={e => setIncluirCanceladas(e.target.checked)} />
                            <span className="text-xs font-bold text-slate-600">Exibir Canceladas</span>
                        </label>
                    </div>

                    {/* Botões de Exportação */}
                    <div className="flex gap-2 w-full xl:w-auto justify-end border-t xl:border-t-0 pt-4 xl:pt-0">
                        {/* BOTÃO PDF RESUMIDO */}
                        <button onClick={handleGeneratePDF} disabled={loading} className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm mr-2">
                            <Printer size={14}/> Relatório PDF
                        </button>

                        {selectedIds.length > 0 && (
                            <>
                                <span className="text-xs font-bold text-slate-500 self-center mr-2 hidden md:block">
                                    {selectedIds.length} selecionado(s)
                                </span>
                                <button onClick={() => handleExport('XML')} disabled={downloading} className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition disabled:opacity-50">
                                    {downloading ? <Loader2 className="animate-spin" size={14}/> : <FileCode size={14}/>} XML
                                </button>
                                <button onClick={() => handleExport('PDF')} disabled={downloading} className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition disabled:opacity-50">
                                    {downloading ? <Loader2 className="animate-spin" size={14}/> : <FileText size={14}/>} PDF
                                </button>
                                <button onClick={() => handleExport('AMBOS')} disabled={downloading} className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition disabled:opacity-50">
                                    {downloading ? <Loader2 className="animate-spin" size={14}/> : <Archive size={14}/>} ZIP Completo
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* 3. TABELA */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500 font-bold">
                                <tr>
                                    <th className="p-4 w-10 text-center">
                                        <button onClick={toggleSelectAll}>
                                            {selectedIds.length > 0 && selectedIds.length === notas.length 
                                                ? <CheckSquare className="text-blue-600" size={18}/> 
                                                : <Square className="text-slate-400" size={18}/>}
                                        </button>
                                    </th>
                                    <th className="p-4">Emissão</th>
                                    <th className="p-4">Nota</th>
                                    <th className="p-4">Tomador</th>
                                    <th className="p-4">Item de Serviço (Descrição)</th>
                                    <th className="p-4 text-right">Valor</th>
                                    <th className="p-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={7} className="p-12 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2"/> Carregando dados...</td></tr>
                                ) : notas.length === 0 ? (
                                    <tr><td colSpan={7} className="p-12 text-center text-slate-400">Nenhuma nota encontrada neste período.</td></tr>
                                ) : (
                                    notas.map(nota => (
                                        <tr key={nota.id} className={`hover:bg-slate-50 transition ${selectedIds.includes(nota.id) ? 'bg-blue-50/50' : ''}`}>
                                            <td className="p-4 text-center">
                                                <button onClick={() => toggleSelectOne(nota.id)}>
                                                    {selectedIds.includes(nota.id) 
                                                        ? <CheckSquare className="text-blue-600" size={18}/> 
                                                        : <Square className="text-slate-300 hover:text-slate-500" size={18}/>}
                                                </button>
                                            </td>
                                            <td className="p-4 text-slate-600 font-mono text-xs">
                                                {new Date(nota.dataEmissao || nota.createdAt).toLocaleDateString()}
                                                <span className="block text-[10px] text-slate-400">
                                                    {new Date(nota.dataEmissao || nota.createdAt).toLocaleTimeString().slice(0,5)}
                                                </span>
                                            </td>
                                            <td className="p-4 font-bold text-slate-700">{nota.numero || '-'}</td>
                                            <td className="p-4">
                                                <div className="font-medium text-slate-800 line-clamp-1" title={nota.cliente.razaoSocial}>{nota.cliente.razaoSocial}</div>
                                                <div className="text-[10px] text-slate-400 font-mono">{nota.tomadorCnpj}</div>
                                            </td>
                                            <td className="p-4 max-w-xs">
                                                <p className="text-slate-600 text-xs line-clamp-2" title={nota.descricao}>
                                                    {nota.descricao}
                                                </p>
                                            </td>
                                            <td className="p-4 text-right font-bold text-slate-700">
                                                {formatCurrency(nota.valor)}
                                            </td>
                                            <td className="p-4 text-center">
                                                {nota.status === 'AUTORIZADA' ? (
                                                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">AUTORIZADA</span>
                                                ) : (
                                                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200 line-through">CANCELADA</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINAÇÃO */}
                    <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                        <span className="text-xs text-slate-500">
                            Mostrando {notas.length} de {summary?.qtdAutorizadas + summary?.qtdCanceladas || 0}
                        </span>
                        <div className="flex gap-2">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 bg-white border rounded hover:bg-slate-50 disabled:opacity-50 transition">
                                <ChevronLeft size={16}/>
                            </button>
                            <span className="px-3 py-2 text-sm font-bold text-slate-600 bg-white border rounded">
                                {page} / {totalPages || 1}
                            </span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 bg-white border rounded hover:bg-slate-50 disabled:opacity-50 transition">
                                <ChevronRight size={16}/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}