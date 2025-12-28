"use client";

import { useState, useEffect } from "react";
import { CheckCircle, ArrowRight, ArrowLeft, Building2, Calculator, FileCheck, UserPlus, Users, Search, MapPin, Briefcase, XCircle, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

interface ClienteDB {
  id: string;
  nome: string;
  documento: string;
}

interface CnaeDB {
  id: string;
  codigo: string;
  descricao: string;
  principal: boolean;
}

export default function EmitirNotaPage() {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  const retryId = searchParams.get('retry');

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingRetry, setLoadingRetry] = useState(false);
  
  // Feedback Visual
  const [feedback, setFeedback] = useState<{ show: boolean; type: 'success' | 'error'; title: string; msg: string }>({
    show: false, type: 'success', title: '', msg: ''
  });

  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [meusCnaes, setMeusCnaes] = useState<CnaeDB[]>([]);
  const [modoCliente, setModoCliente] = useState<'existente' | 'novo'>('existente');
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  const [novoCliente, setNovoCliente] = useState({ 
    nome: '', email: '', documento: '', cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '', codigoIbge: ''
  });

  const [nfData, setNfData] = useState({
    clienteId: "", clienteNome: "", servicoDescricao: "", valor: "", retencoes: false, codigoCnae: "" 
  });

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if(!userId) { router.push('/login'); return; }

    // 1. Carregar Clientes
    fetch('/api/clientes', { headers: { 'x-user-id': userId } })
      .then(res => res.json())
      .then(data => setClientes(data))
      .catch(console.error);

    // 2. Carregar Perfil (CNAEs)
    fetch('/api/perfil', { headers: { 'x-user-id': userId } })
      .then(res => res.json())
      .then(data => {
         if (data.atividades && Array.isArray(data.atividades)) {
             setMeusCnaes(data.atividades);
             if (!retryId) { 
                 const principal = data.atividades.find((c: CnaeDB) => c.principal);
                 if (principal) setNfData(prev => ({ ...prev, codigoCnae: principal.codigo }));
                 else if (data.atividades.length > 0) setNfData(prev => ({ ...prev, codigoCnae: data.atividades[0].codigo }));
             }
         }
      })
      .catch(console.error);

    // 3. SE FOR MODO CORREÇÃO
    if (retryId) {
        setLoadingRetry(true);
        fetch(`/api/vendas/${retryId}`, { headers: { 'x-user-id': userId } })
            .then(async res => {
                if (res.ok) {
                    const venda = await res.json();
                    setNfData(prev => ({
                        ...prev,
                        clienteId: venda.clienteId,
                        clienteNome: venda.cliente?.razaoSocial || "Cliente",
                        valor: venda.valor,
                        servicoDescricao: venda.descricao,
                        codigoCnae: venda.notas?.[0]?.cnae || prev.codigoCnae 
                    }));
                    setStep(2);
                }
            })
            .catch(() => alert("Erro ao recuperar dados da venda."))
            .finally(() => setLoadingRetry(false));
    }

  }, [router, retryId]);

  const buscarClienteCNPJ = async () => {
    const docLimpo = novoCliente.documento.replace(/\D/g, '');
    if(docLimpo.length !== 14) { alert("Digite um CNPJ válido."); return; }
    setBuscandoCliente(true);
    try {
      const res = await fetch('/api/external/cnpj', { method: 'POST', body: JSON.stringify({ cnpj: docLimpo }) });
      const dados = await res.json();
      if(res.ok) {
        setNovoCliente(prev => ({ ...prev, ...dados, nome: dados.razaoSocial }));
      } else { alert("CNPJ não encontrado."); }
    } catch (e) { alert("Erro de conexão."); }
    finally { setBuscandoCliente(false); }
  }

  const handleNext = async () => {
    if (step === 1 && modoCliente === 'novo') {
        const userId = localStorage.getItem('userId');
        try {
            const res = await fetch('/api/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
                body: JSON.stringify(novoCliente)
            });
            if (res.ok) {
                const criado = await res.json();
                setNfData({ ...nfData, clienteId: criado.id, clienteNome: criado.nome });
                setStep(step + 1);
            } else { alert("Erro ao cadastrar cliente."); }
        } catch (e) { alert("Erro de conexão."); }
    } else { setStep(step + 1); }
  };

  const handleBack = () => setStep(step - 1);

  // --- TRADUTOR DE ERRO PARA O MODAL ---
  const getFriendlyFeedback = (errorMsg: string) => {
      const msg = errorMsg.toLowerCase();
      
      if (msg.includes('certificado')) {
          return "Certificado Digital não encontrado. Para emitir notas, vá em 'Configurações' e faça o upload do seu e-CNPJ.";
      }
      if (msg.includes('cnpj') || msg.includes('cpf')) {
          return "CPF/CNPJ do cliente inválido ou não informado. Verifique o cadastro.";
      }
      return errorMsg; // Retorna original se não for conhecido
  }

  const handleEmitir = async () => {
    if (!nfData.codigoCnae) { alert("Selecione uma Atividade (CNAE)."); return; }

    setLoading(true);
    const userId = localStorage.getItem('userId');

    try {
      const res = await fetch('/api/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
        body: JSON.stringify({
          clienteId: nfData.clienteId,
          valor: nfData.valor,
          descricao: nfData.servicoDescricao,
          codigoCnae: nfData.codigoCnae
        })
      });

      const resposta = await res.json();

      if (res.ok) {
        setFeedback({ 
            show: true, type: 'success', title: 'Sucesso!', 
            msg: 'A nota foi enviada para processamento.' 
        });
      } else {
        // AQUI ESTÁ A MUDANÇA: Usamos a função de tradução
        setFeedback({ 
            show: true, 
            type: 'error', 
            title: 'Não foi possível emitir', 
            msg: getFriendlyFeedback(resposta.error || 'Erro desconhecido.') 
        });
      }

    } catch (error) {
      setFeedback({ show: true, type: 'error', title: 'Erro de Conexão', msg: 'Verifique sua internet.' });
    } finally {
      setLoading(false);
      setTimeout(() => { router.push('/cliente/dashboard'); }, 3500); // 3.5s para ler
    }
  };

  const valorNumerico = parseFloat(nfData.valor) || 0;

  if(loadingRetry) return <div className="h-screen flex items-center justify-center text-blue-600 font-bold"><Loader2 className="animate-spin mr-2"/> Recuperando dados...</div>;

  return (
    <div className="max-w-4xl mx-auto py-10 relative">
      
      {/* MODAL DE FEEDBACK (Visual do Cliente) */}
      {feedback.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center transform transition-all scale-100 animate-in zoom-in-95 duration-300 border border-slate-100">
                <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${feedback.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-500'}`}>
                    {feedback.type === 'success' ? <CheckCircle size={48} /> : <XCircle size={48} />}
                </div>
                
                <h3 className={`text-2xl font-bold mb-3 ${feedback.type === 'success' ? 'text-slate-800' : 'text-red-700'}`}>
                    {feedback.title}
                </h3>
                
                {/* MENSAGEM AMIGÁVEL */}
                <p className="text-slate-600 mb-8 text-base leading-relaxed px-4">
                    {feedback.msg}
                </p>
                
                <div className="flex items-center justify-center gap-2 text-xs text-blue-600 font-bold uppercase tracking-wide animate-pulse">
                    <Loader2 size={14} className="animate-spin"/>
                    Redirecionando para o histórico...
                </div>
            </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800">
              {retryId ? `Corrigir Venda` : 'Emitir Nova NFS-e'}
          </h2>
          {retryId && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">MODO CORREÇÃO</span>}
      </div>

      {/* Steps */}
      <div className="flex justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 transform -translate-y-1/2"></div>
        {[
          { id: 1, label: "Tomador", icon: Building2 },
          { id: 2, label: "Serviço", icon: Calculator },
          { id: 3, label: "Revisão", icon: FileCheck }
        ].map((s) => (
          <div key={s.id} className={`flex flex-col items-center bg-slate-100 px-4 py-2 rounded-lg ${step >= s.id ? "text-blue-600" : "text-slate-400"}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${step >= s.id ? "bg-blue-600 text-white" : "bg-slate-300 text-slate-500"}`}>
              <s.icon size={20} />
            </div>
            <span className="text-sm font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        
        {/* PASSO 1 */}
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Quem é o cliente?</h3>
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                <button onClick={() => setModoCliente('existente')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${modoCliente === 'existente' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Users size={16} /> Selecionar da Lista
                </button>
                <button onClick={() => setModoCliente('novo')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${modoCliente === 'novo' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                    <UserPlus size={16} /> Cadastrar Novo
                </button>
            </div>

            {modoCliente === 'existente' ? (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Selecione o Cliente</label>
                    <select 
                        className="w-full p-3 border rounded-lg bg-slate-50 outline-blue-500 text-slate-700"
                        value={nfData.clienteId}
                        onChange={(e) => {
                            const selected = clientes.find(c => c.id === e.target.value);
                            setNfData({ ...nfData, clienteId: e.target.value, clienteNome: selected?.nome || "" });
                        }}
                    >
                        <option value="">Selecione...</option>
                        {clientes.map(cliente => (
                            <option key={cliente.id} value={cliente.id}>{cliente.nome} ({cliente.documento})</option>
                        ))}
                    </select>
                </div>
            ) : (
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">CPF / CNPJ</label>
                            <div className="flex gap-2">
                                <input className="w-full p-2 border rounded bg-white" placeholder="000.000.000-00" value={novoCliente.documento} onChange={e => setNovoCliente({...novoCliente, documento: e.target.value})}/>
                                <button onClick={buscarClienteCNPJ} disabled={buscandoCliente} className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50">
                                    {buscandoCliente ? '...' : <Search size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                            <input className="w-full p-2 border rounded bg-white" value={novoCliente.nome} onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input className="w-full p-2 border rounded bg-white" value={novoCliente.email} onChange={e => setNovoCliente({...novoCliente, email: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1"><MapPin size={14} /> Cidade/UF</label>
                            <input className="w-full p-2 border rounded bg-gray-100 text-gray-600" readOnly value={novoCliente.cidade ? `${novoCliente.cidade}/${novoCliente.uf}` : ''} placeholder="Automático..." />
                        </div>
                    </div>
                </div>
            )}
          </div>
        )}

        {/* PASSO 2 */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Detalhes do Serviço</h3>
            
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <label className="block text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                    <Briefcase size={18} /> Atividade Econômica (CNAE)
                </label>
                {meusCnaes.length === 0 ? (
                    <div className="text-sm text-red-600">⚠️ Sem atividades cadastradas. Configure sua empresa.</div>
                ) : (
                    <select 
                        className="w-full p-3 border rounded-lg bg-white outline-blue-500 text-slate-700"
                        value={nfData.codigoCnae}
                        onChange={(e) => setNfData({...nfData, codigoCnae: e.target.value})}
                    >
                        {meusCnaes.map(cnae => (
                            <option key={cnae.id} value={cnae.codigo}>
                                {cnae.codigo} - {cnae.descricao} {cnae.principal ? '(Principal)' : ''}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Valor do Serviço (R$)</label>
              <input type="number" placeholder="0,00" className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700 text-lg font-bold" value={nfData.valor} onChange={(e) => setNfData({...nfData, valor: e.target.value})}/>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Discriminação</label>
              <textarea rows={4} placeholder="Descrição detalhada..." className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700" value={nfData.servicoDescricao} onChange={(e) => setNfData({...nfData, servicoDescricao: e.target.value})}></textarea>
            </div>
          </div>
        )}

        {/* PASSO 3 */}
        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Revisão</h3>
            <div className="bg-slate-50 p-6 rounded-lg space-y-4 border border-slate-200">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Tomador:</span>
                <span className="font-medium text-slate-900">{modoCliente === 'novo' ? novoCliente.nome : nfData.clienteNome}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Atividade (CNAE):</span>
                <span className="font-medium text-slate-900">{nfData.codigoCnae}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-500">Valor Bruto:</span>
                <span className="font-bold text-slate-900">R$ {valorNumerico.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs text-center text-slate-400">Ao clicar em emitir, a nota será processada no ambiente nacional.</p>
          </div>
        )}

        <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
          {step > 1 ? (
            <button onClick={handleBack} className="flex items-center gap-2 text-slate-500 px-4 py-2 hover:bg-gray-100 rounded">
                <ArrowLeft size={18} /> Voltar
            </button>
          ) : <div></div>}

          {step < 3 ? (
            <button 
                onClick={handleNext} 
                disabled={(modoCliente === 'existente' && !nfData.clienteId) || (modoCliente === 'novo' && !novoCliente.nome)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
                {step === 1 && modoCliente === 'novo' ? 'Salvar e Avançar' : 'Próximo'} <ArrowRight size={18} />
            </button>
          ) : (
            <button 
                onClick={handleEmitir} 
                disabled={loading} 
                className="bg-green-600 text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700 shadow-lg disabled:opacity-50 font-bold"
            >
                {loading ? 'Enviando...' : <><CheckCircle size={20} /> EMITIR NOTA</>}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}