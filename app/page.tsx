'use client';

import Link from "next/link";
import { useState, useEffect } from "react";
import { CheckCircle, ArrowRight, MapPin, Info, Loader2, Zap, Globe, Shield, Smartphone, Users, Cloud } from "lucide-react";

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
  const [regime, setRegime] = useState('MEI');
  const [filtroUf, setFiltroUf] = useState('TODOS');
  const [cidadesDb, setCidadesDb] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [loadingMap, setLoadingMap] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Busca os dados do banco ao carregar (Cidades e Planos)
  useEffect(() => {
      fetch('/api/admin/cobertura')
        .then(r => r.json())
        .then(data => {
            if(Array.isArray(data)) setCidadesDb(data as never[]);
        })
        .finally(() => setLoadingMap(false));

      fetch('/api/plans')
        .then(r => r.json())
        .then(data => {
            // Usa o nome correto da variável do banco: 'active'
            if(Array.isArray(data)) setPlanos(data.filter((p: any) => p.active) as never[]); 
        })
        .finally(() => setLoadingPlans(false));
  }, []);

  // Filtra cidades de forma dinâmica com base na aba (regime) selecionada
  const cidadesDoRegime = cidadesDb.filter((c: any) => c.regime === regime);
  const cidadesFiltradas = cidadesDoRegime.filter((c: any) => filtroUf === 'TODOS' || c.uf === filtroUf);
  
  // Extrai UFs únicas para o select baseando-se no regime selecionado
  const ufsDisponiveis = Array.from(new Set(cidadesDoRegime.map((c: any) => c.uf))).sort();

  // Zera o filtro de UF sempre que mudar de Aba
  useEffect(() => { setFiltroUf('TODOS'); }, [regime]);

  // Lista de Features (Cards Vivos)
  const featuresList = [
      { title: "Emissão Rápida", desc: "Emita suas notas fiscais em poucos segundos, sem burocracia.", icon: Zap, corTexto: "text-amber-600", corFundo: "bg-amber-100" },
      { title: "Envio Automático", desc: "Disparamos a nota diretamente para o e-mail ou WhatsApp do seu cliente.", icon: Globe, corTexto: "text-blue-600", corFundo: "bg-blue-100" },
      { title: "Gestão de Clientes", desc: "Mantenha o cadastro dos seus tomadores de serviço organizado.", icon: Users, corTexto: "text-indigo-600", corFundo: "bg-indigo-100" },
      { title: "Suporte Web e Mobile", desc: "Acesse nosso painel de qualquer dispositivo com design responsivo.", icon: Smartphone, corTexto: "text-emerald-600", corFundo: "bg-emerald-100" },
      { title: "Backup em Nuvem", desc: "Suas notas e cadastros salvos com segurança nos melhores servidores.", icon: Cloud, corTexto: "text-sky-600", corFundo: "bg-sky-100" },
      { title: "Certificado A1", desc: "Integração transparente com o seu Certificado Digital e-CNPJ A1.", icon: Shield, corTexto: "text-rose-600", corFundo: "bg-rose-100" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* === HEADER === */}
      <header className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="text-2xl font-black text-blue-600 flex items-center gap-2 tracking-tight">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
                <CheckCircle size={20} strokeWidth={3}/>
            </div>
            NFSe Goo
        </div>
        <nav className="space-x-4 hidden md:flex items-center">
          <Link href="#planos" className="text-slate-500 hover:text-slate-800 font-bold px-4 py-2 transition-colors">Planos</Link>
          <Link href="#cobertura" className="text-slate-500 hover:text-slate-800 font-bold px-4 py-2 transition-colors">Cidades</Link>
          <div className="h-6 w-px bg-slate-300 mx-2"></div>
          <Link href="/login" className="text-blue-600 hover:text-blue-800 font-bold px-4 py-2">Login</Link>
          <Link href="/cadastro" className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 transition font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300">
            Começar Grátis
          </Link>
        </nav>
      </header>

      <main>
        {/* === HERO SECTION === */}
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
            <span className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 inline-block border border-blue-100 shadow-sm">
                Versão 1.1 Beta
            </span>
            <h1 className="text-4xl md:text-6xl font-black text-slate-900 mb-6 leading-tight tracking-tight">
            Emita Notas Fiscais Nacionais <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">sem dor de cabeça</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            O sistema ideal para prestadores de serviço e MEIs. Simples, rápido e integrado ao novo Portal Nacional da Receita Federal.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/cadastro" className="flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition shadow-xl shadow-blue-200 hover:-translate-y-1">
                Criar Conta Agora <ArrowRight size={20} />
            </Link>
            <Link href="#cobertura" className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-xl text-lg font-bold hover:bg-slate-50 transition hover:-translate-y-1">
                Ver Cidades Atendidas
            </Link>
            </div>
        </div>

        {/* === FEATURES (Cards Dinâmicos e Coloridos) === */}
        <div className="max-w-7xl mx-auto px-6 py-12 mb-10">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-slate-800">Tudo o que você precisa em um só lugar</h2>
                <p className="text-slate-500 mt-2">Nossa plataforma foi desenhada para descomplicar a sua rotina fiscal.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuresList.map((item, i) => {
                const IconComponent = item.icon;
                return (
                <div key={i} className="flex flex-col items-start bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all group">
                    <div className={`${item.corFundo} ${item.corTexto} p-4 rounded-xl mb-4 group-hover:scale-110 transition-transform`}>
                        <IconComponent size={28} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">{item.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
                </div>
            )})}
            </div>
        </div>

        {/* === SEÇÃO DE COBERTURA DINÂMICA === */}
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
                            MEI (Nacional)
                        </button>
                        <button onClick={() => setRegime('SN')} className={`whitespace-nowrap px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${regime === 'SN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            Simples Nacional
                        </button>
                        <button onClick={() => setRegime('LP')} className={`whitespace-nowrap px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${regime === 'LP' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            Lucro Presumido
                        </button>
                    </div>
                </div>

                {/* CONTEÚDO DINÂMICO DA COBERTURA */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 min-h-[300px]">
                    
                    {/* CASO MEI (Sempre Nacional e Fixo) */}
                    {regime === 'MEI' && (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2"><MapPin size={40}/></div>
                            <h3 className="text-2xl font-bold text-slate-800">Cobertura Nacional</h3>
                            <p className="text-slate-600 max-w-md">Para MEIs, nosso sistema está integrado com o padrão nacional, atendendo a <strong>todos os municípios do Brasil</strong>.</p>
                            <StatusBadge status={1} />
                        </div>
                    )}

                    {/* CASO SIMPLES NACIONAL (SN) OU LUCRO PRESUMIDO (LP) - Buscam do Banco */}
                    {(regime === 'SN' || regime === 'LP') && (
                        <div className="animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-200 pb-4">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    <MapPin size={18} className="text-blue-500"/> 
                                    {regime === 'SN' ? 'Cidades Homologadas (Simples Nacional)' : 'Cidades Homologadas (Lucro Presumido)'}
                                </h3>
                                
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Filtrar UF:</span>
                                    <select className="p-2.5 border border-slate-300 rounded-lg text-sm bg-white font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" value={filtroUf} onChange={(e) => setFiltroUf(e.target.value)}>
                                        <option value="TODOS">Todas</option>
                                        {ufsDisponiveis.map(uf => <option key={uf as string} value={uf as string}>{uf as string}</option>)}
                                    </select>
                                </div>
                            </div>

                            {loadingMap ? (
                                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500"/></div>
                            ) : (
                                <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar"> 
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {cidadesFiltradas.length > 0 ? (
                                            cidadesFiltradas.map((cidade: any, idx) => (
                                                <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:border-blue-300 hover:shadow-md transition">
                                                    <div>
                                                        <p className="font-bold text-slate-800 truncate max-w-[140px]" title={cidade.nome}>{cidade.nome}</p>
                                                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded tracking-wider">{cidade.uf}</span>
                                                    </div>
                                                    <StatusBadge status={cidade.status as StatusID} mini />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-slate-400">
                                                <Info size={40} className="text-slate-300 mb-3" />
                                                <p className="text-lg font-medium text-slate-500">Nenhuma cidade integrada ainda.</p>
                                                <p className="text-sm">Estamos expandindo a nossa rede continuamente para este regime!</p>
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

        {/* === SEÇÃO DE PLANOS (Nova) === */}
        <div id="planos" className="bg-slate-50 py-24 border-t border-slate-200">
            <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-4">Planos que crescem com você</h2>
                    <p className="text-slate-500 max-w-2xl mx-auto text-lg">
                        Escolha a opção ideal para o seu volume de notas. Sem fidelidade, cancele quando quiser.
                    </p>
                </div>

                {loadingPlans ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={40}/></div>
                ) : planos.length > 0 ? (
                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {planos.map((plano: any) => (
                            <div key={plano.id} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all flex flex-col relative overflow-hidden">
                                {plano.priceMonthly > 0 && <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-bl-xl">Mais Popular</div>}
                                
                                <div className="mb-6">
                                    <h3 className="text-2xl font-black text-slate-800 mb-2">{plano.name}</h3>
                                    <p className="text-slate-500 text-sm h-10">{plano.description || 'Plano ideal para o seu negócio.'}</p>
                                </div>
                                
                                <div className="mb-8 border-b border-slate-100 pb-8">
                                    <span className="text-5xl font-black text-slate-900">
                                        R$ {plano.priceMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-slate-400 font-medium"> / mês</span>
                                </div>
                                
                                <ul className="space-y-4 mb-8 flex-1">
                                    <li className="flex items-center gap-3 text-slate-700">
                                        <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                                        <span className="font-medium text-sm">
                                            {plano.maxNotasMensal > 0 ? <><strong>{plano.maxNotasMensal} Notas</strong> por mês</> : <strong>Notas Ilimitadas</strong>}
                                        </span>
                                    </li>
                                    <li className="flex items-center gap-3 text-slate-700">
                                        <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                                        <span className="text-sm">Suporte via {plano.priceMonthly > 0 ? 'WhatsApp e E-mail' : 'Sistema'}</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-slate-700">
                                        <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                                        <span className="text-sm">Gestão de Clientes</span>
                                    </li>
                                </ul>
                                
                                <Link href="/cadastro" className={`w-full py-4 rounded-xl font-bold text-center transition ${plano.priceMonthly === 0 ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700'}`}>
                                    Assinar {plano.name}
                                </Link>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-slate-500">
                        Nenhum plano disponível no momento.
                    </div>
                )}
            </div>
        </div>
      </main>

      {/* === FOOTER === */}
      <footer className="bg-slate-900 pt-16 pb-8">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <div className="flex items-center justify-center gap-2 text-white text-2xl font-black mb-6 tracking-tight">
                <CheckCircle size={24} className="text-blue-500"/> NFSe Goo
            </div>
            <p className="text-slate-400 max-w-md mx-auto mb-10 text-sm">
                Ajudamos empreendedores a simplificar a emissão de notas fiscais com tecnologia e automação.
            </p>
            <div className="border-t border-slate-800 pt-8 text-slate-500 text-sm font-medium">
                © {new Date().getFullYear()} NFSe Goo. Todos os direitos reservados.
            </div>
          </div>
      </footer>
    </div>
  );
}

// Componentes Visuais de Apoio
function StatusBadge({ status, mini = false }: { status: StatusID, mini?: boolean }) {
    const config = getStatusConfig(status);
    if (mini) return <div className={`w-3 h-3 rounded-full ${config.dotColor}`} title={config.label}></div>;
    return <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${config.color}`}><span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`}></span>{config.label}</span>;
}

function LegendItem({ status }: { status: StatusID }) {
    const config = getStatusConfig(status);
    return <div className="flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${config.dotColor}`}></span><span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{config.label}</span></div>;
}