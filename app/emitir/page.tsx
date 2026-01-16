"use client";

import { useState, useEffect } from "react";
import { CheckCircle, ArrowRight, ArrowLeft, Building2, Calculator, FileCheck, UserPlus, Users, Search, MapPin, Briefcase, Loader2, User, Building, Home, Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDialog } from "@/app/contexts/DialogContext";
import { validarCPF } from "@/app/utils/cpf";

interface ClienteDB {
  id: string;
  nome: string;
  documento: string;
  email?: string;
  nomeFantasia?: string;
  inscricaoMunicipal?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  codigoIbge?: string;
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
  const dialog = useDialog(); 

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingRetry, setLoadingRetry] = useState(false);
  
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [meusCnaes, setMeusCnaes] = useState<CnaeDB[]>([]);
  const [modoCliente, setModoCliente] = useState<'existente' | 'novo'>('existente');
  
  const [buscandoDoc, setBuscandoDoc] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState(false); 

  const [novoCliente, setNovoCliente] = useState({ 
    nome: '', nomeFantasia: '', inscricaoMunicipal: '', email: '', 
    documento: '', cep: '', logradouro: '', numero: '', 
    bairro: '', cidade: '', uf: '', codigoIbge: ''
  });

  const isPJ = novoCliente.documento.replace(/\D/g, '').length > 11;

  const [nfData, setNfData] = useState({
    clienteId: "", clienteNome: "", servicoDescricao: "", valor: "", retencoes: false, codigoCnae: "" 
  });

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const contextId = localStorage.getItem('empresaContextId');
    if(!userId) { router.push('/login'); return; }

    fetch('/api/perfil', { headers: { 'x-user-id': userId } })
      .then(res => res.json())
      .then(data => {
         if (data.atividades && Array.isArray(data.atividades)) {
             setMeusCnaes(data.atividades);
             setNfData(prev => {
                 if (!prev.codigoCnae && data.atividades.length > 0) {
                     const principal = data.atividades.find((c: CnaeDB) => c.principal);
                     return { ...prev, codigoCnae: principal ? principal.codigo : data.atividades[0].codigo };
                 }
                 return prev;
             });
         }
      }).catch(console.error);

    fetch('/api/clientes', { headers: { 'x-user-id': userId, 'x-empresa-id': contextId || '' } })
      .then(res => res.json())
      .then(data => setClientes(data)).catch(console.error);

    if (retryId) {
        setLoadingRetry(true);
        fetch(`/api/vendas/${retryId}`, { headers: { 'x-user-id': userId } })
            .then(async res => {
                if (res.ok) {
                    const venda = await res.json();
                    const cnaeParaUsar = venda.cnaeRecuperado || venda.notas?.[0]?.cnae || "";
                    setNfData(prev => ({
                        ...prev,
                        clienteId: venda.clienteId,
                        clienteNome: venda.cliente?.razaoSocial || "Cliente",
                        valor: venda.valor,
                        servicoDescricao: venda.descricao,
                        codigoCnae: cnaeParaUsar || prev.codigoCnae 
                    }));
                    setStep(2);
                }
            })
            .catch(() => dialog.showAlert({ type: 'danger', description: "Erro ao recuperar dados da venda." }))
            .finally(() => setLoadingRetry(false));
    }

  }, [router, retryId]);

  // === FUNÇÃO AUXILIAR DE PREENCHIMENTO ===
  const preencherFormulario = (dados: any) => {
      setNovoCliente(prev => ({
          ...prev,
          nome: dados.nome || dados.razaoSocial,
          nomeFantasia: dados.nomeFantasia || '',
          inscricaoMunicipal: dados.inscricaoMunicipal || '',
          email: dados.email || '',
          cep: dados.cep || '',
          logradouro: dados.logradouro || '',
          numero: dados.numero || '',
          bairro: dados.bairro || '',
          cidade: dados.cidade || '',
          uf: dados.uf || '',
          codigoIbge: dados.codigoIbge || ''
      }));
      setClienteEncontrado(true);
      setTimeout(() => setClienteEncontrado(false), 3000);
  };

  // === FUNÇÃO PARA BUSCAR NO BANCO GLOBAL ===
  const buscarNaBaseGlobal = async (docLimpo: string) => {
      setBuscandoDoc(true);
      try {
          const userId = localStorage.getItem('userId');
          const res = await fetch('/api/clientes/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
              body: JSON.stringify({ documento: docLimpo })
          });
          
          if (res.ok) {
              const dados = await res.json(); 
              if (dados) {
                  preencherFormulario(dados);
                  // REMOVIDO O ALERT AQUI
                  return true;
              }
          }
      } catch (e) { console.error(e); } 
      finally { setBuscandoDoc(false); }
      return false;
  };

  // === EFEITO: MONITORAR DIGITAÇÃO ===
  useEffect(() => {
    const docLimpo = novoCliente.documento.replace(/\D/g, '');
    
    if (docLimpo.length === 11 || docLimpo.length === 14) {
        // 1. Tenta achar na lista local (meus clientes)
        const local = clientes.find(c => c.documento && c.documento.replace(/\D/g, '') === docLimpo);
        if (local) {
            preencherFormulario(local);
        } else {
            // 2. Se não achar, busca no banco global
            buscarNaBaseGlobal(docLimpo);
        }
    }
  }, [novoCliente.documento, clientes]);

  // === BUSCA MANUAL (BOTÃO LUPA) ===
  const buscarDocumentoNovo = async () => {
    const docLimpo = novoCliente.documento.replace(/\D/g, '');
    
    // 1. Verifica Local
    const local = clientes.find(c => c.documento.replace(/\D/g, '') === docLimpo);
    if (local) {
        preencherFormulario(local);
        // Aqui também removi o alert para ser consistente (opcional)
        // dialog.showAlert({ type: 'info', description: 'Cliente já vinculado a você!' });
        return;
    }

    // 2. Verifica Global 
    const achouGlobal = await buscarNaBaseGlobal(docLimpo);
    if (achouGlobal) return;

    // 3. Validações e Busca Externa (Só para CNPJ)
    if(docLimpo.length === 11) {
        if(validarCPF(novoCliente.documento)) dialog.showAlert({ type: 'success', title: 'CPF Válido', description: 'Novo cadastro: preencha os dados.' });
        else dialog.showAlert({ type: 'warning', description: 'CPF Inválido.' });
        return;
    }

    if(docLimpo.length === 14) {
        setBuscandoDoc(true);
        try {
            const res = await fetch('/api/external/cnpj', { method: 'POST', body: JSON.stringify({ cnpj: docLimpo }) });
            const dados = await res.json();
            if(res.ok) {
                setNovoCliente(prev => ({ 
                    ...prev, ...dados, 
                    nome: dados.razaoSocial, nomeFantasia: dados.nomeFantasia, codigoIbge: dados.codigoIbge || ''
                }));
                dialog.showAlert({ type: 'success', description: 'Dados encontrados na Receita!' });
            } else { dialog.showAlert("CNPJ não encontrado na base pública."); }
        } catch (e) { dialog.showAlert("Erro de conexão."); }
        finally { setBuscandoDoc(false); }
        return;
    }
    dialog.showAlert("Digite um CPF ou CNPJ válido.");
  }

  const buscarCepNovo = async () => {
      const cepLimpo = novoCliente.cep.replace(/\D/g, '');
      if (cepLimpo.length !== 8) return;
      setBuscandoCep(true);
      try {
          const res = await fetch('/api/external/cep', { method: 'POST', body: JSON.stringify({ cep: cepLimpo }) });
          const dados = await res.json();
          if (res.ok) {
              setNovoCliente(prev => ({
                  ...prev, logradouro: dados.logradouro, bairro: dados.bairro, cidade: dados.localidade || dados.cidade, uf: dados.uf, codigoIbge: dados.codigoIbge
              }));
          } else { dialog.showAlert({ type: 'warning', description: 'CEP não encontrado.' }); }
      } catch (e) { console.error(e); }
      finally { setBuscandoCep(false); }
  }

  const formatarMoedaInput = (valor: string | number) => {
    const v = Number(valor) || 0;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const apenasNumeros = e.target.value.replace(/\D/g, "");
    if (!apenasNumeros) { setNfData({ ...nfData, valor: "0" }); return; }
    const valorNumerico = parseInt(apenasNumeros) / 100;
    setNfData({ ...nfData, valor: String(valorNumerico) });
  };

  const handleNext = async () => {
    if (step === 1 && modoCliente === 'novo') {
        const userId = localStorage.getItem('userId');
        const docLimpo = novoCliente.documento.replace(/\D/g, '');

        if (docLimpo.length === 11 && !validarCPF(novoCliente.documento)) {
            return dialog.showAlert({ type: 'danger', title: 'Erro', description: "CPF Inválido." });
        }
        if (!novoCliente.nome) return dialog.showAlert("Informe o Nome/Razão Social.");
        if (!novoCliente.codigoIbge) return dialog.showAlert("Informe o CEP para preencher a cidade (Obrigatório).");
        if (!novoCliente.numero) return dialog.showAlert("Informe o número do endereço.");

        setLoading(true); 
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
            } else { 
                const erro = await res.json();
                dialog.showAlert({ type: 'danger', description: erro.error || "Erro ao cadastrar cliente." }); 
            }
        } catch (e) { dialog.showAlert("Erro de conexão."); }
        finally { setLoading(false); }

    } else { setStep(step + 1); }
  };

  const handleBack = () => setStep(step - 1);
  
  const getFriendlyFeedback = (errorMsg: string) => {
      const msg = errorMsg.toLowerCase();
      if (msg.includes('certificado')) return "Certificado Digital não encontrado. Vá em Configurações.";
      if (msg.includes('cnpj') || msg.includes('cpf')) return "Documento do cliente inválido.";
      return errorMsg;
  }

  const handleEmitir = async () => {
    if (!nfData.codigoCnae) { dialog.showAlert("Selecione uma Atividade (CNAE)."); return; }
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
        await dialog.showAlert({ type: 'success', title: 'Processando', description: 'Nota enviada para autorização.' });
        router.push('/cliente/dashboard');
      } else {
        dialog.showAlert({ type: 'danger', title: 'Falha', description: getFriendlyFeedback(resposta.error || 'Erro.') });
      }
    } catch (error) { dialog.showAlert("Erro de Conexão."); } 
    finally { setLoading(false); }
  };

  const valorNumerico = parseFloat(nfData.valor) || 0;
  const isStep2Invalid = step === 2 && (valorNumerico <= 0 || !nfData.servicoDescricao.trim());

  if(loadingRetry) return <div className="h-screen flex items-center justify-center text-blue-600 font-bold"><Loader2 className="animate-spin mr-2"/> Recuperando dados...</div>;

  return (
    <div className="max-w-4xl mx-auto py-10 relative">
      
      <div className="mb-6">
        <button 
            onClick={() => router.push('/cliente/dashboard')} 
            className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition font-medium text-sm group"
        >
            <div className="p-2 bg-white rounded-full border border-slate-200 group-hover:border-blue-200 group-hover:bg-blue-50 transition">
                <Home size={18} />
            </div>
            Voltar ao Início
        </button>
      </div>

      <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800">
              {retryId ? `Corrigir Venda` : 'Emitir Nova NFS-e'}
          </h2>
          {retryId && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">MODO CORREÇÃO</span>}
      </div>

      <div className="flex justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 transform -translate-y-1/2"></div>
        {[{ id: 1, label: "Tomador", icon: Building2 }, { id: 2, label: "Serviço", icon: Calculator }, { id: 3, label: "Revisão", icon: FileCheck }].map((s) => (
          <div key={s.id} className={`flex flex-col items-center bg-slate-100 px-4 py-2 rounded-lg ${step >= s.id ? "text-blue-600" : "text-slate-400"}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${step >= s.id ? "bg-blue-600 text-white" : "bg-slate-300 text-slate-500"}`}>
              <s.icon size={20} />
            </div>
            <span className="text-sm font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Quem é o cliente?</h3>
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                <button onClick={() => setModoCliente('existente')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${modoCliente === 'existente' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
                    <Users size={16} /> Selecionar da Lista
                </button>
                <button onClick={() => setModoCliente('novo')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${modoCliente === 'novo' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>
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
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase">CPF / CNPJ</label>
                                {clienteEncontrado && (
                                    <span className="text-xs text-green-600 font-bold flex items-center gap-1 animate-pulse">
                                        <Check size={12}/> Cliente carregado da base!
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input className="w-full p-2 border rounded bg-white font-mono" placeholder="Apenas números" 
                                    value={novoCliente.documento} onChange={e => setNovoCliente({...novoCliente, documento: e.target.value})}
                                />
                                <button onClick={buscarDocumentoNovo} disabled={buscandoDoc} className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50">
                                    {buscandoDoc ? <Loader2 className="animate-spin" size={18}/> : <Search size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                                {isPJ ? <><Building size={12} className="inline"/> Razão Social</> : <><User size={12} className="inline"/> Nome Completo</>}
                            </label>
                            <input className="w-full p-2 border rounded bg-white" value={novoCliente.nome} onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})} />
                        </div>
                        {isPJ && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nome Fantasia</label>
                                <input className="w-full p-2 border rounded bg-white" value={novoCliente.nomeFantasia} onChange={e => setNovoCliente({...novoCliente, nomeFantasia: e.target.value})} />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Email</label>
                            <input type="email" className="w-full p-2 border rounded bg-white" value={novoCliente.email} onChange={e => setNovoCliente({...novoCliente, email: e.target.value})} />
                        </div>
                        <div className="md:col-span-2 bg-white p-3 rounded border border-blue-200 grid grid-cols-3 gap-3">
                            <div className="col-span-1 relative">
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">CEP</label>
                                <input placeholder="00000000" className="w-full p-2 border rounded text-sm font-bold text-blue-700" 
                                    value={novoCliente.cep} onChange={e => setNovoCliente({...novoCliente, cep: e.target.value})}
                                    onBlur={buscarCepNovo}
                                />
                                {buscandoCep && <Loader2 className="absolute right-2 top-8 animate-spin text-blue-500" size={14}/>}
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">Logradouro</label>
                                <input className="w-full p-2 border rounded bg-gray-100 text-sm" readOnly value={novoCliente.logradouro} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">Número</label>
                                <input placeholder="Nº" className="w-full p-2 border rounded text-sm" value={novoCliente.numero} onChange={e => setNovoCliente({...novoCliente, numero: e.target.value})}/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">Bairro</label>
                                <input className="w-full p-2 border rounded bg-gray-100 text-sm" readOnly value={novoCliente.bairro} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 mb-1">Cidade/UF</label>
                                <input className="w-full p-2 border rounded bg-gray-100 text-sm" readOnly value={novoCliente.cidade ? `${novoCliente.cidade}/${novoCliente.uf}` : ''} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>
        )}

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
                        {!nfData.codigoCnae && <option value="">Selecione uma atividade...</option>}
                        {meusCnaes.map(cnae => (
                            <option key={cnae.id} value={cnae.codigo}>
                                {cnae.codigo} - {cnae.descricao} {cnae.principal ? '(Principal)' : ''}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Valor (R$)</label>
              <input 
                type="text" 
                inputMode="numeric"
                className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700 text-lg font-bold" 
                value={formatarMoedaInput(nfData.valor)} 
                onChange={handleValorChange}
                placeholder="R$ 0,00"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Discriminação</label>
              <textarea 
                rows={4} 
                placeholder="Descrição detalhada do serviço prestado..." 
                className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700 resize-none" 
                value={nfData.servicoDescricao} 
                onChange={(e) => setNfData({...nfData, servicoDescricao: e.target.value})}
              ></textarea>
              {nfData.servicoDescricao.trim().length === 0 && (
                <p className="text-xs text-red-500 mt-1">* Obrigatório informar a descrição.</p>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Revisão</h3>
            <div className="bg-slate-50 p-6 rounded-lg space-y-4 border border-slate-200">
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Tomador:</span><span className="font-medium text-slate-900">{modoCliente === 'novo' ? novoCliente.nome : nfData.clienteNome}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Atividade (CNAE):</span><span className="font-medium text-slate-900">{nfData.codigoCnae}</span></div>
              <div className="flex justify-between pt-2"><span className="text-slate-500">Valor Bruto:</span><span className="font-bold text-slate-900">R$ {valorNumerico.toFixed(2)}</span></div>
            </div>
            <p className="text-xs text-center text-slate-400">Ao clicar em emitir, a nota será processada no ambiente nacional.</p>
          </div>
        )}

        <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
          {step > 1 ? (
            <button onClick={handleBack} className="flex items-center gap-2 text-slate-500 px-4 py-2 hover:bg-gray-100 rounded">
                <ArrowLeft size={18} /> Voltar
            </button>
          ) : (
            <div></div>
          )}
          
          {step < 3 ? (
            <button 
                onClick={handleNext} 
                disabled={
                    loading || 
                    (step === 1 && ((modoCliente === 'existente' && !nfData.clienteId) || (modoCliente === 'novo' && !novoCliente.nome))) ||
                    isStep2Invalid
                }
                className={`bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {loading ? <Loader2 className="animate-spin" size={18}/> : (step === 1 && modoCliente === 'novo' ? 'Cadastrar e Avançar' : 'Próximo')} <ArrowRight size={18} />
            </button>
          ) : (
            <button onClick={handleEmitir} disabled={loading} className="bg-green-600 text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700 shadow-lg disabled:opacity-50 font-bold">
                {loading ? 'Enviando...' : <><CheckCircle size={20} /> EMITIR NOTA</>}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}