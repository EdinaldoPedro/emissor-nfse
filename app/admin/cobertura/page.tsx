'use client';
import { useEffect, useState, useCallback } from 'react';
import { MapPin, Plus, Trash2, ChevronLeft, ChevronRight, Edit, Search, X, Save, Filter } from 'lucide-react';

const STATUS_OPTS = [
    { val: 0, label: 'Integrado (Verde)', color: 'bg-green-100 text-green-700' },
    { val: 1, label: 'Beta (Azul)', color: 'bg-blue-100 text-blue-700' },
    { val: 2, label: 'Em Integração (Amarelo)', color: 'bg-amber-100 text-amber-700' },
    { val: 3, label: 'Em Desenvolvimento (Cinza)', color: 'bg-slate-100 text-slate-500' },
];

export default function GestaoCobertura() {
    const [cidades, setCidades] = useState<any[]>([]);
    
    // Estado do Formulário (inclui ID para saber se é edição)
    const [form, setForm] = useState({ id: '', uf: '', nome: '', status: 2, regime: 'SN' });
    
    // Estados de Filtro
    const [busca, setBusca] = useState('');
    const [filtroRegime, setFiltroRegime] = useState('');
    const [filtroUF, setFiltroUF] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');

    const [loading, setLoading] = useState(false);
    
    // Estados de Paginação
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 10;

    // Busca Paginada com Filtros
    const carregar = useCallback((pagina: number) => {
        // Monta a URL com todos os filtros
        const params = new URLSearchParams({
            page: pagina.toString(),
            limit: limit.toString(),
            search: busca,
            regime: filtroRegime,
            uf: filtroUF,
            status: filtroStatus
        });

        fetch(`/api/admin/cobertura?${params.toString()}`)
            .then(r => r.json())
            .then(res => {
                setCidades(res.data || []);
                setTotalPages(res.meta?.totalPages || 1);
            });
    }, [busca, filtroRegime, filtroUF, filtroStatus]); // Recarrega se filtros mudarem

    // Atualiza sempre que mudar a página ou os filtros (com debounce na busca seria ideal, mas direto funciona)
    useEffect(() => { carregar(page); }, [page, carregar]);

    const salvar = async () => {
        if (!form.uf || !form.nome) return alert("Preencha UF e Nome.");
        setLoading(true);
        
        // Decide se é POST (Criar) ou PUT (Editar)
        const metodo = form.id ? 'PUT' : 'POST';
        
        const res = await fetch('/api/admin/cobertura', {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form)
        });

        if (res.ok) {
            cancelarEdicao(); // Limpa form
            carregar(page);   // Atualiza lista
        } else {
            alert("Erro ao salvar.");
        }
        setLoading(false);
    };

    const deletar = async (id: string) => {
        if(!confirm("Remover cidade?")) return;
        await fetch(`/api/admin/cobertura?id=${id}`, { method: 'DELETE' });
        carregar(page);
    };

    const editar = (cidade: any) => {
        setForm({
            id: cidade.id,
            uf: cidade.uf,
            nome: cidade.nome,
            status: cidade.status,
            regime: cidade.regime || 'SN'
        });
        // Rola suavemente para o topo (formulário)
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelarEdicao = () => {
        setForm({ id: '', uf: '', nome: '', status: 2, regime: 'SN' });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <MapPin /> Mapa de Cobertura
            </h1>

            {/* === ÁREA 1: FORMULÁRIO DE CADASTRO/EDIÇÃO === */}
            <div className={`p-6 rounded-xl shadow-sm border mb-8 transition-colors ${form.id ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                    {form.id ? <><Edit size={16}/> Editando Cidade</> : <><Plus size={16}/> Nova Cidade</>}
                </h3>
                <div className="flex flex-wrap gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">UF</label>
                        <input className="border p-2 rounded w-20 uppercase" maxLength={2} value={form.uf} onChange={e => setForm({...form, uf: e.target.value.toUpperCase()})} placeholder="PE"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Cidade</label>
                        <input className="border p-2 rounded w-64" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Recife"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Regime</label>
                        <select className="border p-2 rounded w-40 bg-white" value={form.regime} onChange={e => setForm({...form, regime: e.target.value})}>
                            <option value="SN">Simples Nacional</option>
                            <option value="LP">Lucro Presumido</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                        <select className="border p-2 rounded w-48 bg-white" value={form.status} onChange={e => setForm({...form, status: parseInt(e.target.value)})}>
                            {STATUS_OPTS.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
                        </select>
                    </div>
                    
                    <div className="flex gap-2">
                        <button onClick={salvar} disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2 font-bold hover:bg-blue-700 shadow-md">
                            {form.id ? <Save size={18}/> : <Plus size={18}/>}
                            {form.id ? 'Salvar Alteração' : 'Adicionar'}
                        </button>
                        {form.id && (
                            <button onClick={cancelarEdicao} className="bg-white text-slate-600 border px-4 py-2 rounded font-bold hover:bg-slate-50">
                                Cancelar
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* === ÁREA 2: FILTROS AVANÇADOS === */}
            <div className="bg-white p-4 rounded-t-xl border-b flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm border border-slate-200">
                <div className="flex items-center gap-4 flex-1 w-full">
                    {/* BUSCA */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input 
                            className="w-full pl-10 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Pesquisar município..."
                            value={busca}
                            onChange={e => { setBusca(e.target.value); setPage(1); }}
                        />
                    </div>

                    {/* FILTROS */}
                    <select className="p-2 border rounded-lg text-sm bg-slate-50" value={filtroUF} onChange={e => { setFiltroUF(e.target.value); setPage(1); }}>
                        <option value="">Todas UFs</option>
                        {/* Lista simplificada, idealmente viria do banco */}
                        {['SP','RJ','MG','RS','PR','PE','BA','SC','GO'].map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>

                    <select className="p-2 border rounded-lg text-sm bg-slate-50" value={filtroRegime} onChange={e => { setFiltroRegime(e.target.value); setPage(1); }}>
                        <option value="">Todos Regimes</option>
                        <option value="SN">Simples Nacional</option>
                        <option value="LP">Lucro Presumido</option>
                    </select>

                    <select className="p-2 border rounded-lg text-sm bg-slate-50" value={filtroStatus} onChange={e => { setFiltroStatus(e.target.value); setPage(1); }}>
                        <option value="">Todos Status</option>
                        {STATUS_OPTS.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
                    </select>
                </div>
                
                {/* LIMPAR */}
                {(busca || filtroUF || filtroRegime || filtroStatus) && (
                    <button onClick={() => { setBusca(''); setFiltroUF(''); setFiltroRegime(''); setFiltroStatus(''); }} className="text-xs font-bold text-red-500 hover:underline flex items-center gap-1">
                        <X size={14}/> Limpar Filtros
                    </button>
                )}
            </div>

            {/* LISTA */}
            <div className="bg-white rounded-b-xl shadow-sm border border-t-0 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="p-4">Regime</th>
                            <th className="p-4">UF</th>
                            <th className="p-4">Cidade</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Ação</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cidades.map(c => (
                            <tr key={c.id} className="border-b hover:bg-slate-50">
                                <td className="p-4 font-bold text-slate-600">{c.regime}</td>
                                <td className="p-4">{c.uf}</td>
                                <td className="p-4 font-medium">{c.nome}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${STATUS_OPTS[c.status]?.color}`}>
                                        {STATUS_OPTS[c.status]?.label}
                                    </span>
                                </td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button onClick={() => editar(c)} className="text-blue-600 hover:bg-blue-50 p-2 rounded" title="Editar">
                                        <Edit size={18}/>
                                    </button>
                                    <button onClick={() => deletar(c.id)} className="text-red-500 hover:bg-red-50 p-2 rounded" title="Excluir">
                                        <Trash2 size={18}/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {cidades.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhuma cidade encontrada com estes filtros.</td></tr>}
                    </tbody>
                </table>
                
                {/* PAGINAÇÃO */}
                <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
                    <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setPage(p => Math.max(1, p - 1))} 
                            disabled={page === 1}
                            className="p-2 border rounded hover:bg-white disabled:opacity-50 bg-white"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button 
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                            disabled={page === totalPages}
                            className="p-2 border rounded hover:bg-white disabled:opacity-50 bg-white"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}