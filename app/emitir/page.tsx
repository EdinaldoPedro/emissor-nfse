"use client";

import { useState, useEffect } from "react";
import { CheckCircle, ArrowRight, ArrowLeft, Building2, Calculator, FileCheck, UserPlus, Users, Search, MapPin, Briefcase } from "lucide-react";
import { useRouter } from "next/navigation";

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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Listas de Dados
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  const [meusCnaes, setMeusCnaes] = useState<CnaeDB[]>([]);
  
  // Controle de Abas no Passo 1
  const [modoCliente, setModoCliente] = useState<'existente' | 'novo'>('existente');
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  // Estado do Novo Cliente
  const [novoCliente, setNovoCliente] = useState({ 
    nome: '', 
    email: '', 
    documento: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    codigoIbge: ''
  });

  // DADOS DA NOTA (Agora com CNAE)
  const [nfData, setNfData] = useState({
    clienteId: "",
    clienteNome: "",
    servicoDescricao: "",
    valor: "",
    retencoes: false,
    codigoCnae: "" // <--- NOVO CAMPO OBRIGATÓRIO
  });

  // Carrega Clientes e CNAEs do Usuário ao abrir
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if(!userId) {
        router.push('/login');
        return;
    }

    // 1. Busca Clientes
    fetch('/api/clientes', { headers: { 'x-user-id': userId } })
      .then(res => res.json())
      .then(data => setClientes(data))
      .catch(err => console.error("Erro clientes", err));

    // 2. Busca Perfil para pegar os CNAEs
    fetch('/api/perfil', { headers: { 'x-user-id': userId } })
      .then(res => res.json())
      .then(data => {
         if (data.atividades && Array.isArray(data.atividades)) {
             setMeusCnaes(data.atividades);
             // Seleciona o CNAE Principal automaticamente se houver
             const principal = data.atividades.find((c: CnaeDB) => c.principal);
             if (principal) {
                 setNfData(prev => ({ ...prev, codigoCnae: principal.codigo }));
             } else if (data.atividades.length > 0) {
                 setNfData(prev => ({ ...prev, codigoCnae: data.atividades[0].codigo }));
             }
         }
      })
      .catch(err => console.error("Erro perfil", err));

  }, [router]);

  // --- BUSCA CLIENTE (BRASIL API) ---
  const buscarClienteCNPJ = async () => {
    const docLimpo = novoCliente.documento.replace(/\D/g, '');
    if(docLimpo.length !== 14) {
      alert("Digite um CNPJ válido para buscar.");
      return;
    }
    setBuscandoCliente(true);
    try {
      const res = await fetch('/api/external/cnpj', {
        method: 'POST',
        body: JSON.stringify({ cnpj: docLimpo })
      });
      const dados = await res.json();
      if(res.ok) {
        setNovoCliente(prev => ({
          ...prev,
          nome: dados.razaoSocial,
          email: dados.email || prev.email,
          cep: dados.cep,
          logradouro: dados.logradouro,
          numero: dados.numero,
          bairro: dados.bairro,
          cidade: dados.cidade,
          uf: dados.uf,
          codigoIbge: dados.codigoIbge
        }));
      } else {
        alert("CNPJ não encontrado.");
      }
    } catch (e) { alert("Erro de conexão."); }
    finally { setBuscandoCliente(false); }
  }

  // --- AVANÇAR ---
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
            } else {
                alert("Erro ao cadastrar cliente.");
            }
        } catch (e) { alert("Erro de conexão."); }
    } else {
        setStep(step + 1);
    }
  };

  const handleBack = () => setStep(step - 1);

  // --- EMISSÃO FINAL ---
  const handleEmitir = async () => {
    if (!nfData.codigoCnae) {
        alert("Selecione uma Atividade (CNAE) para emitir a nota.");
        setStep(2); // Volta para o passo 2 se estiver no 3
        return;
    }

    setLoading(true);
    const userId = localStorage.getItem('userId');

    try {
      const res = await fetch('/api/notas', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId || ''
        },
        body: JSON.stringify({
          clienteId: nfData.clienteId,
          valor: nfData.valor,
          descricao: nfData.servicoDescricao,
          codigoCnae: nfData.codigoCnae // Envia o CNAE escolhido
        })
      });

      const resposta = await res.json();

      if (res.ok) {
        alert(`✅ ${resposta.mensagem || "Nota emitida com sucesso!"}`);
        router.push('/cliente/dashboard');
      } else {
        alert(`❌ Erro: ${resposta.error}`);
      }
    } catch (error) {
      alert("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  const valorNumerico = parseFloat(nfData.valor) || 0;
  const impostoEstimado = valorNumerico * 0.06;
  const valorLiquido = nfData.retencoes ? valorNumerico - impostoEstimado : valorNumerico;

  return (
    <div className="max-w-4xl mx-auto py-10">
      <h2 className="text-2xl font-bold text-slate-800 mb-8">Emitir Nova NFS-e</h2>

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
        
        {/* PASSO 1: TOMADOR */}
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
                                <input 
                                    className="w-full p-2 border rounded bg-white"
                                    placeholder="000.000.000-00"
                                    value={novoCliente.documento}
                                    onChange={e => setNovoCliente({...novoCliente, documento: e.target.value})}
                                />
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

        {/* PASSO 2: SERVIÇO E VALORES */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Detalhes do Serviço</h3>
            
            {/* SELETOR DE CNAE */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <label className="block text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                    <Briefcase size={18} /> Atividade Econômica (CNAE)
                </label>
                {meusCnaes.length === 0 ? (
                    <div className="text-sm text-red-600">
                        ⚠️ Você não tem atividades cadastradas. Vá em "Minha Empresa" e complete seu cadastro para emitir.
                    </div>
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
              <input 
                type="number" placeholder="0,00"
                className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700 text-lg font-bold"
                value={nfData.valor}
                onChange={(e) => setNfData({...nfData, valor: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Discriminação</label>
              <textarea 
                rows={4} placeholder="Descrição detalhada do serviço..."
                className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700"
                value={nfData.servicoDescricao}
                onChange={(e) => setNfData({...nfData, servicoDescricao: e.target.value})}
              ></textarea>
            </div>
          </div>
        )}

        {/* PASSO 3: REVISÃO */}
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
            <p className="text-xs text-center text-slate-400">Ao clicar em emitir, a nota será enviada para o ambiente nacional.</p>
          </div>
        )}

        {/* BOTÕES */}
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
            <button onClick={handleEmitir} disabled={loading} className="bg-green-600 text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700 shadow-lg disabled:opacity-50 font-bold">
                {loading ? 'Processando...' : <><CheckCircle size={20} /> EMITIR NOTA</>}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}