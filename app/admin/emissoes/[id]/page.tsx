'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Added useRouter
import { 
    Terminal, AlertTriangle, CheckCircle, 
    ChevronDown, ChevronRight, Activity, Loader2, 
    RefreshCcw, Ban, FileText, Send, Server 
} from 'lucide-react';

export default function DetalheEmissor() {
  const { id } = useParams();
  const router = useRouter(); // Initialized router
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Controle de qual venda está aberta
  const [expandedVenda, setExpandedVenda] = useState<string | null>(null);

  // Estado local para o ambiente (para atualizar a UI instantaneamente)
  const [ambienteAtual, setAmbienteAtual] = useState('');

  useEffect(() => {
    carregarDados();
  }, [id]);

  const carregarDados = () => {
    setLoading(true);
    fetch(`/api/admin/emissoes/${id}`)
        .then(async res => {
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Erro na API');
            return json;
        })
        .then(resData => {
            setData(resData);
            setAmbienteAtual(resData.empresa.ambiente || 'HOMOLOGACAO'); // Seta o inicial
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
  }

  // --- MUDANÇA DE AMBIENTE ---
  const handleMudarAmbiente = async (novoAmbiente: string) => {
      if(!confirm(`Deseja alterar o ambiente para ${novoAmbiente}?`)) return;

      setAmbienteAtual(novoAmbiente); // Atualiza visual

      try {
          const res = await fetch('/api/admin/empresas', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: id, ambiente: novoAmbiente })
          });
          
          if(res.ok) alert("Ambiente atualizado com sucesso!");
          else alert("Erro ao salvar ambiente no banco.");
          
      } catch (e) {
          alert("Erro de conexão.");
      }
  };

  // === AÇÃO DOS BOTÕES CONECTADA À API ===
  const handleAction = async (action: string, vendaId: string) => {
      const confirmacao = action === 'CANCELAR' 
        ? "Tem certeza que deseja CANCELAR esta nota fiscal? Essa ação é irreversível." 
        : "Deseja liberar esta venda para correção?";

      if (!confirm(confirmacao)) return;

      try {
          const res = await fetch('/api/notas/gerenciar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ acao: action, vendaId })
          });

          const resposta = await res.json();

          if (res.ok) {
              alert("✅ " + resposta.message);
              carregarDados(); // Recarrega a tela para ver o novo status
          } else {
              alert("❌ Erro: " + resposta.error);
          }
      } catch (e) {
          alert("Erro de conexão ao processar ação.");
      }
  }

  if (loading && !data) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40}/></div>;
  
  if (error) return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
          <AlertTriangle className="text-red-500" size={50}/>
          <h2 className="text-xl font-bold text-slate-700">Erro ao carregar dados</h2>
          <p className="text-red-600 bg-red-50 p-4 rounded border border-red-200 font-mono text-sm">{error}</p>
      </div>
  );

  if (!data?.empresa) return null;

  const { empresa, vendas } = data;

  const toggleVenda = (vendaId: string) => {
      setExpandedVenda(expandedVenda === vendaId ? null : vendaId);
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      
      {/* CABEÇALHO */}
      <div className="bg-white border-b px-8 py-6 shadow-sm shrink-0">
         <div className="flex justify-between items-start">
             <div>
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        {empresa.razaoSocial}
                    </h1>
                    
                    {/* === SELETOR DE AMBIENTE (NOVO) === */}
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <Server size={14} className="text-slate-400 ml-2"/>
                        <select 
                            value={ambienteAtual}
                            onChange={(e) => handleMudarAmbiente(e.target.value)}
                            className={`text-xs font-bold uppercase bg-transparent outline-none cursor-pointer py-1 pr-2 ${
                                ambienteAtual === 'PRODUCAO' ? 'text-red-600' : 'text-blue-600'
                            }`}
                        >
                            <option value="HOMOLOGACAO">Homologação</option>
                            <option value="PRODUCAO">Produção</option>
                        </select>
                    </div>
                    {/* ================================= */}
                </div>

                <div className="text-sm text-slate-500 font-mono mt-2 flex gap-4">
                    <span>CNPJ: {empresa.documento}</span>
                    <span>IM: {empresa.inscricaoMunicipal || '-'}</span>
                    <span>IBGE: {empresa.codigoIbge}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ml-2 ${empresa.certificadoA1 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {empresa.certificadoA1 ? 'Certificado OK' : 'Sem Certificado'}
                    </span>
                </div>
             </div>
             
             <div className="text-right">
                 <p className="text-xs text-slate-400 font-bold uppercase">Total de Vendas</p>
                 <p className="text-2xl font-bold text-slate-700">{vendas?.length || 0}</p>
             </div>
         </div>
      </div>

      {/* LISTA DE VENDAS */}
      <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                <Activity size={16}/> Histórico de Transações
            </h3>

            {(!vendas || vendas.length === 0) && (
                <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                    Nenhuma venda registrada.
                </div>
            )}

            <div className="space-y-4">
                {vendas?.map((venda: any) => (
                    <div key={venda.id} className={`bg-white rounded-xl shadow-sm border transition-all ${expandedVenda === venda.id ? 'ring-2 ring-blue-500 border-transparent' : 'border-slate-200 hover:border-blue-300'}`}>
                        
                        {/* BARRA DE RESUMO - COM REDIRECIONAMENTO */}
                        <div 
                            onClick={() => router.push(`/admin/vendas/${venda.id}`)}
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-full transition-colors bg-slate-100 text-slate-400`}>
                                    <ChevronRight size={20}/>
                                </div>
                                
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-slate-800 text-lg">
                                            {venda.cliente?.razaoSocial || 'Consumidor Final'}
                                        </span>
                                        {venda.status === 'CONCLUIDA' && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded border border-green-200">AUTORIZADA</span>}
                                        {venda.status === 'ERRO_EMISSAO' && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200">FALHOU</span>}
                                        {venda.status === 'PROCESSANDO' && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200 animate-pulse">PROCESSANDO</span>}
                                        {venda.status === 'CANCELADA' && <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded border border-gray-200 line-through">CANCELADA</span>}
                                        {venda.status === 'PENDENTE' && <span className="bg-yellow-50 text-yellow-700 text-[10px] font-bold px-2 py-0.5 rounded border border-yellow-200">PENDENTE</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5 font-mono">
                                        {new Date(venda.createdAt).toLocaleString()} • ID: {venda.id.split('-')[0]}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-lg font-bold text-slate-800">R$ {Number(venda.valor).toFixed(2)}</p>
                                {venda.notas && venda.notas.length > 0 && venda.notas[0].numero && (
                                    <p className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded mt-1">
                                        Nota #{venda.notas[0].numero}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* DETALHES RÁPIDOS SE NECESSÁRIO (OPCIONAL) */}
                        {venda.status === 'ERRO_EMISSAO' && (
                            <div className="bg-red-50 p-3 border-t border-red-100 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 text-red-700 font-medium">
                                    <AlertTriangle size={14}/>
                                    Falha na emissão. Clique para ver detalhes e corrigir.
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
      </div>
    </div>
  );
}