'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    ArrowLeft, FileJson, Building, User, FileText, 
    DollarSign, Activity, RefreshCw, Trash2, Code, AlertTriangle, CheckCircle, Copy, Loader2
} from 'lucide-react';

export default function DetalheVendaCompleto() {
  const { id } = useParams();
  const router = useRouter();
  
  const [venda, setVenda] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Controle de Edição e Abas
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'xml' | 'logs'>('dados');
  
  // Formulário
  const [formData, setFormData] = useState({
      descricao: '',
      valor: '', 
      cnae: ''
  });

  const fetchVenda = () => {
    // Não ativa loading total para não piscar a tela inteira se for apenas refresh
    if (!venda) setLoading(true);
    
    fetch(`/api/admin/vendas/${id}`)
        .then(r => r.json())
        .then(data => {
            setVenda(data);
            
            // Tenta pegar CNAE da nota ou do JSON salvo
            let cnaeSalvo = data.notas?.[0]?.cnae || '';
            if (!cnaeSalvo && data.payloadJson) {
                try {
                    const parsed = typeof data.payloadJson === 'string' ? JSON.parse(data.payloadJson) : data.payloadJson;
                    cnaeSalvo = parsed?.servico?.codigoCnae || '';
                } catch(e) {}
            }

            // Só atualiza o form se não estiver editando, para não sobrescrever o que o usuário digita
            if (!isEditing) {
                setFormData({
                    descricao: data.descricao || '',
                    valor: data.valor ? String(data.valor).replace('.', ',') : '',
                    cnae: cnaeSalvo
                });
            }
        })
        .catch(err => console.error("Erro ao buscar venda:", err))
        .finally(() => setLoading(false));
  };

  useEffect(() => { fetchVenda(); }, [id]);

  const parseValor = (val: string) => {
      if(!val) return 0;
      const limpo = val.replace(/[^\d,]/g, '').replace(',', '.');
      return parseFloat(limpo);
  };

  const handleSave = async (reenviar = false) => {
      setProcessing(true);
      
      // 1. RECUPERAR CREDENCIAIS DO LOCALSTORAGE
      const userId = localStorage.getItem('userId');
      const contextId = localStorage.getItem('empresaContextId'); // <--- ESSENCIAL

      const payloadEnvio = {
          ...formData,
          valor: parseValor(formData.valor) 
      };

      try {
          // Salva no banco (PUT)
          const resUpdate = await fetch(`/api/admin/vendas/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payloadEnvio)
          });

          if (!resUpdate.ok) throw new Error("Erro ao salvar dados no banco.");

          if (reenviar) {
              // 2. REENVIA COM OS HEADERS DE AUTENTICAÇÃO CORRETOS
              const resRetry = await fetch('/api/notas/retry', {
                  method: 'POST',
                  headers: { 
                      'Content-Type': 'application/json', 
                      'x-user-id': userId || '',       // <--- OBRIGATÓRIO
                      'x-empresa-id': contextId || ''  // <--- OBRIGATÓRIO SE FOR CONTADOR
                  },
                  body: JSON.stringify({ 
                      vendaId: id, 
                      dadosAtualizados: payloadEnvio 
                  })
              });
              
              const dataRetry = await resRetry.json();
              
              // Se der erro, mostra mensagem mas não trava a tela
              if(!resRetry.ok) {
                  alert(`⚠️ Erro no envio: ${dataRetry.error || "Falha desconhecida"}`);
                  // Mesmo com erro, recarrega para mostrar o log de falha
                  setIsEditing(false);
                  fetchVenda();
                  return;
              }
              
              alert("🚀 Reenvio iniciado com sucesso!");
              
              // Atualiza interface
              setIsEditing(false);
              setActiveTab('logs');
              setTimeout(() => fetchVenda(), 1000); 

          } else {
              alert("✅ Rascunho salvo.");
              setIsEditing(false);
              fetchVenda();
          }

      } catch (error: any) {
          alert("❌ " + error.message);
      } finally {
          setProcessing(false);
      }
  };

  const handleDelete = async () => {
      const confirmacao = prompt("⚠️ ZONA DE PERIGO ⚠️\n\nDigite 'DELETAR' para apagar permanentemente esta venda e seus logs.");
      if (confirmacao !== 'DELETAR') return;

      setProcessing(true);
      try {
          const res = await fetch(`/api/admin/vendas/${id}`, { method: 'DELETE' });
          if (res.ok) {
              alert("Venda excluída.");
              router.push('/admin/emissoes');
          } else {
              const err = await res.json();
              alert("Erro: " + err.error);
          }
      } catch (e) { alert("Erro de conexão."); }
      finally { setProcessing(false); }
  };

  if (loading && !venda) return <div className="h-screen flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2"/> Carregando...</div>;
  if (!venda) return <div className="p-8">Venda não encontrada.</div>;

  const statusColor = venda.status === 'CONCLUIDA' ? 'bg-green-100 text-green-700 border-green-200' : 
                      venda.status === 'ERRO_EMISSAO' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700';

  let prettyPayload = "// Payload indisponível";
  try { prettyPayload = JSON.stringify(JSON.parse(venda.payloadJson), null, 2); } catch(e) {}

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* HEADER FIXO */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
                  <ArrowLeft size={20}/>
              </button>
              <div>
                  <h1 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                      Venda #{venda.id.split('-')[0]}
                      <span className={`text-[10px] px-2 py-0.5 rounded border uppercase ${statusColor}`}>
                          {venda.status.replace('_', ' ')}
                      </span>
                  </h1>
                  <p className="text-xs text-slate-500">
                      {venda.empresa.razaoSocial} ➔ {venda.cliente.razaoSocial}
                  </p>
              </div>
          </div>
          
          <button onClick={handleDelete} disabled={processing} className="text-red-500 hover:bg-red-50 px-3 py-2 rounded transition text-sm font-bold flex items-center gap-2 border border-transparent hover:border-red-100">
              <Trash2 size={16}/> Excluir Venda
          </button>
      </div>

      <div className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLUNA ESQUERDA */}
          <div className="lg:col-span-2 space-y-6">
              
              <div className="flex border-b border-slate-200 mb-4 bg-white rounded-t-xl px-2">
                  <button onClick={() => setActiveTab('dados')} className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'dados' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                      <FileText size={16} className="inline mr-2 mb-0.5"/> Dados da Nota
                  </button>
                  <button onClick={() => setActiveTab('xml')} className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'xml' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                      <Code size={16} className="inline mr-2 mb-0.5"/> XMLs e JSON
                  </button>
                  <button onClick={() => setActiveTab('logs')} className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'logs' ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                      <Activity size={16} className="inline mr-2 mb-0.5"/> Logs
                  </button>
              </div>

              {/* ABA DADOS */}
              {activeTab === 'dados' && (
                  <div className="space-y-6">
                    {isEditing && (
                        <div className="bg-blue-600 text-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-center animate-in slide-in-from-top-2 sticky top-20 z-30 gap-4">
                            <div className="flex items-center gap-2">
                                <RefreshCw className="animate-spin-slow" size={20}/>
                                <span className="font-bold">Modo de Correção Ativo</span>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={() => { setIsEditing(false); }} className="flex-1 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-xs font-bold transition">
                                    Cancelar
                                </button>
                                <button onClick={() => handleSave(false)} disabled={processing} className="flex-1 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-bold transition">
                                    {processing ? <Loader2 className="animate-spin mx-auto" size={14}/> : 'Salvar Rascunho'}
                                </button>
                                <button onClick={() => handleSave(true)} disabled={processing} className="flex-1 px-4 py-2 rounded-lg bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold transition shadow-sm">
                                    {processing ? 'Enviando...' : 'Salvar e Reemitir 🚀'}
                                </button>
                            </div>
                        </div>
                    )}

                    <section className={`bg-white rounded-xl shadow-sm border p-6 transition-all ${isEditing ? 'border-blue-300 ring-4 ring-blue-50' : 'border-slate-200'}`}>
                        <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                            <Building size={16}/> Dados do Serviço
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Descrição do Serviço</label>
                                {isEditing ? (
                                    <textarea 
                                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 text-slate-800 text-sm"
                                        rows={4}
                                        value={formData.descricao}
                                        onChange={e => setFormData({...formData, descricao: e.target.value})}
                                    />
                                ) : (
                                    <div className="p-3 bg-slate-50 rounded border text-slate-700 whitespace-pre-wrap text-sm border-slate-100">
                                        {venda.descricao}
                                    </div>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Código CNAE</label>
                                    {isEditing ? (
                                        <input 
                                            className="w-full p-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={formData.cnae}
                                            onChange={e => setFormData({...formData, cnae: e.target.value})}
                                        />
                                    ) : (
                                        <div className="font-mono font-bold text-slate-700 bg-slate-50 p-2 rounded border border-transparent text-sm">
                                            {formData.cnae || '-'}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Valor do Serviço (R$)</label>
                                    {isEditing ? (
                                        <div className="relative">
                                            <span className="absolute left-3 top-3 text-slate-400 text-xs">R$</span>
                                            <input 
                                                type="text" 
                                                className="w-full pl-8 p-3 border rounded-lg font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={formData.valor}
                                                onChange={e => setFormData({...formData, valor: e.target.value})}
                                                placeholder="0,00"
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-xl font-bold text-green-700 flex items-center gap-1 p-2">
                                            <DollarSign size={16}/> {Number(venda.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* DADOS CADASTRAIS (APENAS LEITURA) */}
                    <div className="grid grid-cols-2 gap-6">
                        <section className="bg-white rounded-xl shadow-sm border p-5">
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3"><Building size={14} className="inline mr-1"/> Prestador</h3>
                            <p className="font-bold text-slate-800 text-sm truncate">{venda.empresa.razaoSocial}</p>
                            <p className="text-xs text-slate-500 font-mono mt-1">{venda.empresa.documento}</p>
                        </section>
                        <section className="bg-white rounded-xl shadow-sm border p-5">
                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3"><User size={14} className="inline mr-1"/> Tomador</h3>
                            <p className="font-bold text-slate-800 text-sm truncate">{venda.cliente.razaoSocial}</p>
                            <p className="text-xs text-slate-500 font-mono mt-1">{venda.cliente.documento}</p>
                        </section>
                    </div>
                  </div>
              )}

              {/* ABA XML/JSON */}
              {activeTab === 'xml' && (
                  <div className="space-y-6">
                      <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden border border-slate-700">
                          <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                              <span className="text-xs text-blue-400 font-bold uppercase flex items-center gap-2">
                                  <FileJson size={14}/> Payload de Envio (JSON)
                              </span>
                              <button onClick={() => navigator.clipboard.writeText(prettyPayload)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                                  <Copy size={12}/> Copiar
                              </button>
                          </div>
                          <pre className="p-4 text-xs font-mono text-green-400 overflow-auto max-h-[400px] custom-scrollbar whitespace-pre-wrap">
                              {prettyPayload}
                          </pre>
                      </div>

                      {(venda.notas?.[0]?.xmlBase64 || venda.xmlErro) ? (
                          <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden border border-slate-700">
                              <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
                                  <span className="text-xs text-orange-400 font-bold uppercase flex items-center gap-2">
                                      <Code size={14}/> XML de Retorno (Sefaz)
                                  </span>
                              </div>
                              <pre className="p-4 text-xs font-mono text-orange-200 overflow-auto max-h-[400px] custom-scrollbar whitespace-pre-wrap">
                                  {venda.notas?.[0]?.xmlBase64 ? atob(venda.notas[0].xmlBase64) : venda.xmlErro}
                              </pre>
                          </div>
                      ) : (
                          <div className="p-8 text-center border-2 border-dashed border-slate-300 rounded-xl text-slate-400 bg-slate-50">
                              Nenhum XML de retorno disponível ainda.
                          </div>
                      )}
                  </div>
              )}

              {/* ABA LOGS */}
              {activeTab === 'logs' && (
                  <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                      <div className="overflow-y-auto p-4 space-y-4 custom-scrollbar max-h-[600px]">
                          {venda.logs.map((log: any) => (
                              <div key={log.id} className="relative pl-4 border-l-2 border-slate-200 pb-4 last:pb-0">
                                  <div className={`absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full ${
                                      log.level === 'ERRO' ? 'bg-red-500' : 
                                      log.action === 'REENVIO_MANUAL' ? 'bg-blue-600' : 'bg-green-500'
                                  }`}></div>
                                  
                                  <div className="flex justify-between items-start">
                                      <p className="text-xs font-bold text-slate-700">{log.action}</p>
                                      <span className="text-[10px] text-slate-400 font-mono">{new Date(log.createdAt).toLocaleTimeString()}</span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-1 break-words">{log.message}</p>
                                  
                                  {log.details && log.level === 'ERRO' && (
                                      <div className="mt-2 bg-red-50 p-3 rounded text-[10px] font-mono text-red-700 border border-red-100 break-words leading-relaxed">
                                          {log.details.length > 300 ? log.details.substring(0, 300) + '...' : log.details}
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>

          {/* COLUNA DIREITA (STATUS E RESUMO) */}
          <div className="space-y-6">
              <div className={`rounded-xl p-6 border ${
                  venda.status === 'ERRO_EMISSAO' ? 'bg-red-50 border-red-200' : 
                  venda.status === 'PROCESSANDO' ? 'bg-blue-50 border-blue-200' :
                  'bg-white border-slate-200 shadow-sm'
              }`}>
                  <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Status Atual</h4>
                  
                  {venda.status === 'ERRO_EMISSAO' ? (
                      <div>
                          <div className="flex items-center gap-2 text-red-600 font-bold text-lg mb-2">
                              <AlertTriangle/> FALHA NA EMISSÃO
                          </div>
                          <p className="text-sm text-red-700 mb-4 leading-relaxed">
                              A prefeitura rejeitou o envio ou houve timeout.
                          </p>
                          
                          <button 
                            onClick={() => { setIsEditing(true); setActiveTab('dados'); }} 
                            className="w-full py-3 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition shadow-sm flex items-center justify-center gap-2"
                          >
                              <RefreshCw size={16}/> Corrigir Agora
                          </button>
                      </div>
                  ) : venda.status === 'CONCLUIDA' ? (
                      <div>
                          <div className="flex items-center gap-2 text-green-600 font-bold text-lg mb-2">
                              <CheckCircle/> AUTORIZADA
                          </div>
                          <p className="text-sm text-slate-600">
                              Nota fiscal emitida com sucesso.
                          </p>
                      </div>
                  ) : venda.status === 'PROCESSANDO' ? (
                      <div>
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-lg mb-2 animate-pulse">
                              <Activity/> PROCESSANDO...
                          </div>
                          <p className="text-sm text-blue-700">
                              Aguardando retorno da Sefaz. Atualize a página em instantes.
                          </p>
                      </div>
                  ) : (
                      <div className="text-slate-600 font-bold text-lg">
                          {venda.status.replace('_', ' ')}
                      </div>
                  )}
              </div>
          </div>

      </div>
    </div>
  );
}