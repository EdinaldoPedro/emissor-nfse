'use client';

import { useEffect, useState } from 'react';
import { Building2, Plus, Search, LogOut, Loader2, CheckCircle, Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/app/contexts/DialogContext'; // <--- 1. Importa o estilo do sistema

export default function ContadorDashboard() {
  const router = useRouter();
  const { showAlert } = useDialog(); // <--- 2. Inicializa o hook visual
  
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [filteredEmpresas, setFilteredEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [novoCnpj, setNovoCnpj] = useState('');
  const [processando, setProcessando] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [termoBusca, setTermoBusca] = useState('');

  const carregar = () => {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      if (!userId) return router.push('/login');

      fetch('/api/contador/vinculo?mode=contador', { 
          headers: { 
              'x-user-id': userId,
              'Authorization': `Bearer ${token}` 
          } 
      })
        .then(r => r.json())
        .then(data => {
            if(Array.isArray(data)) {
                setEmpresas(data);
                setFilteredEmpresas(data);
            }
        })
        .finally(() => setLoading(false));
  };

  useEffect(() => { carregar(); }, []);

  // Lógica de Filtro
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

  const handleAdicionarCliente = async () => {
      const cnpjLimpo = novoCnpj.replace(/\D/g, '');
      
      if(cnpjLimpo.length !== 14) {
          // SUBSTIUI O ALERT NATIVO PELO MODAL BONITO
          return showAlert({ 
              type: 'warning', 
              title: 'CNPJ Inválido', 
              description: "O CNPJ deve conter exatamente 14 números." 
          });
      }
      
      setProcessando(true);
      setStatusMsg('Consultando Receita Federal...');

      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      
      try {
          const res = await fetch('/api/contador/vinculo', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json', 
                  'x-user-id': userId || '',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ cnpj: cnpjLimpo })
          });
          
          const data = await res.json();
          
          if(res.ok) {
              setNovoCnpj('');
              setStatusMsg('');
              
              // SUCESSO VISUAL (MODAL VERDE)
              await showAlert({
                  type: 'success',
                  title: 'Sucesso!',
                  description: data.message || 'Empresa vinculada com sucesso!'
              });
              
              setLoading(true);
              carregar();
          } else {
              setStatusMsg('');
              // ERRO VISUAL (MODAL VERMELHO)
              showAlert({
                  type: 'danger',
                  title: 'Falha ao Vincular',
                  description: data.error || "Ocorreu um erro ao processar sua solicitação."
              });
          }
      } catch(e) { 
          setStatusMsg('');
          showAlert({
              type: 'danger',
              title: 'Erro de Conexão',
              description: "Não foi possível conectar ao servidor. Verifique sua internet."
          });
      } finally { 
          setProcessando(false); 
      }
  };

  const acessarEmpresa = (empresaId: string, status: string) => {
      if(status !== 'APROVADO') {
          showAlert({
              type: 'info',
              title: 'Acesso Restrito',
              description: "Você só pode acessar o painel quando o vínculo for aprovado."
          });
          return;
      }
      
      // 1. Define o contexto da empresa que o contador vai gerenciar
      localStorage.setItem('empresaContextId', empresaId);
      
      // 2. Avisa os componentes que o contexto mudou
      window.dispatchEvent(new Event('storage'));
      
      // 3. Redireciona
      router.push('/cliente/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
        <header className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Painel do Contador</h1>
                <p className="text-slate-500">Gerencie sua carteira de clientes.</p>
            </div>
            <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="text-red-500 flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded transition">
                <LogOut size={18}/> Sair
            </button>
        </header>

        {/* CARTÃO DE ADIÇÃO SIMPLIFICADO */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 mb-8 flex flex-col md:flex-row items-center gap-6">
            <div className="flex items-center gap-4 flex-1">
                <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                    <Plus size={24}/>
                </div>
                <div>
                    <h3 className="font-bold text-slate-700">Adicionar Novo Cliente</h3>
                    <p className="text-sm text-slate-500">
                        Informe apenas o CNPJ. Nós buscamos os dados automaticamente.
                    </p>
                </div>
            </div>
            
            <div className="flex flex-col gap-2 w-full md:w-auto">
                <div className="flex gap-2">
                    <input 
                        className="p-3 border rounded-lg outline-blue-500 w-full md:w-64 font-mono text-sm"
                        placeholder="CNPJ (Somente números)"
                        value={novoCnpj}
                        onChange={e => setNovoCnpj(e.target.value.replace(/\D/g, ''))}
                        maxLength={14}
                        disabled={processando}
                    />
                    <button 
                        onClick={handleAdicionarCliente} 
                        disabled={processando || novoCnpj.length < 14}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2 min-w-[140px]"
                    >
                        {processando ? <Loader2 className="animate-spin" size={18}/> : 'Adicionar'}
                    </button>
                </div>
                {statusMsg && <p className="text-xs text-blue-600 font-medium animate-pulse ml-1">{statusMsg}</p>}
            </div>
        </div>

        {/* BARRA DE PESQUISA */}
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-6 gap-4">
            <h2 className="font-bold text-lg text-slate-700 flex items-center gap-2">
                <Building2 size={20}/> Minhas Empresas
                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{filteredEmpresas.length}</span>
            </h2>
            
            <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                <input 
                    className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Filtrar por nome ou CNPJ..."
                    value={termoBusca}
                    onChange={e => setTermoBusca(e.target.value)}
                />
            </div>
        </div>
        
        {/* GRID */}
        {loading ? <div className="text-center p-10"><Loader2 className="animate-spin mx-auto text-blue-500"/></div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEmpresas.map(v => (
                    <div key={v.id} className={`bg-white p-5 rounded-xl border shadow-sm transition group relative flex flex-col justify-between ${v.status === 'APROVADO' ? 'hover:border-blue-400 hover:shadow-md' : 'opacity-80 bg-slate-50'}`}>
                        
                        <div>
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded border">
                                    {v.empresa.documento}
                                </span>
                                {v.status === 'APROVADO' ? (
                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                        <CheckCircle size={10}/> ATIVO
                                    </span>
                                ) : v.status === 'PENDENTE' ? (
                                    <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                        <Clock size={10}/> AGUARDANDO
                                    </span>
                                ) : (
                                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                        <AlertTriangle size={10}/> RECUSADO
                                    </span>
                                )}
                            </div>
                            
                            <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1 line-clamp-2 h-14" title={v.empresa.razaoSocial}>
                                {v.empresa.razaoSocial || 'Empresa sem Nome'}
                            </h3>
                            
                            <p className="text-xs text-slate-400 mb-2">
                                {v.empresa.cidade && v.empresa.uf ? `${v.empresa.cidade}/${v.empresa.uf}` : 'Localização não informada'}
                            </p>
                        </div>
                        
                        {v.status === 'APROVADO' ? (
                            <button 
                                onClick={() => acessarEmpresa(v.empresa.id, v.status)}
                                className="mt-4 w-full py-2.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-600 hover:text-white transition flex items-center justify-center gap-2"
                            >
                                Acessar Painel <ArrowRight size={16}/>
                            </button>
                        ) : (
                            <div className="mt-4 w-full py-2.5 bg-slate-100 text-slate-400 rounded-lg text-xs font-medium text-center border border-slate-200 cursor-not-allowed">
                                {v.status === 'PENDENTE' ? 'Aprovação pendente pelo dono.' : 'Acesso negado.'}
                            </div>
                        )}
                    </div>
                ))}
                
                {filteredEmpresas.length === 0 && (
                    <div className="col-span-full text-center p-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        Nenhuma empresa encontrada.
                    </div>
                )}
            </div>
        )}
    </div>
  );
}