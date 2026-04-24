'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, DollarSign, Activity, Search, ChevronRight, Filter, TrendingUp } from 'lucide-react';
import { useDialog } from '@/app/contexts/DialogContext';

export default function CrmDashboard() {
    const dialog = useDialog();
    const [clientes, setClientes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroBusca, setFiltroBusca] = useState('');

    useEffect(() => {
        const carregarClientes = async () => {
            try {
                const res = await fetch('/api/admin/users');
                if (res.ok) {
                    const data = await res.json();
                    setClientes(data.filter((u: any) => u.role !== 'MASTER' && u.role !== 'ADMIN' && u.role !== 'SUPORTE'));
                }
            } catch (error) {
                dialog.showAlert('Erro ao carregar clientes do CRM.');
            } finally {
                setLoading(false);
            }
        };
        carregarClientes();
    }, [dialog]);

    const clientesAtivos = clientes.filter(c => c.planoStatus === 'active');
    const mrrTotal = clientesAtivos.reduce((acc, cliente) => {
        const planoAtivo = cliente.planHistories?.find((h:any) => h.status === 'ATIVO');
        const valorMensal = Number(planoAtivo?.plan?.priceMonthly || 0);
        return acc + valorMensal;
    }, 0);

    const clientesFiltrados = clientes.filter(c => 
        c.nome.toLowerCase().includes(filtroBusca.toLowerCase()) || 
        c.email.toLowerCase().includes(filtroBusca.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">GestÃ£o de Relacionamento (CRM)</h1>
                    <p className="text-sm text-slate-500">Acompanhe a sua carteira de clientes, receita e histÃ³rico.</p>
                </div>
                <Link href="/admin/crm/metricas" className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-md">
                    <TrendingUp size={18} /> Ver RelatÃ³rio Financeiro
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="bg-blue-100 p-3 rounded-xl text-blue-600"><Users size={24}/></div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase">Total na Carteira</p>
                        <h2 className="text-2xl font-black text-slate-800">{clientes.length} <span className="text-sm font-medium text-slate-400">Contas</span></h2>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600"><DollarSign size={24}/></div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase">Receita Mensal (MRR)</p>
                        <h2 className="text-2xl font-black text-slate-800">R$ {mrrTotal.toFixed(2)}</h2>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <div className="bg-purple-100 p-3 rounded-xl text-purple-600"><Activity size={24}/></div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase">Assinaturas Ativas</p>
                        <h2 className="text-2xl font-black text-slate-800">{clientesAtivos.length} <span className="text-sm font-medium text-slate-400">Pagas</span></h2>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Procurar cliente por nome ou e-mail..." 
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={filtroBusca}
                            onChange={(e) => setFiltroBusca(e.target.value)}
                        />
                    </div>
                    <button className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-white border px-4 py-2 rounded-xl hover:bg-slate-50">
                        <Filter size={16}/> Filtros
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-4">Cliente / Contato</th>
                                <th className="p-4">Perfil</th>
                                <th className="p-4">Assinatura (MRR)</th>
                                <th className="p-4 text-right">AÃ§Ãµes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">A carregar carteira CRM...</td></tr>
                            ) : clientesFiltrados.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Nenhum cliente encontrado.</td></tr>
                            ) : (
                                clientesFiltrados.map(cliente => {
                                    const plano = cliente.planHistories?.find((h:any) => h.status === 'ATIVO')?.plan;
                                    return (
                                        <tr key={cliente.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-4">
                                                <div className="font-bold text-slate-800">{cliente.nome}</div>
                                                <div className="text-xs text-slate-500">{cliente.email}</div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${
                                                    cliente.role === 'CONTADOR' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                    {cliente.role}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {plano ? (
                                                    <div>
                                                        <div className="font-bold text-blue-600">{plano.name}</div>
                                                        <div className="text-xs text-slate-500">R$ {Number(plano.priceMonthly || 0).toFixed(2)}/mÃªs</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">Sem Plano</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <Link href={`/admin/crm/${cliente.id}`} className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-bold bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors">
                                                    VisÃ£o 360Âº <ChevronRight size={16} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
