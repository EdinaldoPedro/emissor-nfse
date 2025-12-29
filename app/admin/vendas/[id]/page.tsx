'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    ArrowLeft, Download, FileJson, Building, User, FileText, DollarSign, Activity 
} from 'lucide-react';

export default function DetalheVendaCompleto() {
  const { id } = useParams();
  const router = useRouter();
  const [venda, setVenda] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dados' | 'tecnico'>('dados');

  useEffect(() => {
    fetch(`/api/admin/vendas/${id}`)
        .then(r => r.json())
        .then(setVenda)
        .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-500">Carregando detalhes...</div>;
  if (!venda) return <div className="p-8">Venda não encontrada.</div>;

  const statusColor = venda.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700 border-green-200' : 
                      venda.status === 'ERRO_EMISSAO' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700';

  const downloadPayload = () => {
      if(!venda.payloadJson) return alert("Nenhum payload registrado.");
      // Limpa as aspas extras se houver antes de baixar
      let content = venda.payloadJson;
      try {
          const parsed = JSON.parse(content);
          if (typeof parsed === 'string') content = parsed; // Remove aspas duplas externas
      } catch(e) {}

      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dps_venda_${venda.id}.json`;
      a.click();
  };

  // --- TRATAMENTO INTELIGENTE DO JSON (CORREÇÃO AQUI) ---
  let dpsData: any = {};
  let prettyJson = "// Payload vazio ou inválido";
  
  if (venda.payloadJson) {
      try {
          let parsed = JSON.parse(venda.payloadJson);
          
          // SE O RESULTADO AINDA FOR UMA STRING (Double Stringify), FAZ PARSE DE NOVO
          if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch(e) {}
          }

          dpsData = parsed; // Agora sim é um Objeto!
          prettyJson = JSON.stringify(parsed, null, 2); 
      } catch(e) {
          prettyJson = venda.payloadJson;
      }
  }

  // Fallback seguro para valores
  const cnaeDisplay = dpsData?.servico?.codigoCnae || venda.notas[0]?.cnae || '-';
  const itemLcDisplay = dpsData?.servico?.itemListaServico || 'Automático';
  const tribNacionalDisplay = dpsData?.servico?.codigoTributacaoNacional || 'Automático';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* HEADER */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
                  <ArrowLeft size={20}/>
              </button>
              <div>
                  <h1 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                      Venda #{venda.id.split('-')[0]}
                      <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${statusColor}`}>
                          {venda.status}
                      </span>
                  </h1>
                  <p className="text-xs text-slate-500">
                      Criado em {new Date(venda.createdAt).toLocaleString()} • {venda.empresa.razaoSocial}
                  </p>
              </div>
          </div>
          
          <button onClick={downloadPayload} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-medium transition border border-slate-200">
              <Download size={16}/> Baixar JSON
          </button>
      </div>

      <div className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUNA ESQUERDA */}
          <div className="lg:col-span-2 space-y-6">
              
              <div className="flex border-b border-slate-200 mb-4">
                  <button onClick={() => setActiveTab('dados')} className={`px-4 py-2 text-sm font-bold border-b-2 transition ${activeTab === 'dados' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
                      Dados da Nota
                  </button>
                  <button onClick={() => setActiveTab('tecnico')} className={`px-4 py-2 text-sm font-bold border-b-2 transition ${activeTab === 'tecnico' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
                      Payload Técnico (JSON)
                  </button>
              </div>

              {activeTab === 'dados' ? (
                  <>
                    {/* ... (SEÇÕES DE PRESTADOR E TOMADOR MANTIDAS IGUAIS) ... */}
                    <section className="bg-white rounded-xl shadow-sm border p-5">
                        <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                            <Building size={16}/> Prestador (Emissor)
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><label className="block text-xs text-gray-400">Razão Social</label><div className="font-medium text-slate-800">{venda.empresa.razaoSocial}</div></div>
                            <div><label className="block text-xs text-gray-400">CNPJ</label><div className="font-mono text-slate-600">{venda.empresa.documento}</div></div>
                            <div><label className="block text-xs text-gray-400">Inscrição Municipal</label><div className="font-mono text-slate-600">{venda.empresa.inscricaoMunicipal || '-'}</div></div>
                            <div><label className="block text-xs text-gray-400">Regime Tributário</label><div className="font-medium text-slate-600">{venda.empresa.regimeTributario}</div></div>
                        </div>
                    </section>

                    <section className="bg-white rounded-xl shadow-sm border p-5">
                        <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                            <User size={16}/> Tomador (Cliente)
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="col-span-2"><label className="block text-xs text-gray-400">Razão Social</label><div className="font-medium text-slate-800">{venda.cliente.razaoSocial}</div></div>
                            <div><label className="block text-xs text-gray-400">Documento</label><div className="text-slate-600 font-mono">{venda.cliente.documento}</div></div>
                            <div><label className="block text-xs text-gray-400">Localização</label><div className="text-slate-600">{venda.cliente.cidade}/{venda.cliente.uf}</div></div>
                        </div>
                    </section>

                    {/* SEÇÃO DE SERVIÇO (ONDE ESTAVA O ERRO) */}
                    <section className="bg-white rounded-xl shadow-sm border p-5">
                        <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                            <FileText size={16}/> Serviço e Tributação
                        </h3>
                        <div className="space-y-4 text-sm">
                            <div>
                                <label className="block text-xs text-gray-400">Discriminação</label>
                                <div className="p-3 bg-slate-50 rounded border text-slate-700 whitespace-pre-wrap">
                                    {venda.descricao}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-400">Código CNAE</label>
                                    {/* USANDO A VARIÁVEL CORRIGIDA */}
                                    <div className="font-mono font-bold text-slate-700">{cnaeDisplay}</div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400">Item LC 116</label>
                                    <div className="font-mono font-bold text-slate-700">{itemLcDisplay}</div>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400">Cód. Trib. Nacional</label>
                                    <div className="font-mono font-bold text-slate-700">{tribNacionalDisplay}</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-green-50 p-4 rounded border border-green-100 mt-4">
                                <span className="text-green-800 font-bold flex items-center gap-2">
                                    <DollarSign size={18}/> Valor Total
                                </span>
                                <span className="text-2xl font-bold text-green-700">
                                    R$ {Number(venda.valor).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </section>
                  </>
              ) : (
                  <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden border border-slate-700">
                      <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                          <span className="text-xs text-slate-400 font-mono">Payload JSON (infDPS)</span>
                          <FileJson size={14} className="text-slate-500"/>
                      </div>
                      <pre className="p-4 text-xs font-mono text-green-400 overflow-auto max-h-[600px] whitespace-pre-wrap">
                          {prettyJson}
                      </pre>
                  </div>
              )}
          </div>

          {/* COLUNA DIREITA (LOGS) */}
          <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border p-0 overflow-hidden flex flex-col max-h-[600px]">
                  <div className="p-4 border-b bg-slate-50 font-bold text-slate-700 flex items-center gap-2">
                      <Activity size={16}/> Linha do Tempo
                  </div>
                  <div className="overflow-y-auto p-4 space-y-4 custom-scrollbar">
                      {venda.logs.map((log: any) => (
                          <div key={log.id} className="relative pl-4 border-l-2 border-slate-200 pb-2 last:pb-0">
                              <div className={`absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full ${
                                  log.level === 'ERRO' ? 'bg-red-500' : 'bg-blue-500'
                              }`}></div>
                              
                              <p className="text-xs text-slate-400 font-mono mb-1">
                                  {new Date(log.createdAt).toLocaleTimeString()}
                              </p>
                              <p className="text-xs font-bold text-slate-700">{log.action}</p>
                              <p className="text-xs text-slate-600 mt-1 break-words">{log.message}</p>
                              
                              {log.details && log.level === 'ERRO' && (
                                  <div className="mt-2 bg-red-50 p-2 rounded text-[10px] font-mono text-red-700 border border-red-100 break-words">
                                      {/* Também limpamos o log de erro se estiver com aspas duplas */}
                                      {log.details.startsWith('"') ? log.details.slice(1, -1).substring(0, 200) : log.details.substring(0, 200)}...
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
}