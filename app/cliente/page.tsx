'use client'; 

import { useEffect, useState } from 'react';
import { Save, X, Plus, Edit, Trash2, Search, MapPin, ArrowLeft, Users, Loader2, Building, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDialog } from '@/app/contexts/DialogContext';
import { validarCPF } from '@/app/utils/cpf';

interface Cliente {
  id: string;
  nome: string;
  nomeFantasia?: string; 
  inscricaoMunicipal?: string; 
  email: string;
  documento: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  codigoIbge?: string;
}

export default function MeusClientes() {
  const router = useRouter();
  const dialog = useDialog();
  
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [buscandoDoc, setBuscandoDoc] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  
  const [clienteAtual, setClienteAtual] = useState<Cliente>({ 
    id: '', nome: '', nomeFantasia: '', inscricaoMunicipal: '', email: '', documento: '', cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '', codigoIbge: ''
  });

  const isPJ = clienteAtual.documento.replace(/\D/g, '').length > 11;

  const carregarClientes = async () => {
    const userId = localStorage.getItem('userId');
    const contextId = localStorage.getItem('empresaContextId');
    if (!userId) return;

    try {
      const res = await fetch('/api/clientes', { 
          headers: { 'x-user-id': userId, 'x-empresa-id': contextId || '' } 
      });
      const dados = await res.json();
      setClientes(dados);
      setFilteredClientes(dados);
    } catch (erro) { console.error(erro); } 
    finally { setLoading(false); }
  };

  useEffect(() => { carregarClientes(); }, []);

  useEffect(() => {
    if (!termoBusca) {
      setFilteredClientes(clientes);
    } else {
      const lower = termoBusca.toLowerCase();
      const filtrados = clientes.filter(c => 
        c.nome.toLowerCase().includes(lower) || 
        c.documento.includes(lower) || 
        (c.nomeFantasia && c.nomeFantasia.toLowerCase().includes(lower)) ||
        (c.email && c.email.toLowerCase().includes(lower))
      );
      setFilteredClientes(filtrados);
    }
  }, [termoBusca, clientes]);

  const handleBuscarDocumento = async () => {
    const docLimpo = clienteAtual.documento.replace(/\D/g, '');
    
    if (docLimpo.length === 11) {
        if (validarCPF(clienteAtual.documento)) {
            dialog.showAlert({ type: 'success', title: 'CPF Válido', description: 'Preencha os dados pessoais manualmente.' });
        } else {
            dialog.showAlert({ type: 'warning', title: 'Inválido', description: 'CPF incorreto.' });
        }
        return;
    }

    if (docLimpo.length === 14) {
        setBuscandoDoc(true);
        try {
            const res = await fetch('/api/external/cnpj', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cnpj: docLimpo })
            });
            const dados = await res.json();

            if (res.ok) {
                setClienteAtual(prev => ({
                    ...prev,
                    nome: dados.razaoSocial,
                    nomeFantasia: dados.nomeFantasia,
                    email: dados.email || prev.email,
                    cep: dados.cep,
                    logradouro: dados.logradouro,
                    numero: dados.numero,
                    bairro: dados.bairro,
                    cidade: dados.cidade,
                    uf: dados.uf,
                    codigoIbge: dados.codigoIbge
                }));
                dialog.showAlert({ type: 'success', description: 'Dados da empresa carregados.' });
            } else { 
                dialog.showAlert({ type: 'warning', description: "CNPJ não encontrado." }); 
            }
        } catch (e) { dialog.showAlert("Erro de conexão."); } 
        finally { setBuscandoDoc(false); }
        return;
    }
    dialog.showAlert("Digite um CPF (11) ou CNPJ (14).");
  };

  const handleBuscarCep = async () => {
      const cepLimpo = clienteAtual.cep?.replace(/\D/g, '');
      if (!cepLimpo || cepLimpo.length !== 8) return; 

      setBuscandoCep(true);
      try {
          const res = await fetch('/api/external/cep', { method: 'POST', body: JSON.stringify({ cep: cepLimpo }) });
          const dados = await res.json();
          if (res.ok) {
              setClienteAtual(prev => ({
                  ...prev,
                  logradouro: dados.logradouro,
                  bairro: dados.bairro,
                  cidade: dados.cidade,
                  uf: dados.uf,
                  codigoIbge: dados.codigoIbge
              }));
          } else { dialog.showAlert({ type: 'warning', description: "CEP não encontrado." }); }
      } catch (e) { console.error(e); } finally { setBuscandoCep(false); }
  };

  const abrirNovoCadastro = () => {
    setClienteAtual({ id: '', nome: '', nomeFantasia: '', inscricaoMunicipal: '', email: '', documento: '', cidade: '', uf: '', cep: '', logradouro: '', numero: '', bairro: '', codigoIbge: '' });
    setIsFormOpen(true);
  }

  const abrirEdicao = (cliente: Cliente) => {
    setClienteAtual(cliente);
    setIsFormOpen(true);
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const docLimpo = clienteAtual.documento.replace(/\D/g, '');
    
    if (docLimpo.length === 11 && !validarCPF(clienteAtual.documento)) {
        return dialog.showAlert({ type: 'danger', description: 'CPF inválido.' });
    }
    if (docLimpo.length !== 11 && docLimpo.length !== 14) {
        return dialog.showAlert({ type: 'warning', description: 'Documento deve ter 11 ou 14 dígitos.' });
    }
    if (clienteAtual.nome.trim().length < 5) {
        return dialog.showAlert({ type: 'warning', description: 'Nome/Razão Social muito curto.' });
    }
    if (!clienteAtual.codigoIbge) {
        return dialog.showAlert({ type: 'warning', description: 'Busque o CEP para preencher o código IBGE.' });
    }

    setSalvando(true);
    const userId = localStorage.getItem('userId');
    const contextId = localStorage.getItem('empresaContextId');

    try {
      const metodo = clienteAtual.id ? 'PUT' : 'POST';
      const res = await fetch('/api/clientes', {
        method: metodo,
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '', 'x-empresa-id': contextId || '' },
        body: JSON.stringify(clienteAtual)
      });

      if (res.ok) {
        dialog.showAlert({ type: 'success', description: 'Salvo com sucesso!' });
        setIsFormOpen(false);
        carregarClientes();
      } else { 
          dialog.showAlert({ type: 'danger', description: 'Erro ao salvar.' }); 
      }
    } catch (error) { dialog.showAlert("Erro de conexão."); } 
    finally { setSalvando(false); }
  };

  const handleExcluir = async (id: string) => {
    const confirmed = await dialog.showConfirm({ type: 'danger', title: 'Excluir?', description: 'Essa ação é irreversível.', confirmText: 'Sim, Excluir' });
    if (!confirmed) return;

    const userId = localStorage.getItem('userId');
    const contextId = localStorage.getItem('empresaContextId');

    try {
      const res = await fetch(`/api/clientes?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId || '', 'x-empresa-id': contextId || '' }
      });
      if (res.ok) { carregarClientes(); }
      else dialog.showAlert({ type: 'danger', description: "Erro ao excluir." });
    } catch (e) { dialog.showAlert("Erro de conexão."); }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* CABEÇALHO ATUALIZADO COM BOTÃO VOLTAR */}
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-600">
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Users className="text-blue-600"/> Meus Clientes</h1>
                    <p className="text-slate-500 text-sm">Gerencie tomadores PF e PJ.</p>
                </div>
            </div>
            
            {!isFormOpen && (
                <button onClick={abrirNovoCadastro} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium shadow-md">
                    <Plus size={20} /> Novo Cliente
                </button>
            )}
        </div>

        {/* MODAL */}
        {isFormOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
                        <h3 className="font-bold text-lg text-slate-800">
                            {clienteAtual.id ? 'Editar Cliente' : 'Novo Cadastro'}
                        </h3>
                        <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={24} /></button>
                    </div>
            
                    <form onSubmit={handleSalvar} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">CPF / CNPJ</label>
                                <div className="flex gap-2">
                                    <input required placeholder="Apenas números" className="p-3 border rounded-lg flex-1 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                        value={clienteAtual.documento} onChange={e => setClienteAtual({...clienteAtual, documento: e.target.value})}
                                    />
                                    <button type="button" onClick={handleBuscarDocumento} disabled={buscandoDoc} className="bg-blue-50 text-blue-600 px-4 rounded-lg hover:bg-blue-100 transition border border-blue-200">
                                        {buscandoDoc ? <Loader2 className="animate-spin" size={20}/> : <Search size={20} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Email</label>
                                <input type="email" placeholder="email@cliente.com" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={clienteAtual.email || ''} onChange={e => setClienteAtual({...clienteAtual, email: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className={`grid grid-cols-1 ${isPJ ? 'md:grid-cols-2' : ''} gap-6`}>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                                    {isPJ ? 'Razão Social' : 'Nome Completo'}
                                </label>
                                <input 
                                    required 
                                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${isPJ ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'}`}
                                    value={clienteAtual.nome} 
                                    onChange={e => setClienteAtual({...clienteAtual, nome: e.target.value})}
                                    readOnly={isPJ} 
                                />
                            </div>
                            
                            {/* CAMPOS EXCLUSIVOS PARA PJ */}
                            {isPJ && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nome Fantasia</label>
                                    <input className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={clienteAtual.nomeFantasia || ''} onChange={e => setClienteAtual({...clienteAtual, nomeFantasia: e.target.value})}
                                    />
                                </div>
                            )}
                        </div>

                        {isPJ && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Inscrição Municipal (Opcional)</label>
                                <input placeholder="Ex: 12345" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={clienteAtual.inscricaoMunicipal || ''} onChange={e => setClienteAtual({...clienteAtual, inscricaoMunicipal: e.target.value})}
                                />
                            </div>
                        )}

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 relative">
                            <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2"><MapPin size={16}/> Endereço</h4>
                            {buscandoCep && <div className="absolute top-4 right-4 flex items-center gap-2 text-xs text-blue-600"><Loader2 className="animate-spin" size={14}/> Buscando...</div>}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-1">
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">CEP</label>
                                    <input required placeholder="00000000" className="w-full p-2 border rounded bg-white text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none" 
                                        value={clienteAtual.cep || ''} 
                                        onChange={e => setClienteAtual({...clienteAtual, cep: e.target.value})}
                                        onBlur={handleBuscarCep}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Logradouro</label>
                                    <input className="w-full p-2 border rounded bg-gray-100 text-gray-600 text-sm cursor-not-allowed" 
                                        value={clienteAtual.logradouro || ''} readOnly tabIndex={-1}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Número</label>
                                    <input required placeholder="Nº" className="w-full p-2 border rounded bg-white text-sm" 
                                        value={clienteAtual.numero || ''} onChange={e => setClienteAtual({...clienteAtual, numero: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Bairro</label>
                                    <input className="w-full p-2 border rounded bg-gray-100 text-gray-600 text-sm cursor-not-allowed" 
                                        value={clienteAtual.bairro || ''} readOnly tabIndex={-1}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Cidade</label>
                                    <input className="w-full p-2 border rounded bg-gray-100 text-gray-600 text-sm cursor-not-allowed" 
                                        value={clienteAtual.cidade || ''} readOnly tabIndex={-1}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 mb-1">UF</label>
                                    <input className="w-full p-2 border rounded bg-gray-100 text-gray-600 text-sm cursor-not-allowed" 
                                        value={clienteAtual.uf || ''} readOnly tabIndex={-1}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition font-medium">Cancelar</button>
                            <button type="submit" disabled={salvando} className="bg-green-600 text-white px-8 py-2 rounded-lg hover:bg-green-700 transition font-bold shadow-lg shadow-green-100 flex items-center gap-2">
                                {salvando ? 'Salvando...' : <><Save size={18} /> Salvar</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* LISTAGEM */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input 
                        className="w-full pl-10 p-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Buscar por nome ou documento..."
                        value={termoBusca}
                        onChange={e => setTermoBusca(e.target.value)}
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Documento</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Localização</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">Carregando...</td></tr>
                        ) : filteredClientes.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-400">Nenhum cliente encontrado.</td></tr>
                        ) : (
                            filteredClientes.map((cliente) => (
                                <tr key={cliente.id} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{cliente.nome}</div>
                                        {cliente.nomeFantasia && <div className="text-xs text-slate-500">{cliente.nomeFantasia}</div>}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-600">
                                        {cliente.documento}
                                    </td>
                                    <td className="px-6 py-4">
                                        {cliente.documento.replace(/\D/g, '').length > 11 ? (
                                            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 w-fit"><Building size={10}/> PJ</span>
                                        ) : (
                                            <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded border border-green-200 flex items-center gap-1 w-fit"><User size={10}/> PF</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                        {cliente.cidade ? `${cliente.cidade}/${cliente.uf}` : <span className="text-slate-300 italic">--</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button onClick={() => abrirEdicao(cliente)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit size={18}/></button>
                                        <button onClick={() => handleExcluir(cliente.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}