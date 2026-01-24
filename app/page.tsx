'use client';

import Link from "next/link";
import { useState, useEffect } from "react";
import { CheckCircle, ArrowRight, MapPin, Info, Search, Loader2 } from "lucide-react";

// Definição de Tipos e Cores
type StatusID = 0 | 1 | 2 | 3;

interface StatusConfig {
  label: string;
  color: string;
  dotColor: string;
}

const getStatusConfig = (status: StatusID): StatusConfig => {
  switch (status) {
    case 0: return { label: 'Integrado', color: 'bg-green-100 text-green-700 border-green-200', dotColor: 'bg-green-500' };
    case 1: return { label: 'Integrado (Beta)', color: 'bg-blue-100 text-blue-700 border-blue-200', dotColor: 'bg-blue-500' };
    case 2: return { label: 'Em Integração', color: 'bg-amber-100 text-amber-700 border-amber-200', dotColor: 'bg-amber-500' };
    case 3: return { label: 'Em Desenvolvimento', color: 'bg-slate-100 text-slate-500 border-slate-200', dotColor: 'bg-slate-400' };
    default: return { label: 'Desconhecido', color: 'bg-gray-100', dotColor: 'bg-gray-400' };
  }
};

export default function LandingPage() {
  const [regime, setRegime] = useState<'MEI' | 'SN' | 'LP'>('MEI');
  const [filtroUf, setFiltroUf] = useState('TODOS');
  
  // Estado para dados dinâmicos
  const [cidadesDb, setCidadesDb] = useState<any[]>([]);
  const [loadingMap, setLoadingMap] = useState(true);

  // Busca os dados do banco ao carregar
  useEffect(() => {
      fetch('/api/admin/cobertura')
        .then(r => r.json())
        .then(data => {
            if(Array.isArray(data)) setCidadesDb(data);
        })
        .finally(() => setLoadingMap(false));
  }, []);

  // Filtra cidades do Simples Nacional vindas do banco
  const cidadesSN = cidadesDb.filter(c => c.regime === 'SN');
  const cidadesFiltradas = cidadesSN.filter(c => filtroUf === 'TODOS' || c.uf === filtroUf);
  
  // Extrai UFs únicas para o select
  const ufsDisponiveis = Array.from(new Set(cidadesSN.map(c => c.uf))).sort();

  return (
    <div className="min-h-screen bg-slate-50">
      
      {/* HEADER (Mantido Igual) */}
      <header className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="text-2xl font-bold text-blue-600 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <CheckCircle size={20} strokeWidth={3}/>
            </div>
            NFSe Fácil
        </div>
        <nav className="space-x-4 hidden md:block">
          <Link href="/login" className="text-slate-600 hover:text-blue-600 font-medium px-4 py-2">Login</Link>
          <Link href="/cadastro" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition font-bold shadow-lg shadow-blue-200">
            Começar Grátis
          </Link>
        </nav>
      </header>

      <main>
        {/* HERO SECTION (Mantido Igual) */}
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
            <span className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 inline-block border border-blue-100">
                Novo Motor Fiscal 2.0
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 leading-tight">
            Emita Notas Fiscais Nacionais <br /> <span className="text-blue-600">sem dor de cabeça</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            O sistema ideal para prestadores de serviço e MEIs. Simples, rápido e integrado ao novo Portal Nacional da Receita Federal.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/cadastro" className="flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition shadow-xl shadow-blue-200 hover:-translate-y-1">
                Criar Conta Agora <ArrowRight size={20} />
            </Link>
            <Link href="#cobertura" className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-xl text-lg font-bold hover:bg-slate-50 transition">
                Ver Cidades Atendidas
            </Link>
            </div>
        </div>

        {/* FEATURES (Mantido Igual) */}
        <div className="max-w-7xl mx-auto px-6 mb-20">
            <div className="grid md:grid-cols-3 gap-6 text-left">
            {[ "Emissão Ilimitada e Rápida", "Envio Automático (Email/Zap)", "Gestão Completa de Clientes", "Suporte Web e Mobile", "Backup Seguro em Nuvem", "Compatível com Certificado A1" ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-white p-5 rounded-xl shadow-sm border border-slate-100 hover:border-blue-200 transition">
                <div className="bg-green-100 p-1.5 rounded-full text-green-600"><CheckCircle size={16} /></div>
                <span className="font-bold text-slate-700">{item}</span>
                </div>
            ))}
            </div>
        </div>

        {/* --- SEÇÃO DE COBERTURA DINÂMICA --- */}
        <div id="cobertura" className="bg-white py-20 border-t border-slate-200">
            <div className="max-w-5xl mx-auto px-6">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-800 mb-4">Municípios Integrados</h2>
                    <p className="text-slate-500 max-w-2xl mx-auto">
                        Verifique a disponibilidade do nosso motor fiscal de acordo com o seu regime tributário e localização.
                    </p>
                </div>

                {/* FILTRO DE REGIME (ABAS) */}
                <div className="flex justify-center mb-8">
                    <div className="bg-slate-100 p-1.5 rounded-xl inline-flex gap-1 overflow-x-auto max-w-full">
                        <button onClick={() => setRegime('MEI')} className={`whitespace-nowrap px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${regime === 'MEI' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            MEI (Microempreendedor)
                        </button>
                        <button onClick={() => setRegime('SN')} className={`whitespace-nowrap px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${regime === 'SN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            Simples Nacional
                        </button>
                        <button onClick={() => setRegime('LP')} className={`whitespace-nowrap px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${regime === 'LP' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            Lucro Presumido
                        </button>
                    </div>
                </div>

                {/* CONTEÚDO DINÂMICO */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 min-h-[300px]">
                    
                    {/* CASO MEI */}
                    {regime === 'MEI' && (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2"><MapPin size={40}/></div>
                            <h3 className="text-2xl font-bold text-slate-800">Cobertura Nacional</h3>
                            <p className="text-slate-600 max-w-md">Para MEIs, nosso sistema está integrado com o padrão nacional, atendendo a <strong>todos os municípios do Brasil</strong>.</p>
                            <StatusBadge status={1} />
                        </div>
                    )}

                    {/* CASO LUCRO PRESUMIDO */}
                    {regime === 'LP' && (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 mb-2"><Info size={40}/></div>
                            <h3 className="text-2xl font-bold text-slate-700">Em Desenvolvimento</h3>
                            <p className="text-slate-500 max-w-md">A integração para empresas do Lucro Presumido está sendo desenvolvida e será liberada em breve.</p>
                            <StatusBadge status={3} />
                        </div>
                    )}

                    {/* CASO SIMPLES NACIONAL (DINÂMICO) */}
                    {regime === 'SN' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <MapPin size={18} className="text-blue-500"/> Cidades Homologadas
                                </h3>
                                
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Filtrar UF:</span>
                                    <select className="p-2 border rounded-lg text-sm bg-white font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500" value={filtroUf} onChange={(e) => setFiltroUf(e.target.value)}>
                                        <option value="TODOS">Todas</option>
                                        {ufsDisponiveis.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                    </select>
                                </div>
                            </div>

                            {loadingMap ? (
                                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500"/></div>
                            ) : (
                                <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"> {/* <--- AQUI ESTÁ A MÁGICA */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {cidadesFiltradas.length > 0 ? (
                                            cidadesFiltradas.map((cidade, idx) => (
                                                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:border-blue-300 transition">
                                                    <div>
                                                        <p className="font-bold text-slate-800">{cidade.nome}</p>
                                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{cidade.uf}</span>
                                                    </div>
                                                    <StatusBadge status={cidade.status as StatusID} mini />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-full text-center p-8 text-slate-400 italic">
                                                Nenhuma cidade cadastrada para este filtro ainda.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-8 flex flex-wrap justify-center gap-4 md:gap-8 border-t pt-6">
                    <LegendItem status={0} />
                    <LegendItem status={1} />
                    <LegendItem status={2} />
                    <LegendItem status={3} />
                </div>
            </div>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm">
          <p>© 2026 NFSe Fácil. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

// Componentes Visuais
function StatusBadge({ status, mini = false }: { status: StatusID, mini?: boolean }) {
    const config = getStatusConfig(status);
    if (mini) return <div className={`w-3 h-3 rounded-full ${config.dotColor}`} title={config.label}></div>;
    return <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${config.color}`}><span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`}></span>{config.label}</span>;
}

function LegendItem({ status }: { status: StatusID }) {
    const config = getStatusConfig(status);
    return <div className="flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${config.dotColor}`}></span><span className="text-xs font-bold text-slate-600 uppercase">{config.label}</span></div>;
}