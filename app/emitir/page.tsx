"use client";

import { useState, useEffect } from "react";
import { CheckCircle, ArrowRight, ArrowLeft, Building2, Calculator, FileCheck, UserPlus, Users, Search, Briefcase, Loader2, User, Building, Home, Check, Info } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDialog } from "@/app/contexts/DialogContext";
import { validarCPF } from "@/app/utils/cpf";

interface CnaeDB {
  id: string;
  codigo: string;
  descricao: string;
  principal: boolean;
  codigoNbs?: string;
  temRetencaoInss?: boolean; 
}

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
  
  const [perfilEmpresa, setPerfilEmpresa] = useState<any>(null); 

  // Controle de Regras de Negócio
  const [permiteINSS, setPermiteINSS] = useState(false);

  const [buscandoDoc, setBuscandoDoc] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState(false);

  const [novoCliente, setNovoCliente] = useState({ 
    nome: '', nomeFantasia: '', inscricaoMunicipal: '', email: '', 
    documento: '', cep: '', logradouro: '', numero: '', 
    bairro: '', cidade: '', uf: '', codigoIbge: ''
  });

  const isPJ = novoCliente.documento.replace(/\D/g, '').length > 11;

  // === DADOS DA NOTA ===
  const [nfData, setNfData] = useState({
    clienteId: "", clienteNome: "", servicoDescricao: "", valor: "", 
    codigoCnae: "", aliquota: "", issRetido: false 
  });

  // === DADOS DE RETENÇÕES ===
  const [retencoes, setRetencoes] = useState({
      inss: { retido: false, aliquota: '', base: '', valor: 0 },
      pis: { retido: false, aliquota: '0.65', valor: 0 },
      cofins: { retido: false, aliquota: '3.00', valor: 0 },
      ir: { retido: false, aliquota: '1.50', valor: 0 },
      csll: { retido: false, aliquota: '1.00', valor: 0 }
  });

  // === CÁLCULOS DE IMPOSTOS ===
  const calcularRetencao = (tipo: string, baseVal: string, aliqVal: string) => {
      const base = parseFloat(baseVal) || 0;
      const aliq = parseFloat(aliqVal) || 0;
      const valor = base * (aliq / 100);
      setRetencoes(prev => ({
          ...prev,
          [tipo]: { ...prev[tipo as keyof typeof retencoes], base: baseVal, aliquota: aliqVal, valor }
      }));
  };

  const toggleRetencao = (tipo: string) => {
      setRetencoes(prev => {
          const atual = prev[tipo as keyof typeof retencoes];
          const novoEstado = !atual.retido;
          
          if (tipo === 'inss' && novoEstado) {
              const valNota = nfData.valor || '0';
              return { ...prev, inss: { ...atual, retido: true, base: valNota, aliquota: '11.00', valor: (parseFloat(valNota) * 0.11) } };
          }
          if (novoEstado && tipo !== 'inss') {
               const valNota = parseFloat(nfData.valor) || 0;
               const aliq = parseFloat(atual.aliquota) || 0;
               return { ...prev, [tipo]: { ...atual, retido: true, valor: valNota * (aliq / 100) } };
          }

          return { ...prev, [tipo]: { ...atual, retido: novoEstado, valor: novoEstado ? atual.valor : 0 } };
      });
  };

  useEffect(() => {
      if (nfData.valor && retencoes.inss.retido) {
          calcularRetencao('inss', nfData.valor, retencoes.inss.aliquota);
      }
  }, [nfData.valor]);

  // === REGRA DE NEGÓCIO: VALIDAÇÃO DO CNAE ===
  useEffect(() => {
      if (!meusCnaes.length) return;

      const cnaeSelecionado = meusCnaes.find(c => c.codigo === nfData.codigoCnae);
      const deveReter = cnaeSelecionado?.temRetencaoInss || false;
      
      setPermiteINSS(deveReter);

      // Se o CNAE não permite, limpa a seleção
      if (!deveReter) {
          setRetencoes(prev => ({ 
              ...prev, 
              inss: { ...prev.inss, retido: false, valor: 0 } 
          }));
      }
  }, [nfData.codigoCnae, meusCnaes]);


  // === CARREGAMENTO INICIAL ===
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const contextId = localStorage.getItem('empresaContextId');
    if(!userId) { router.push('/login'); return; }

    // Perfil
    fetch('/api/perfil', { headers: { 'x-user-id': userId } })
      .then(res => res.json())
      .then(data => {
         if(data && !data.error) {
             setPerfilEmpresa(data);
             if (data.atividades && Array.isArray(data.atividades)) {
                 setMeusCnaes(data.atividades);
                 setNfData(prev => {
                     const updates: any = {};
                     if (!prev.codigoCnae && data.atividades.length > 0) {
                         const principal = data.atividades.find((c: CnaeDB) => c.principal);
                         updates.codigoCnae = principal ? principal.codigo : data.atividades[0].codigo;
                     }
                     updates.aliquota = data.regimeTributario === 'MEI' ? '0' : (data.aliquotaPadrao || '0');
                     updates.issRetido = data.issRetidoPadrao || false;
                     return { ...prev, ...updates };
                 });
             }
         }
      }).catch(console.error);

    // Clientes
    fetch('/api/clientes', { headers: { 'x-user-id': userId, 'x-empresa-id': contextId || '' } })
      .then(res => res.json())
      .then(data => {
          if (Array.isArray(data)) setClientes(data);
          else setClientes([]); 
      }).catch(() => setClientes([]));

    // Modo Retry
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
                        codigoCnae: cnaeParaUsar || prev.codigoCnae,
                        aliquota: prev.aliquota 
                    }));
                    setStep(2);
                }
            })
            .catch(() => dialog.showAlert({ type: 'danger', description: "Erro ao recuperar dados." }))
            .finally(() => setLoadingRetry(false));
    }
  }, [router, retryId]);

  // Autocomplete Cliente
  useEffect(() => {
    const docLimpo = novoCliente.documento.replace(/\D/g, '');
    if (docLimpo.length === 11 || docLimpo.length === 14) {
        const local = clientes.find(c => c.documento && c.documento.replace(/\D/g, '') === docLimpo);
        if (local) preencherFormulario(local);
        else buscarNaBaseGlobal(docLimpo);
    }
  }, [novoCliente.documento, clientes]);

  const preencherFormulario = (dados: any) => {
      setNovoCliente(prev => ({
          ...prev, nome: dados.nome || dados.razaoSocial, nomeFantasia: dados.nomeFantasia || '', inscricaoMunicipal: dados.inscricaoMunicipal || '', email: dados.email || '', cep: dados.cep || '', logradouro: dados.logradouro || '', numero: dados.numero || '', bairro: dados.bairro || '', cidade: dados.cidade || '', uf: dados.uf || '', codigoIbge: dados.codigoIbge || ''
      }));
      setClienteEncontrado(true);
      setTimeout(() => setClienteEncontrado(false), 3000);
  };

  const buscarNaBaseGlobal = async (docLimpo: string) => {
      setBuscandoDoc(true);
      try {
          const userId = localStorage.getItem('userId');
          const res = await fetch('/api/clientes/check', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' }, body: JSON.stringify({ documento: docLimpo }) });
          if (res.ok) { const dados = await res.json(); if (dados) { preencherFormulario(dados); return true; } }
      } catch (e) { console.error(e); } finally { setBuscandoDoc(false); }
      return false;
  };

  const buscarDocumentoNovo = async () => {
    const docLimpo = novoCliente.documento.replace(/\D/g, '');
    const local = clientes.find(c => c.documento.replace(/\D/g, '') === docLimpo);
    if (local) { preencherFormulario(local); return; }
    
    if(docLimpo.length === 11) {
        if(validarCPF(novoCliente.documento)) dialog.showAlert({ type: 'success', title: 'CPF Válido', description: 'Preencha os dados.' });
        else dialog.showAlert({ type: 'warning', description: 'CPF Inválido.' });
        return;
    }
    if(docLimpo.length === 14) {
        setBuscandoDoc(true);
        try {
            const res = await fetch('/api/external/cnpj', { method: 'POST', body: JSON.stringify({ cnpj: docLimpo }) });
            const dados = await res.json();
            if(res.ok) {
                setNovoCliente(prev => ({ ...prev, ...dados, nome: dados.razaoSocial, nomeFantasia: dados.nomeFantasia, codigoIbge: dados.codigoIbge || '' }));
                dialog.showAlert({ type: 'success', description: 'Dados encontrados!' });
            } else { dialog.showAlert("CNPJ não encontrado."); }
        } catch (e) { dialog.showAlert("Erro de conexão."); } finally { setBuscandoDoc(false); }
        return;
    }
    dialog.showAlert("Documento inválido.");
  }

  const buscarCepNovo = async () => {
      const cepLimpo = novoCliente.cep.replace(/\D/g, '');
      if (cepLimpo.length !== 8) return;
      setBuscandoCep(true);
      try {
          const res = await fetch('/api/external/cep', { method: 'POST', body: JSON.stringify({ cep: cepLimpo }) });
          const dados = await res.json();
          if (res.ok) { setNovoCliente(prev => ({ ...prev, logradouro: dados.logradouro, bairro: dados.bairro, cidade: dados.localidade || dados.cidade, uf: dados.uf, codigoIbge: dados.codigoIbge })); } 
          else { dialog.showAlert({ type: 'warning', description: 'CEP não encontrado.' }); }
      } catch (e) { console.error(e); } finally { setBuscandoCep(false); }
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
        if (docLimpo.length === 11 && !validarCPF(novoCliente.documento)) return dialog.showAlert({ type: 'danger', title: 'Erro', description: "CPF Inválido." });
        if (!novoCliente.nome) return dialog.showAlert("Informe o Nome/Razão Social.");
        
        setLoading(true); 
        try {
            const res = await fetch('/api/clientes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' }, body: JSON.stringify(novoCliente) });
            if (res.ok) {
                const criado = await res.json();
                setNfData({ ...nfData, clienteId: criado.id, clienteNome: criado.nome });
                setStep(step + 1);
            } else { const erro = await res.json(); dialog.showAlert({ type: 'danger', description: erro.error || "Erro ao cadastrar." }); }
        } catch (e) { dialog.showAlert("Erro de conexão."); } finally { setLoading(false); }
    } else { setStep(step + 1); }
  };

  const handleBack = () => setStep(step - 1);

  const handleEmitir = async () => {
    if (!nfData.codigoCnae) { dialog.showAlert("Selecione uma Atividade (CNAE)."); return; }
    setLoading(true);
    const userId = localStorage.getItem('userId');
    try {
      
      const payloadRetencoes = {
          inss: retencoes.inss.retido ? { retido: true, valor: retencoes.inss.valor, aliquota: parseFloat(retencoes.inss.aliquota) } : null,
          pis: retencoes.pis.retido ? { retido: true, valor: retencoes.pis.valor } : null,
          cofins: retencoes.cofins.retido ? { retido: true, valor: retencoes.cofins.valor } : null,
          ir: retencoes.ir.retido ? { retido: true, valor: retencoes.ir.valor } : null,
          csll: retencoes.csll.retido ? { retido: true, valor: retencoes.csll.valor } : null,
      };

      const res = await fetch('/api/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
        body: JSON.stringify({
          clienteId: nfData.clienteId,
          valor: nfData.valor,
          descricao: nfData.servicoDescricao,
          codigoCnae: nfData.codigoCnae,
          aliquota: nfData.aliquota,
          issRetido: nfData.issRetido,
          retencoes: payloadRetencoes
        })
      });
      const resposta = await res.json();
      if (res.ok) {
        await dialog.showAlert({ type: 'success', title: 'Processando', description: 'Nota enviada para autorização.' });
        router.push('/cliente/dashboard');
      } else {
        dialog.showAlert({ type: 'danger', title: 'Falha', description: resposta.error || 'Erro.' });
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
        <button onClick={() => router.push('/cliente/dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition font-medium text-sm group">
            <div className="p-2 bg-white rounded-full border border-slate-200 group-hover:border-blue-200 group-hover:bg-blue-50 transition"><Home size={18} /></div> Voltar ao Início
        </button>
      </div>

      <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800">{retryId ? `Corrigir Venda` : 'Emitir Nova NFS-e'}</h2>
          {retryId && <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">MODO CORREÇÃO</span>}
      </div>

      <div className="flex justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 transform -translate-y-1/2"></div>
        {[{ id: 1, label: "Tomador", icon: Building2 }, { id: 2, label: "Serviço", icon: Calculator }, { id: 3, label: "Revisão", icon: FileCheck }].map((s) => (
          <div key={s.id} className={`flex flex-col items-center bg-slate-100 px-4 py-2 rounded-lg ${step >= s.id ? "text-blue-600" : "text-slate-400"}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${step >= s.id ? "bg-blue-600 text-white" : "bg-slate-300 text-slate-500"}`}><s.icon size={20} /></div>
            <span className="text-sm font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Quem é o cliente?</h3>
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                <button onClick={() => setModoCliente('existente')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${modoCliente === 'existente' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><Users size={16} /> Selecionar da Lista</button>
                <button onClick={() => setModoCliente('novo')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${modoCliente === 'novo' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}><UserPlus size={16} /> Cadastrar Novo</button>
            </div>

            {modoCliente === 'existente' ? (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Selecione o Cliente</label>
                    <select className="w-full p-3 border rounded-lg bg-slate-50 outline-blue-500 text-slate-700" value={nfData.clienteId} onChange={(e) => { const selected = clientes.find(c => c.id === e.target.value); setNfData({ ...nfData, clienteId: e.target.value, clienteNome: selected?.nome || "" }); }}>
                        <option value="">Selecione...</option>
                        {clientes.map(cliente => (<option key={cliente.id} value={cliente.id}>{cliente.nome} ({cliente.documento})</option>))}
                    </select>
                </div>
            ) : (
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase">CPF / CNPJ</label>
                                {clienteEncontrado && <span className="text-xs text-green-600 font-bold flex items-center gap-1 animate-pulse"><Check size={12}/> Cliente carregado da base!</span>}
                            </div>
                            <div className="flex gap-2">
                                <input className="w-full p-2 border rounded bg-white font-mono" placeholder="Apenas números" value={novoCliente.documento} onChange={e => setNovoCliente({...novoCliente, documento: e.target.value})} />
                                <button onClick={buscarDocumentoNovo} disabled={buscandoDoc} className="bg-blue-600 text-white px-4 rounded hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50">{buscandoDoc ? <Loader2 className="animate-spin" size={18}/> : <Search size={18} />}</button>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{isPJ ? 'Razão Social' : 'Nome Completo'}</label>
                            <input className="w-full p-2 border rounded bg-white" value={novoCliente.nome} onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})} />
                        </div>
                        {isPJ && (<div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nome Fantasia</label><input className="w-full p-2 border rounded bg-white" value={novoCliente.nomeFantasia} onChange={e => setNovoCliente({...novoCliente, nomeFantasia: e.target.value})} /></div>)}
                        <div><label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Email</label><input type="email" className="w-full p-2 border rounded bg-white" value={novoCliente.email} onChange={e => setNovoCliente({...novoCliente, email: e.target.value})} /></div>
                        <div className="md:col-span-2 bg-white p-3 rounded border border-blue-200 grid grid-cols-3 gap-3">
                            <div className="col-span-1 relative"><label className="block text-[10px] font-bold text-slate-400 mb-1">CEP</label><input placeholder="00000000" className="w-full p-2 border rounded text-sm font-bold text-blue-700" value={novoCliente.cep} onChange={e => setNovoCliente({...novoCliente, cep: e.target.value})} onBlur={buscarCepNovo} />{buscandoCep && <Loader2 className="absolute right-2 top-8 animate-spin text-blue-500" size={14}/>}</div>
                            <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-400 mb-1">Logradouro</label><input className="w-full p-2 border rounded bg-gray-100 text-sm" readOnly value={novoCliente.logradouro} /></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 mb-1">Número</label><input placeholder="Nº" className="w-full p-2 border rounded text-sm" value={novoCliente.numero} onChange={e => setNovoCliente({...novoCliente, numero: e.target.value})}/></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 mb-1">Bairro</label><input className="w-full p-2 border rounded bg-gray-100 text-sm" readOnly value={novoCliente.bairro} /></div>
                            <div><label className="block text-[10px] font-bold text-slate-400 mb-1">Cidade/UF</label><input className="w-full p-2 border rounded bg-gray-100 text-sm" readOnly value={novoCliente.cidade ? `${novoCliente.cidade}/${novoCliente.uf}` : ''} /></div>
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
                <label className="block text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2"><Briefcase size={18} /> Atividade Econômica (CNAE)</label>
                {meusCnaes.length === 0 ? <div className="text-sm text-red-600">⚠️ Sem atividades cadastradas. Configure sua empresa.</div> : (
                    <select className="w-full p-3 border rounded-lg bg-white outline-blue-500 text-slate-700" value={nfData.codigoCnae} onChange={(e) => setNfData({...nfData, codigoCnae: e.target.value})}>
                        {!nfData.codigoCnae && <option value="">Selecione uma atividade...</option>}
                        {meusCnaes.map(cnae => (<option key={cnae.id} value={cnae.codigo}>{cnae.codigo} - {cnae.descricao} {cnae.principal ? '(Principal)' : ''}</option>))}
                    </select>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Valor (R$)</label>
                  <input type="text" inputMode="numeric" className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700 text-lg font-bold" value={formatarMoedaInput(nfData.valor)} onChange={handleValorChange} placeholder="R$ 0,00" />
                </div>

                {perfilEmpresa?.regimeTributario !== 'MEI' && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Alíquota ISS (%)</label>
                        <input type="number" className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700" value={nfData.aliquota} onChange={e => setNfData({...nfData, aliquota: e.target.value})} placeholder="Ex: 5.00" />
                    </div>
                )}
            </div>
            
            {/* === ÁREA DE IMPOSTOS E RETENÇÕES (Lógica Dinâmica) === */}
            {perfilEmpresa?.regimeTributario !== 'MEI' && (
                <div className="mt-6 border-t pt-4">
                    <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <Calculator size={16}/> Retenções e Impostos
                    </h4>

                    {/* 1. ISS RETIDO (SN e LP) */}
                    <div className="mb-4 bg-slate-50 p-3 rounded border">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={nfData.issRetido} onChange={e => setNfData({...nfData, issRetido: e.target.checked})} />
                            <span className="text-sm text-slate-700 font-medium">ISS Retido pelo Tomador?</span>
                        </label>
                    </div>

                    {/* 2. INSS (Condicionado ao CNAE) */}
                    {permiteINSS && (
                        <div className="bg-slate-50 p-3 rounded border mb-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={retencoes.inss.retido} onChange={() => toggleRetencao('inss')} />
                                    <span className="text-sm font-bold text-slate-700">Reter INSS?</span>
                                </label>
                            </div>
                            
                            {retencoes.inss.retido && (
                                <div className="grid grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <label className="block text-[10px] text-slate-500 uppercase font-bold">Base Cálculo</label>
                                        <input className="w-full p-2 border rounded text-sm bg-white" value={retencoes.inss.base} onChange={e => calcularRetencao('inss', e.target.value, retencoes.inss.aliquota)} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-500 uppercase font-bold">Alíquota (%)</label>
                                        <input type="number" className="w-full p-2 border rounded text-sm bg-white" value={retencoes.inss.aliquota} onChange={e => calcularRetencao('inss', retencoes.inss.base, e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-500 uppercase font-bold">Valor Retido</label>
                                        <div className="w-full p-2 border rounded text-sm bg-gray-200 text-slate-700 font-bold border-gray-300">R$ {retencoes.inss.valor.toFixed(2)}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 3. IMPOSTOS FEDERAIS (Só Lucro Presumido/Real) */}
                    {['LUCRO_PRESUMIDO', 'LUCRO_REAL'].includes(perfilEmpresa?.regimeTributario) && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {['pis', 'cofins', 'csll', 'ir'].map(imposto => (
                                <label key={imposto} className={`flex flex-col p-3 border rounded cursor-pointer transition ${retencoes[imposto as keyof typeof retencoes].retido ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-slate-50'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={retencoes[imposto as keyof typeof retencoes].retido} onChange={() => toggleRetencao(imposto)} />
                                        <span className="text-xs font-bold uppercase">{imposto}</span>
                                    </div>
                                    {retencoes[imposto as keyof typeof retencoes].retido && (
                                        <div className="text-xs text-blue-700">
                                            Aliq: <strong>{retencoes[imposto as keyof typeof retencoes].aliquota}%</strong><br/>
                                            R$ {retencoes[imposto as keyof typeof retencoes].valor.toFixed(2)}
                                        </div>
                                    )}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Discriminação</label>
              <textarea rows={4} placeholder="Descrição detalhada do serviço prestado..." className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700 resize-none" value={nfData.servicoDescricao} onChange={(e) => setNfData({...nfData, servicoDescricao: e.target.value})}></textarea>
              {nfData.servicoDescricao.trim().length === 0 && <p className="text-xs text-red-500 mt-1">* Obrigatório informar a descrição.</p>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Revisão</h3>
            <div className="bg-slate-50 p-6 rounded-lg space-y-4 border border-slate-200">
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Tomador:</span><span className="font-medium text-slate-900">{modoCliente === 'novo' ? novoCliente.nome : nfData.clienteNome}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Atividade (CNAE):</span><span className="font-medium text-slate-900">{nfData.codigoCnae}</span></div>
              
              {/* Exibição Condicional na Revisão */}
              {perfilEmpresa?.regimeTributario !== 'MEI' && (
                  <>
                    <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Alíquota ISS:</span><span className="font-medium text-slate-900">{nfData.aliquota}% {nfData.issRetido ? '(Retido)' : ''}</span></div>
                    {Object.entries(retencoes).map(([key, data]) => data.retido && (
                        <div key={key} className="flex justify-between border-b pb-2 text-red-600 text-sm">
                            <span className="uppercase">Retenção {key}:</span><span>- R$ {data.valor.toFixed(2)}</span>
                        </div>
                    ))}
                  </>
              )}

              <div className="flex justify-between pt-2"><span className="text-slate-500">Valor Bruto:</span><span className="font-bold text-slate-900">R$ {valorNumerico.toFixed(2)}</span></div>
            </div>
            <p className="text-xs text-center text-slate-400">Ao clicar em emitir, a nota será processada no ambiente nacional.</p>
          </div>
        )}

        <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
          <div>
            {step > 1 && (
                <button onClick={handleBack} className="flex items-center gap-2 text-slate-500 px-4 py-2 hover:bg-gray-100 rounded">
                    <ArrowLeft size={18} /> Voltar
                </button>
            )}
          </div>
          
          <div>
            {step < 3 ? (
                <button onClick={handleNext} disabled={loading || (step === 1 && ((modoCliente === 'existente' && !nfData.clienteId) || (modoCliente === 'novo' && !novoCliente.nome))) || isStep2Invalid} className={`bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`}>
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
    </div>
  );
}
