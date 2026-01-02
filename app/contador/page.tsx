'use client';
import { useEffect, useState } from 'react';
import { Building2, Plus, Search, LogOut, Loader2, CheckCircle, Clock, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ContadorDashboard() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [filteredEmpresas, setFilteredEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [novoCnpj, setNovoCnpj] = useState('');
  const [solicitando, setSolicitando] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');

  const carregar = () => {
      const userId = localStorage.getItem('userId');
      if (!userId) return router.push('/login');

      fetch('/api/contador/vinculo?mode=contador', { headers: { 'x-user-id': userId } })
        .then(r => r.json())
        .then(data => {
            setEmpresas(data);
            setFilteredEmpresas(data);
        })
        .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  // Lógica de Filtro (Nome ou CNPJ)
  useEffect(() => {
      if (!termoBusca) {
          setFilteredEmpresas(empresas);
      } else {
          const lowerTerm = termoBusca.toLowerCase();
          const filtrados = empresas.filter((item: any) => 
              item.empresa.razaoSocial.toLowerCase().includes(lowerTerm) ||
              item.empresa.documento.includes(lowerTerm)
          );
          setFilteredEmpresas(filtrados);
      }
  }, [termoBusca, empresas]);

  const solicitarAcesso = async () => {
      if(novoCnpj.length < 14) return alert("CNPJ inválido");
      setSolicitando(true);
      const userId = localStorage.getItem('userId');
      
      try {
          const res = await fetch('/api/contador/vinculo', {
              method: 'POST',
              headers: {'Content-Type': 'application/json', 'x-user-id': userId || ''},
              body: JSON.stringify({ cnpj: novoCnpj })
          });
          const data = await res.json();
          if(res.ok) {
              alert(data.message);
              setNovoCnpj('');
              carregar();
          } else {
              alert(data.error);
          }
      } catch(e) { alert("Erro de conexão"); }
      finally { setSolicitando(false); }
  };

  const acessarEmpresa = (empresaId: string) => {
      // Salva o ID da empresa que o contador quer acessar
      localStorage.setItem('empresaContextId', empresaId);
      router.push('/cliente/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
        <header className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Painel do Contador</h1>
                <p className="text-slate-500">Gerencie o acesso às empresas dos seus clientes.</p>
            </div>
            <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="text-red-500 flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded transition">
                <LogOut size={18}/> Sair
            </button>
        </header>

        {/* CARTÃO DE SOLICITAÇÃO */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 mb-8 flex flex-col md:flex-row items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                <Plus size={24}/>
            </div>
            <div className="flex-1">
                <h3 className="font-bold text-slate-700">Solicitar Novo Vínculo</h3>
                <p className="text-sm text-slate-500">Insira o CNPJ do seu cliente para pedir acesso.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <input 
                    className="p-3 border rounded-lg outline-blue-500 w-full md:w-64 font-mono"
                    placeholder="CNPJ do Cliente..."
                    value={novoCnpj}
                    onChange={e => setNovoCnpj(e.target.value.replace(/\D/g, ''))}
                    maxLength={14}
                />
                <button onClick={solicitarAcesso} disabled={solicitando} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
                    {solicitando ? '...' : 'Solicitar'}
                </button>
            </div>
        </div>

        {/* BARRA DE PESQUISA E TÍTULO */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-4 gap-4">
            <h2 className="font-bold text-lg text-slate-700 flex items-center gap-2">
                <Building2 size={20}/> Minhas Empresas Vinculadas
                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{filteredEmpresas.length}</span>
            </h2>
            
            <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                <input 
                    className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Buscar por Razão Social ou CNPJ..."
                    value={termoBusca}
                    onChange={e => setTermoBusca(e.target.value)}
                />
            </div>
        </div>
        
        {loading ? <div className="text-center p-10"><Loader2 className="animate-spin mx-auto text-blue-500"/></div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEmpresas.map(v => (
                    <div key={v.id} className={`bg-white p-5 rounded-xl border shadow-sm transition group relative ${v.status === 'APROVADO' ? 'hover:border-blue-400 hover:shadow-md cursor-pointer' : 'opacity-70'}`}
                         onClick={() => v.status === 'APROVADO' && acessarEmpresa(v.empresaId)}>
                        
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded border">
                                {v.empresa.documento}
                            </span>
                            {v.status === 'APROVADO' ? (
                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                    <CheckCircle size={10}/> ATIVO
                                </span>
                            ) : (
                                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                    <Clock size={10}/> PENDENTE
                                </span>
                            )}
                        </div>
                        
                        <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1 line-clamp-2 h-14">
                            {v.empresa.razaoSocial}
                        </h3>
                        
                        {v.status === 'APROVADO' ? (
                            <button className="mt-2 w-full py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold group-hover:bg-blue-600 group-hover:text-white transition flex items-center justify-center gap-2">
                                Acessar Painel <ArrowRight size={16}/>
                            </button>
                        ) : (
                            <p className="mt-2 text-xs text-orange-600 bg-orange-50 p-2 rounded text-center border border-orange-100">
                                Aguardando aprovação do cliente.
                            </p>
                        )}
                    </div>
                ))}
                
                {filteredEmpresas.length === 0 && (
                    <div className="col-span-full text-center p-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                        Nenhuma empresa encontrada com este filtro.
                    </div>
                )}
            </div>
        )}
    </div>
  );
}