"use client";

import { useState, useEffect, Suspense } from "react";
import { CheckCircle, ArrowRight, ArrowLeft, Building2, Calculator, FileCheck, Briefcase, Loader2, Home, UserPlus, AlertTriangle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDialog } from "@/app/contexts/DialogContext";
import Link from "next/link";

interface CnaeDB {
  id: string;
  codigo: string;
  descricao: string;
  principal: boolean;
  codigoNbs?: string;
  temRetencaoInss?: boolean; 
  retemCrsf?: boolean;
  aliquotaCrsf?: number;
  retemIr?: boolean;
  aliquotaIr?: number;
  aliquotaIss?: number;
}

interface ClienteDB {
  id: string;
  nome: string;
  documento: string;
  email?: string;
  tipo: string;  
  moeda?: string;
}

function EmitirNotaContent() {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  const retryId = searchParams.get('retry');
  const dialog = useDialog(); 

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingRetry, setLoadingRetry] = useState(false);
  
  const [progressStatus, setProgressStatus] = useState("Iniciando...");
  const [progressPercent, setProgressPercent] = useState(0);
  
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [meusCnaes, setMeusCnaes] = useState<CnaeDB[]>([]);
  
  const [perfilEmpresa, setPerfilEmpresa] = useState<any>(null); 
  const [wasAboveThreshold, setWasAboveThreshold] = useState(false);

  const [nfData, setNfData] = useState({
    clienteId: "", 
    clienteNome: "", 
    servicoDescricao: "", 
    valor: "",
    valorMoedaEstrangeira: "", 
    codigoCnae: "", 
    aliquota: "", 
    issRetido: false 
  });

  // Estado das retenções agora guarda os números formatados como string (sem a trava do checkbox)
  const [retencoes, setRetencoes] = useState({
      inss: { aliquota: '0.00', valor: '0.00' },
      pis: { aliquota: '0.00', valor: '0.00' },
      cofins: { aliquota: '0.00', valor: '0.00' },
      csll: { aliquota: '0.00', valor: '0.00' },
      ir: { aliquota: '0.00', valor: '0.00' }
  });

  // === TRATAMENTO DE ERROS ===
  const tratarErroEmissao = async (respostaErro: any) => {
      if (respostaErro.userAction) {
          const actionText = respostaErro.userAction;

          if (actionText.includes("Certificado Digital") || actionText.includes("Cadastro incompleto")) {
              const irConfig = await dialog.showConfirm({ type: 'danger', title: 'Atenção ao Cadastro', description: actionText, confirmText: 'Ir para Configurações', cancelText: 'Mais tarde' });
              if (irConfig) router.push('/configuracoes');
              return;
          }

          if (actionText.includes("Inscrição Municipal")) {
              const irConfig = await dialog.showConfirm({ type: 'danger', title: 'Inscrição Municipal (I.M)', description: actionText, confirmText: 'Atualizar I.M Agora', cancelText: 'Mais tarde' });
              if (irConfig) router.push('/configuracoes');
              return;
          }

          if (actionText.includes("número de DPS")) {
               await dialog.showAlert({ type: 'warning', title: 'Numeração Duplicada', description: actionText });
              router.push('/cliente/dashboard');
              return;
          }
      }

      let msgTecnica = "";
      if (Array.isArray(respostaErro.details)) {
          msgTecnica = respostaErro.details.map((d: any) => d.mensagem || JSON.stringify(d)).join('. ');
      } else if (typeof respostaErro.details === 'string') {
          msgTecnica = respostaErro.details;
      } else {
          msgTecnica = respostaErro.error || "Erro desconhecido ao comunicar com a Prefeitura.";
      }

      await dialog.showAlert({ type: 'danger', title: 'Falha na Emissão', description: `Houve uma rejeição na Prefeitura: ${msgTecnica}` });
      router.push('/cliente/dashboard');
  };

  // === FORMATADORES DE MOEDA E PORCENTAGEM ===
  const formatarMoedaInput = (valor: string | number) => {
    const v = Number(valor) || 0;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);
  };

  const formatarMoedaEstrangeiraInput = (valor: string | number, moeda: string = 'USD') => {
    const v = Number(valor) || 0;
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: moeda, minimumFractionDigits: 2 }).format(v);
    } catch (e) {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);
    }
  };

  const formatarPorcentagem = (inputValue: string) => {
      const apenasNumeros = inputValue.replace(/\D/g, "");
      if (!apenasNumeros) return "0.00";
      return (parseInt(apenasNumeros) / 100).toFixed(2);
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const apenasNumeros = e.target.value.replace(/\D/g, "");
    if (!apenasNumeros) { setNfData({ ...nfData, valor: "0" }); return; }
    const valorNumerico = parseInt(apenasNumeros) / 100;
    setNfData({ ...nfData, valor: String(valorNumerico) });
  };

  const handleValorEstrangeiroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const apenasNumeros = e.target.value.replace(/\D/g, "");
    if (!apenasNumeros) { setNfData({ ...nfData, valorMoedaEstrangeira: "0" }); return; }
    const valorNumerico = parseInt(apenasNumeros) / 100;
    setNfData({ ...nfData, valorMoedaEstrangeira: String(valorNumerico) });
  };

  // === HANDLERS LIVRES PARA O USUÁRIO EDITAR RETENÇÕES ===
  const handleAliquotaRetencaoChange = (imposto: string, inputValue: string) => {
      const novaAliquota = formatarPorcentagem(inputValue);
      setRetencoes(prev => {
          const valorNota = parseFloat(nfData.valor) || 0;
          return {
              ...prev,
              [imposto]: { 
                  aliquota: novaAliquota, 
                  valor: (valorNota * (parseFloat(novaAliquota) / 100)).toFixed(2) 
              }
          };
      });
  };

  const handleValorRetencaoChange = (imposto: string, inputValue: string) => {
      const apenasNumeros = inputValue.replace(/\D/g, "");
      const novoValorStr = apenasNumeros ? (parseInt(apenasNumeros) / 100).toFixed(2) : "0.00";
      setRetencoes(prev => ({
          ...prev,
          [imposto]: { 
              ...prev[imposto as keyof typeof prev], 
              valor: novoValorStr 
          }
      }));
  };

  // === INTELIGÊNCIA CEREBRAL (Cálculo Automático) ===
  
  // 1. Dispara ao selecionar o Cliente ou o CNAE (Define o Padrão do Painel Admin)
  useEffect(() => {
      const cliente = clientes.find(c => c.id === nfData.clienteId);
      const cnae = meusCnaes.find(c => c.codigo === nfData.codigoCnae);
      const valorFloat = parseFloat(nfData.valor) || 0;

      // Se for PF ou Exterior, esvazia tudo
      if (!cliente || !cnae || cliente.tipo === 'PF' || cliente.tipo === 'EXT') {
          setRetencoes({
              inss: { aliquota: '0.00', valor: '0.00' },
              pis: { aliquota: '0.00', valor: '0.00' },
              cofins: { aliquota: '0.00', valor: '0.00' },
              csll: { aliquota: '0.00', valor: '0.00' },
              ir: { aliquota: '0.00', valor: '0.00' }
          });
          if (cliente?.tipo === 'PF' || cliente?.tipo === 'EXT') {
              setNfData(prev => ({ ...prev, issRetido: false }));
          }
          return;
      }

      // Se for PJ e Lucro, monta a sugestão base
      if (cliente.tipo === 'PJ' && ['LUCRO_PRESUMIDO', 'LUCRO_REAL'].includes(perfilEmpresa?.regimeTributario)) {
          const isAbove = valorFloat > 215.05;
          const next = {
              inss: { aliquota: '0.00', valor: '0.00' },
              pis: { aliquota: '0.00', valor: '0.00' },
              cofins: { aliquota: '0.00', valor: '0.00' },
              csll: { aliquota: '0.00', valor: '0.00' },
              ir: { aliquota: '0.00', valor: '0.00' }
          };

          if (cnae.temRetencaoInss) next.inss.aliquota = '11.00';
          if (cnae.retemIr) next.ir.aliquota = cnae.aliquotaIr ? Number(cnae.aliquotaIr).toFixed(2) : '1.50';

          if (cnae.retemCrsf && isAbove) {
              next.pis.aliquota = cnae.aliquotaCrsf ? (cnae.aliquotaCrsf * (0.65/4.65)).toFixed(2) : '0.65';
              next.cofins.aliquota = cnae.aliquotaCrsf ? (cnae.aliquotaCrsf * (3.00/4.65)).toFixed(2) : '3.00';
              next.csll.aliquota = cnae.aliquotaCrsf ? (cnae.aliquotaCrsf * (1.00/4.65)).toFixed(2) : '1.00';
          }

          // Calcula os valores em R$ com as alíquotas definidas
          ['inss', 'pis', 'cofins', 'csll', 'ir'].forEach(key => {
              const k = key as keyof typeof next;
              next[k].valor = (valorFloat * (parseFloat(next[k].aliquota) / 100)).toFixed(2);
          });

          setRetencoes(next);
          setWasAboveThreshold(isAbove);
      }
  }, [nfData.codigoCnae, nfData.clienteId]);

  // 2. Dispara quando o Valor Bruto (R$) muda
  useEffect(() => {
      const cliente = clientes.find(c => c.id === nfData.clienteId);
      const cnae = meusCnaes.find(c => c.codigo === nfData.codigoCnae);
      const valorFloat = parseFloat(nfData.valor) || 0;
      const isAbove = valorFloat > 215.05;

      if (!cliente || !cnae || cliente.tipo === 'PF' || cliente.tipo === 'EXT') return;

      setRetencoes(prev => {
          const next = JSON.parse(JSON.stringify(prev)); // Copia limpa do estado atual
          
          // Verifica a regra da Receita (Se cruzou a linha de 215,05 liga ou desliga sozinho)
          if (cnae.retemCrsf && isAbove !== wasAboveThreshold) {
              if (isAbove) {
                  next.pis.aliquota = cnae.aliquotaCrsf ? (cnae.aliquotaCrsf * (0.65/4.65)).toFixed(2) : '0.65';
                  next.cofins.aliquota = cnae.aliquotaCrsf ? (cnae.aliquotaCrsf * (3.00/4.65)).toFixed(2) : '3.00';
                  next.csll.aliquota = cnae.aliquotaCrsf ? (cnae.aliquotaCrsf * (1.00/4.65)).toFixed(2) : '1.00';
              } else {
                  next.pis.aliquota = '0.00';
                  next.cofins.aliquota = '0.00';
                  next.csll.aliquota = '0.00';
              }
              setWasAboveThreshold(isAbove);
          }

          // Recalcula todos os valores baseados na alíquota visível na tela
          ['inss', 'pis', 'cofins', 'csll', 'ir'].forEach(key => {
              const k = key as keyof typeof next;
              next[k].valor = (valorFloat * (parseFloat(next[k].aliquota) / 100)).toFixed(2);
          });

          return next;
      });
  }, [nfData.valor]);


  // === CARREGAMENTO INICIAL ===
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    const contextId = localStorage.getItem('empresaContextId');
    if(!userId || !token) { router.push('/login'); return; }

    fetch('/api/perfil', { headers: { 'x-user-id': userId, 'Authorization': `Bearer ${token}`, 'x-empresa-id': contextId || '' } })
      .then(res => res.json())
      .then(data => {
         if(data && !data.error) {
             setPerfilEmpresa(data);
             if (data.atividades && Array.isArray(data.atividades)) {
                 setMeusCnaes(data.atividades);
                 setNfData(prev => {
                     const updates: any = {};
                     let cnaePrincipalObj = null;

                     if (!prev.codigoCnae && data.atividades.length > 0) {
                         cnaePrincipalObj = data.atividades.find((c: CnaeDB) => c.principal) || data.atividades[0];
                         updates.codigoCnae = cnaePrincipalObj.codigo;
                     } else {
                         cnaePrincipalObj = data.atividades.find((c: CnaeDB) => c.codigo === prev.codigoCnae);
                     }

                     let aliquotaSugerida = '0.00';
                     if (data.regimeTributario !== 'MEI') {
                         // 1. Tenta pegar a alíquota específica do CNAE no Município
                         if (cnaePrincipalObj && cnaePrincipalObj.aliquotaIss !== null && cnaePrincipalObj.aliquotaIss !== undefined) {
                             aliquotaSugerida = Number(cnaePrincipalObj.aliquotaIss).toFixed(2);
                         // 2. Fallback para a alíquota padrão da Empresa
                         } else if (data.aliquotaPadrao !== null && data.aliquotaPadrao !== undefined) {
                             aliquotaSugerida = Number(data.aliquotaPadrao).toFixed(2);
                         } else {
                             aliquotaSugerida = '3.00'; // Fallback final
                         }
                     }

                     updates.aliquota = aliquotaSugerida;
                     updates.issRetido = data.issRetidoPadrao || false;
                     return { ...prev, ...updates };
                 });
             }
         }
      }).catch(console.error);

    fetch('/api/clientes', { headers: { 'x-user-id': userId, 'x-empresa-id': contextId || '', 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setClientes(data); }).catch(() => setClientes([]));

    if (retryId) {
        setLoadingRetry(true);
        fetch(`/api/vendas/${retryId}`, { 
            headers: { 
                'x-user-id': userId, 
                'Authorization': `Bearer ${token}`,
                'x-empresa-id': contextId || '' // <--- A CORREÇÃO PRINCIPAL ESTÁ AQUI
            } 
        })
            .then(async res => {
                if (res.ok) {
                    const venda = await res.json();
                    const cnaeParaUsar = venda.cnaeRecuperado || venda.notas?.[0]?.cnae || "";
                    setNfData(prev => ({
                        ...prev,
                        clienteId: venda.clienteId, 
                        clienteNome: venda.cliente?.razaoSocial || venda.cliente?.nome || "Cliente", 
                        valor: String(venda.valor), // Garante que é lido como string
                        servicoDescricao: venda.descricao,
                        codigoCnae: cnaeParaUsar || prev.codigoCnae
                    }));
                    setStep(2); // Avança para o Passo 2 automaticamente!
                } else {
                    // Impede de falhar silenciosamente se der erro de permissão
                    const erro = await res.json();
                    dialog.showAlert({ type: 'danger', description: erro.error || "Erro ao recuperar dados da venda." });
                }
            })
            .catch(() => dialog.showAlert({ type: 'danger', description: "Erro de conexão ao recuperar dados." }))
            .finally(() => setLoadingRetry(false));
    }
  }, [router, retryId]);

  const handleNext = async () => {
    if (step === 1) {
        if (!nfData.clienteId) return dialog.showAlert("Selecione um cliente para continuar.");
        setStep(step + 1);
    } else { 
        setStep(step + 1); 
    }
  };

  const handleBack = () => setStep(step - 1);

  const handleEmitir = async () => {
    if (!nfData.codigoCnae) { dialog.showAlert("Selecione uma Atividade (CNAE)."); return; }
    
    setLoading(true);
    setProgressPercent(10);
    setProgressStatus("Preparando envio...");

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('token');
    const contextId = localStorage.getItem('empresaContextId'); 
    
    try {
      // Monta as retenções dinamicamente. Se o valor for > 0, manda "retido: true".
      const payloadRetencoes = {
          inss: parseFloat(retencoes.inss.valor) > 0 ? { retido: true, valor: parseFloat(retencoes.inss.valor), aliquota: parseFloat(retencoes.inss.aliquota) } : null,
          pis: parseFloat(retencoes.pis.valor) > 0 ? { retido: true, valor: parseFloat(retencoes.pis.valor), aliquota: parseFloat(retencoes.pis.aliquota) } : null,
          cofins: parseFloat(retencoes.cofins.valor) > 0 ? { retido: true, valor: parseFloat(retencoes.cofins.valor), aliquota: parseFloat(retencoes.cofins.aliquota) } : null,
          ir: parseFloat(retencoes.ir.valor) > 0 ? { retido: true, valor: parseFloat(retencoes.ir.valor), aliquota: parseFloat(retencoes.ir.aliquota) } : null,
          csll: parseFloat(retencoes.csll.valor) > 0 ? { retido: true, valor: parseFloat(retencoes.csll.valor), aliquota: parseFloat(retencoes.csll.aliquota) } : null,
      };

      setProgressPercent(40);
      setProgressStatus("Transmitindo para o Portal Nacional...");

      const res = await fetch('/api/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '', 'Authorization': `Bearer ${token}`, 'x-empresa-id': contextId || '' },
        body: JSON.stringify({
          vendaId: retryId, // <--- A CORREÇÃO ESTÁ AQUI (Avisa o backend para ATUALIZAR)
          clienteId: nfData.clienteId,
          valor: nfData.valor,
          valorMoedaEstrangeira: nfData.valorMoedaEstrangeira,
          descricao: nfData.servicoDescricao,
          codigoCnae: nfData.codigoCnae,
          aliquota: nfData.aliquota,
          issRetido: nfData.issRetido,
          retencoes: payloadRetencoes
        })
      });

      const resposta = await res.json();
      
      if (res.ok) {
        setProgressPercent(100);
        setProgressStatus("Concluído!");

        if (resposta.isHomologation) {
            const irConfig = await dialog.showConfirm({ type: 'success', title: 'Tudo certo em Homologação!', description: 'As configurações da sua nota estão perfeitas. Mude para PRODUÇÃO nas configurações.', confirmText: 'Mudar para Produção', cancelText: 'Voltar ao Início' });
            if (irConfig) router.push('/configuracoes');
            else router.push('/cliente/dashboard');
        } else {
            await dialog.showAlert({ type: 'success', title: 'Sucesso Total!', description: 'Nota emitida e autorizada na Prefeitura.' });
            router.push('/cliente/dashboard');
        }
      } else {
        await tratarErroEmissao(resposta);
      }
    } catch (error) { 
        dialog.showAlert("Erro de Conexão. Verifique sua internet."); 
        router.push('/cliente/dashboard');
    } 
    finally { setLoading(false); }
  };

  const clienteSel = clientes.find(c => c.id === nfData.clienteId);
  const isExterior = clienteSel?.tipo === 'EXT';
  const isPF = clienteSel?.tipo === 'PF';
  const isPJ = clienteSel?.tipo === 'PJ';
  
  // Oculta completamente a tabela de impostos federais se for PF ou Exterior
  const mostraRetencoesFederais = isPJ && !isPF && !isExterior && ['LUCRO_PRESUMIDO', 'LUCRO_REAL'].includes(perfilEmpresa?.regimeTributario);
  
  const cnaeSelecionadoObj = meusCnaes.find(c => c.codigo === nfData.codigoCnae);

  const valorNumerico = parseFloat(nfData.valor) || 0;
  const valorEstrangeiroNum = parseFloat(nfData.valorMoedaEstrangeira) || 0;
  const isStep2Invalid = step === 2 && (valorNumerico <= 0 || !nfData.servicoDescricao.trim() || (isExterior && valorEstrangeiroNum <= 0));

  const cnaeDescricaoCurta = cnaeSelecionadoObj?.descricao ? (cnaeSelecionadoObj.descricao.length > 20 ? cnaeSelecionadoObj.descricao.substring(0, 20) + '...' : cnaeSelecionadoObj.descricao) : '';

  const totalRetido = Object.values(retencoes).reduce((acc, curr) => acc + parseFloat(curr.valor), 0);
  const valorLiquido = valorNumerico - (nfData.issRetido ? (valorNumerico * (parseFloat(nfData.aliquota)/100)) : 0) - totalRetido;

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
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-slate-700">Quem é o cliente?</h3>
                <Link href="/cliente" className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1"><UserPlus size={16}/> Cadastrar Novo Cliente</Link>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Selecione o Tomador (Cliente)</label>
                {clientes.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                        <p className="text-slate-500 mb-2">Nenhum cliente encontrado.</p>
                        <Link href="/cliente" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold inline-block hover:bg-blue-700">Cadastrar Primeiro Cliente</Link>
                    </div>
                ) : (
                    <select className="w-full p-3 border rounded-lg bg-slate-50 outline-blue-500 text-slate-700 font-medium" value={nfData.clienteId} onChange={(e) => { const selected = clientes.find(c => c.id === e.target.value); setNfData({ ...nfData, clienteId: e.target.value, clienteNome: selected?.nome || "" }); }}>
                        <option value="">-- Selecione na lista --</option>
                        {clientes.map(cliente => (<option key={cliente.id} value={cliente.id}>{cliente.nome} ({cliente.documento || 'Exterior'})</option>))}
                    </select>
                )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Detalhes do Serviço</h3>
            
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <label className="block text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2"><Briefcase size={18} /> Atividade Econômica (CNAE)</label>
                <select className="w-full p-3 border rounded-lg bg-white outline-blue-500 text-slate-700" value={nfData.codigoCnae} onChange={(e) => setNfData({...nfData, codigoCnae: e.target.value})}>
                    {!nfData.codigoCnae && <option value="">Selecione uma atividade...</option>}
                    {meusCnaes.map(cnae => (<option key={cnae.id} value={cnae.codigo}>{cnae.codigo} - {cnae.descricao}</option>))}
                </select>
            </div>

            {isExterior ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <div>
                        <label className="block text-sm font-medium text-purple-900 mb-2">Valor Faturado ({clienteSel?.moeda || 'USD'})</label>
                        <input type="text" inputMode="numeric" className="w-full p-3 border border-purple-200 rounded-lg outline-purple-500 text-slate-700 text-lg font-bold" value={formatarMoedaEstrangeiraInput(nfData.valorMoedaEstrangeira, clienteSel?.moeda)} onChange={handleValorEstrangeiroChange} placeholder="0.00" />
                        <p className="text-[10px] text-purple-600 mt-1">* Valor na moeda do contrato (Obrigatório Sefaz)</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Valor Convertido (R$)</label>
                        <input type="text" inputMode="numeric" className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700 text-lg font-bold" value={formatarMoedaInput(nfData.valor)} onChange={handleValorChange} placeholder="R$ 0,00" />
                        <p className="text-[10px] text-slate-500 mt-1">* Valor fiscal em Reais para cálculo de impostos</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Valor do Serviço (R$)</label>
                        <input type="text" inputMode="numeric" className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700 text-lg font-bold" value={formatarMoedaInput(nfData.valor)} onChange={handleValorChange} placeholder="R$ 0,00" />
                    </div>
                </div>
            )}
            
            {/* SÓ MOSTRA SE NÃO FOR PF e NÃO FOR EXTERIOR */}
            {perfilEmpresa?.regimeTributario !== 'MEI' && !isExterior && !isPF && (
                <div className="mt-6 border-t pt-4">
                    <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Calculator size={16}/> Impostos e Retenções</h4>

                    {/* CAIXA DE ISS (MUNICIPAL) */}
                    <div className="mb-4 bg-slate-50 p-3 rounded border">
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                            <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={nfData.issRetido} onChange={e => setNfData({...nfData, issRetido: e.target.checked})} />
                            <span className="text-sm text-slate-700 font-medium">ISS Retido pelo Tomador?</span>
                        </label>
                        
                        {nfData.issRetido && (
                             <div className="flex items-center gap-2 animate-in fade-in pt-2 border-t border-slate-200 mt-2">
                                <span className="text-xs font-bold text-slate-500 uppercase">Alíquota:</span>
                                <input 
                                    type="text" inputMode="numeric"
                                    className="w-24 p-1.5 border rounded text-sm outline-blue-500 text-center font-bold text-slate-700" 
                                    value={nfData.aliquota} 
                                    onChange={e => setNfData({...nfData, aliquota: formatarPorcentagem(e.target.value)})} 
                                />
                                <span className="text-xs text-slate-500">%</span>
                            </div>
                        )}
                    </div>

                    {mostraRetencoesFederais && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                            {['pis', 'cofins', 'csll', 'ir', 'inss'].map(imposto => {
                                // === LÓGICA DE OCULTAÇÃO (SÓ EXIBE SE O ADMIN ATIVOU) ===
                                if (imposto === 'inss' && !cnaeSelecionadoObj?.temRetencaoInss) return null;
                                if (['pis', 'cofins', 'csll'].includes(imposto) && !cnaeSelecionadoObj?.retemCrsf) return null;
                                if (imposto === 'ir' && !cnaeSelecionadoObj?.retemIr) return null;

                                const dadosImposto = retencoes[imposto as keyof typeof retencoes];
                                const isActive = parseFloat(dadosImposto.valor) > 0 || parseFloat(dadosImposto.aliquota) > 0;
                                
                                return (
                                <div key={imposto} className={`flex flex-col p-3 border rounded transition ${isActive ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white border-slate-200'}`}>
                                    <span className="text-xs font-bold text-slate-700 uppercase mb-2">{imposto}</span>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center gap-1">
                                            <label className="text-[10px] text-slate-500 uppercase w-1/3">Alíq.</label>
                                            <div className="flex items-center w-2/3">
                                                <input type="text" inputMode="numeric" className="w-full p-1 border rounded text-xs outline-blue-500 text-right font-bold" value={dadosImposto.aliquota} onChange={e => handleAliquotaRetencaoChange(imposto, e.target.value)} />
                                                <span className="text-[10px] text-slate-400 ml-1">%</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center gap-1">
                                            <label className="text-[10px] text-slate-500 uppercase w-1/3">Valor</label>
                                            <div className="flex items-center w-2/3">
                                                <span className="text-[10px] text-slate-400 mr-1">R$</span>
                                                <input type="text" inputMode="numeric" className={`w-full p-1 border rounded text-xs outline-blue-500 text-right font-bold ${isActive ? 'text-blue-700' : 'text-slate-500'}`} value={dadosImposto.valor} onChange={e => handleValorRetencaoChange(imposto, e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>
            )}
            
            <div className="pt-4 border-t">
              <label className="block text-sm font-medium text-slate-700 mb-2">Discriminação do Serviço</label>
              <textarea rows={4} placeholder="Descrição detalhada do serviço prestado..." className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700 resize-none" value={nfData.servicoDescricao} onChange={(e) => setNfData({...nfData, servicoDescricao: e.target.value})}></textarea>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Revisão e Fechamento</h3>
            <div className="bg-slate-50 p-6 rounded-lg space-y-4 border border-slate-200">
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Tomador:</span><span className="font-medium text-slate-900">{nfData.clienteNome}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-slate-500">Atividade (CNAE):</span><span className="font-medium text-slate-900 text-right max-w-xs truncate">{nfData.codigoCnae} {cnaeDescricaoCurta ? `- ${cnaeDescricaoCurta}` : ''}</span></div>
              <div className="border-b pb-2"><span className="text-slate-500 block mb-1 text-sm">Descrição do Serviço:</span><div className="font-medium text-slate-700 text-sm whitespace-pre-wrap bg-white p-3 rounded border border-slate-200 shadow-sm">{nfData.servicoDescricao || "Sem descrição informada."}</div></div>
              
              <div className="flex justify-between pt-2"><span className="text-slate-500">Valor Bruto:</span><span className="font-bold text-slate-900 text-lg">R$ {valorNumerico.toFixed(2)}</span></div>

              {/* DEDUÇÕES DINÂMICAS */}
              {isPJ && !isPF && !isExterior && (nfData.issRetido || totalRetido > 0) && (
                  <div className="bg-red-50 p-3 rounded border border-red-100 mt-2">
                      <p className="text-[10px] font-bold text-red-800 uppercase mb-2 tracking-wider">Deduções na Fonte</p>
                      {nfData.issRetido && (
                          <div className="flex justify-between text-sm text-red-600 mb-1">
                              <span>ISS ({nfData.aliquota}%):</span>
                              <span>- R$ {(valorNumerico * (parseFloat(nfData.aliquota)/100)).toFixed(2)}</span>
                          </div>
                      )}
                      {Object.entries(retencoes).map(([key, data]) => {
                          if (parseFloat(data.valor) > 0) {
                              return (
                                  <div key={key} className="flex justify-between text-sm text-red-600 mb-1">
                                      <span className="uppercase">{key} ({data.aliquota}%):</span>
                                      <span>- R$ {data.valor}</span>
                                  </div>
                              );
                          }
                          return null;
                      })}
                      <div className="flex justify-between pt-2 border-t border-red-200 mt-2 text-sm font-bold text-slate-800">
                          <span>Valor Líquido a Receber:</span>
                          <span className="text-green-700">R$ {valorLiquido.toFixed(2)}</span>
                      </div>
                  </div>
              )}

              {isExterior && (
                  <div className="flex justify-between pt-2 border-t border-slate-200 mt-2"><span className="text-slate-500">Valor Faturado ({clienteSel?.moeda || 'USD'}):</span><span className="font-bold text-purple-700 text-lg">{formatarMoedaEstrangeiraInput(nfData.valorMoedaEstrangeira, clienteSel?.moeda)}</span></div>
              )}
            </div>

            {perfilEmpresa?.ambiente === 'HOMOLOGACAO' ? (
                 <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-start gap-2 text-sm text-orange-800 font-medium"><AlertTriangle size={18} className="shrink-0 mt-0.5" /><p>Você está no ambiente de <strong>HOMOLOGAÇÃO</strong>. A nota será apenas validada pela prefeitura, sem valor fiscal. Se quiser emitir com valor, mude para Produção nas configurações.</p></div>
            ) : (
                <p className="text-xs text-center text-slate-400">Ao clicar em emitir, a nota será processada no ambiente nacional e possuirá valor fiscal.</p>
            )}
          </div>
        )}

        <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
          <div>
            {step > 1 && !loading && (
                <button onClick={handleBack} className="flex items-center gap-2 text-slate-500 px-4 py-2 hover:bg-gray-100 rounded"><ArrowLeft size={18} /> Voltar</button>
            )}
          </div>
          
          <div className="w-full flex justify-end">
            {step < 3 ? (
                <button onClick={handleNext} disabled={loading || (step === 1 && !nfData.clienteId) || isStep2Invalid} className={`bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed`}>
                    {loading ? <Loader2 className="animate-spin" size={18}/> : 'Próximo'} <ArrowRight size={18} />
                </button>
            ) : (
                loading ? (
                    <div className="w-full max-w-xs"><div className="flex justify-between text-xs font-bold text-blue-600 mb-1"><span>{progressStatus}</span><span>{progressPercent}%</span></div><div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden"><div className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }}></div></div></div>
                ) : (
                    <button onClick={handleEmitir} className={`${perfilEmpresa?.ambiente === 'HOMOLOGACAO' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'} text-white px-8 py-3 rounded-lg flex items-center gap-2 shadow-lg font-bold transition-transform transform hover:scale-105`}><CheckCircle size={20} /> {perfilEmpresa?.ambiente === 'HOMOLOGACAO' ? 'VALIDAR NOTA (TESTE)' : 'EMITIR NOTA'}</button>
                )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmitirNotaPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2"/> Carregando...</div>}>
            <EmitirNotaContent />
        </Suspense>
    );
}