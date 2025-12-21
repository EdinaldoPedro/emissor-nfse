"use client";

import { useState, useEffect } from "react";
import { CheckCircle, ArrowRight, ArrowLeft, Building2, Calculator, FileCheck, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";

interface ClienteDB {
  id: string;
  nome: string;
  documento: string;
}

export default function EmitirNotaPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<ClienteDB[]>([]);
  
  // Controle de Abas no Passo 1 (Existente vs Novo)
  const [modoCliente, setModoCliente] = useState<'existente' | 'novo'>('existente');

  // Estado do Novo Cliente (Caso seja cadastro na hora)
  const [novoCliente, setNovoCliente] = useState({ nome: '', email: '', documento: '' });

  const [nfData, setNfData] = useState({
    clienteId: "",
    clienteNome: "",
    servicoDescricao: "",
    valor: "",
    retencoes: false
  });

  useEffect(() => {
    async function fetchClientes() {
      const userId = localStorage.getItem('userId');
      if(!userId) return;
      
      const res = await fetch('/api/clientes', {
        headers: { 'x-user-id': userId }
      });
      const data = await res.json();
      setClientes(data);
    }
    fetchClientes();
  }, []);

  // Lógica Avançada de "Próximo"
  const handleNext = async () => {
    // Se estiver no passo 1 e escolheu "Novo Cliente", precisamos salvar ele primeiro
    if (step === 1 && modoCliente === 'novo') {
        const userId = localStorage.getItem('userId');
        
        try {
            const res = await fetch('/api/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
                body: JSON.stringify(novoCliente)
            });

            if (res.ok) {
                const clienteCriado = await res.json();
                // Define o ID do cliente recém criado na nota
                setNfData({ ...nfData, clienteId: clienteCriado.id, clienteNome: clienteCriado.nome });
                setStep(step + 1); // Avança
            } else {
                alert("Erro ao cadastrar cliente rápido.");
            }
        } catch (e) {
            alert("Erro de conexão.");
        }
    } else {
        // Fluxo normal
        setStep(step + 1);
    }
  };

  const handleBack = () => setStep(step - 1);

  const handleEmitir = async () => {
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
          descricao: nfData.servicoDescricao
        })
      });

      if (res.ok) {
        alert("Nota Emitida com Sucesso! 🚀");
        router.push('/cliente/dashboard');
      } else {
        alert("Erro ao emitir nota.");
      }
    } catch (error) {
      alert("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  // Cálculos visuais
  const valorNumerico = parseFloat(nfData.valor) || 0;
  const impostoEstimado = valorNumerico * 0.06;
  const valorLiquido = nfData.retencoes ? valorNumerico - impostoEstimado : valorNumerico;

  return (
    <div className="max-w-4xl mx-auto py-10">
      <h2 className="text-2xl font-bold text-slate-800 mb-8">Emitir Nova NFS-e</h2>

      {/* Steps Visual */}
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
        
        {/* PASSO 1: TOMADOR (COM OPÇÃO DE CADASTRO RÁPIDO) */}
        {step === 1 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Quem é o cliente?</h3>
            
            {/* ABAS DE ESCOLHA */}
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                <button 
                    onClick={() => setModoCliente('existente')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${modoCliente === 'existente' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Users size={16} /> Selecionar da Lista
                </button>
                <button 
                    onClick={() => setModoCliente('novo')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${modoCliente === 'novo' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
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
                            <option key={cliente.id} value={cliente.id}>
                                {cliente.nome} ({cliente.documento})
                            </option>
                        ))}
                    </select>
                    {clientes.length === 0 && <p className="text-sm text-yellow-600 mt-2">Nenhum cliente encontrado. Tente a aba "Cadastrar Novo".</p>}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome / Razão Social</label>
                        <input 
                            className="w-full p-2 border rounded bg-white"
                            placeholder="Ex: Padaria do João"
                            value={novoCliente.nome}
                            onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">CPF / CNPJ</label>
                        <input 
                            className="w-full p-2 border rounded bg-white"
                            placeholder="000.000.000-00"
                            value={novoCliente.documento}
                            onChange={e => setNovoCliente({...novoCliente, documento: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input 
                            className="w-full p-2 border rounded bg-white"
                            placeholder="contato@cliente.com"
                            value={novoCliente.email}
                            onChange={e => setNovoCliente({...novoCliente, email: e.target.value})}
                        />
                    </div>
                </div>
            )}
          </div>
        )}

        {/* PASSO 2 e 3 (MANTÉM IGUAL) */}
        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Detalhes do Serviço</h3>
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
                rows={4} placeholder="Descrição..."
                className="w-full p-3 border rounded-lg outline-blue-500 text-slate-700"
                value={nfData.servicoDescricao}
                onChange={(e) => setNfData({...nfData, servicoDescricao: e.target.value})}
              ></textarea>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-slate-700">Revisão</h3>
            <div className="bg-slate-50 p-6 rounded-lg space-y-4 border border-slate-200">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Tomador:</span>
                <span className="font-medium text-slate-900">
                    {modoCliente === 'novo' ? novoCliente.nome : nfData.clienteNome}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-500">Valor Bruto:</span>
                <span className="font-bold text-slate-900">R$ {valorNumerico.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-green-600 border-t pt-4 mt-2">
                <span>Valor Líquido:</span>
                <span>R$ {valorLiquido.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* BOTÕES DE NAVEGAÇÃO */}
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
          {step > 1 ? (
            <button onClick={handleBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium px-4 py-2">
              <ArrowLeft size={18} /> Voltar
            </button>
          ) : <div></div>}

          {step < 3 ? (
            <button 
              onClick={handleNext} 
              // Desabilita se: Modo Existente e sem ID, OU Modo Novo e sem Nome
              disabled={
                  (modoCliente === 'existente' && !nfData.clienteId) ||
                  (modoCliente === 'novo' && !novoCliente.nome)
              }
              className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition disabled:opacity-50"
            >
              {step === 1 && modoCliente === 'novo' ? 'Salvar e Avançar' : 'Próximo Passo'} <ArrowRight size={18} />
            </button>
          ) : (
            <button onClick={handleEmitir} disabled={loading} className="bg-green-600 text-white px-8 py-3 rounded-lg flex items-center gap-2 hover:bg-green-700 shadow-lg font-bold text-lg disabled:opacity-50">
              {loading ? 'Emitindo...' : <><CheckCircle size={20} /> EMITIR NOTA AGORA</>}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}