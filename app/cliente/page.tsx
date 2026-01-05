'use client'; 

import { useEffect, useState } from 'react';
import { Save, X, Plus, Edit, Trash2, Search, MapPin, ArrowLeft, Users, Building } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Cliente {
  id: string;
  nome: string;
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
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle do Formulário
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  
  const [clienteAtual, setClienteAtual] = useState<Cliente>({ 
    id: '', nome: '', email: '', documento: '', cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '', codigoIbge: ''
  });

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
    } catch (erro) {
      console.error("Erro ao buscar clientes:", erro);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarClientes();
  }, []);

  // Filtro de busca local
  useEffect(() => {
    if (!termoBusca) {
      setFilteredClientes(clientes);
    } else {
      const lower = termoBusca.toLowerCase();
      const filtrados = clientes.filter(c => 
        c.nome.toLowerCase().includes(lower) || 
        c.documento.includes(lower) || 
        (c.email && c.email.toLowerCase().includes(lower))
      );
      setFilteredClientes(filtrados);
    }
  }, [termoBusca, clientes]);

  const buscarCNPJ = async () => {
    const docLimpo = clienteAtual.documento.replace(/\D/g, '');
    if (docLimpo.length !== 14) { alert("Digite um CNPJ válido (14 números)."); return; }

    setBuscando(true);
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
          email: dados.email || prev.email,
          cep: dados.cep,
          logradouro: dados.logradouro,
          numero: dados.numero,
          bairro: dados.bairro,
          cidade: dados.cidade,
          uf: dados.uf,
          codigoIbge: dados.codigoIbge
        }));
      } else { alert("CNPJ não encontrado."); }
    } catch (e) { alert("Erro de conexão."); } 
    finally { setBuscando(false); }
  };

  const abrirNovoCadastro = () => {
    setClienteAtual({ id: '', nome: '', email: '', documento: '', cidade: '', uf: '' });
    setIsFormOpen(true);
  }

  const abrirEdicao = (cliente: Cliente) => {
    setClienteAtual(cliente);
    setIsFormOpen(true);
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
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
        alert(clienteAtual.id ? 'Cliente atualizado!' : 'Cliente criado!');
        setIsFormOpen(false);
        carregarClientes();
      } else { alert('Erro ao salvar.'); }
    } catch (error) { alert('Erro de conexão.'); } 
    finally { setSalvando(false); }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    const userId = localStorage.getItem('userId');
    const contextId = localStorage.getItem('empresaContextId');

    try {
      const res = await fetch(`/api/clientes?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId || '', 'x-empresa-id': contextId || '' }
      });
      if (res.ok) carregarClientes();
      else alert("Erro ao excluir.");
    } catch (e) { alert("Erro de conexão."); }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={() => router.push('/cliente/dashboard')} className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition text-slate-500">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="text-blue-600" size={24}/> Meus Clientes
                    </h1>
                    <p className="text-slate-500 text-sm">Gerencie a base de tomadores para suas notas.</p>
                </div>
            </div>
            
            <div className="flex gap-3">
                {!isFormOpen && (
                    <button 
                        onClick={abrirNovoCadastro}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-md font-medium"
                    >
                        <Plus size={20} /> Novo Cliente
                    </button>
                )}
            </div>
        </div>

        {/* MODAL / FORMULÁRIO */}
        {isFormOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
                        <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                            {clienteAtual.id ? <Edit size={20} className="text-blue-600"/> : <Plus size={20} className="text-blue-600"/>}
                            {clienteAtual.id ? 'Editar Cliente' : 'Novo Cadastro'}
                        </h3>
                        <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition">
                            <X size={24} />
                        </button>
                    </div>
            
                    <form onSubmit={handleSalvar} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">CPF / CNPJ</label>
                                <div className="flex gap-2">
                                    <input required placeholder="00.000.000/0000-00" className="p-3 border rounded-lg flex-1 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                        value={clienteAtual.documento} onChange={e => setClienteAtual({...clienteAtual, documento: e.target.value})}
                                    />
                                    <button type="button" onClick={buscarCNPJ} disabled={buscando} className="bg-blue-50 text-blue-600 px-4 rounded-lg hover:bg-blue-100 transition border border-blue-200" title="Buscar na Receita">
                                        {buscando ? '...' : <Search size={20} />}
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

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nome / Razão Social</label>
                            <input required placeholder="Nome do Cliente" className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                value={clienteAtual.nome} onChange={e => setClienteAtual({...clienteAtual, nome: e.target.value})}
                            />
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2"><MapPin size={16}/> Endereço</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-1">
                                    <input placeholder="CEP" className="w-full p-2 border rounded bg-white text-sm" value={clienteAtual.cep || ''} onChange={e => setClienteAtual({...clienteAtual, cep: e.target.value})}/>
                                </div>
                                <div className="md:col-span-2">
                                    <input placeholder="Logradouro" className="w-full p-2 border rounded bg-white text-sm" value={clienteAtual.logradouro || ''} onChange={e => setClienteAtual({...clienteAtual, logradouro: e.target.value})}/>
                                </div>
                                <div>
                                    <input placeholder="Número" className="w-full p-2 border rounded bg-white text-sm" value={clienteAtual.numero || ''} onChange={e => setClienteAtual({...clienteAtual, numero: e.target.value})}/>
                                </div>
                                <div>
                                    <input placeholder="Bairro" className="w-full p-2 border rounded bg-white text-sm" value={clienteAtual.bairro || ''} onChange={e => setClienteAtual({...clienteAtual, bairro: e.target.value})}/>
                                </div>
                                <div>
                                    <input placeholder="Cidade" className="w-full p-2 border rounded bg-white text-sm" value={clienteAtual.cidade || ''} onChange={e => setClienteAtual({...clienteAtual, cidade: e.target.value})}/>
                                </div>
                                <div>
                                    <input placeholder="UF" maxLength={2} className="w-full p-2 border rounded bg-white text-sm" value={clienteAtual.uf || ''} onChange={e => setClienteAtual({...clienteAtual, uf: e.target.value})}/>
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

        {/* ÁREA DE LISTAGEM */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            
            {/* Barra de Filtro */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <Building size={18} className="text-slate-400"/> Lista de Cadastros
                </h3>
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
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente / Razão Social</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Documento</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Localização</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">Carregando clientes...</td></tr>
                        ) : filteredClientes.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-16 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users size={40} className="text-slate-200"/>
                                        <p>Nenhum cliente encontrado.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredClientes.map((cliente) => (
                                <tr key={cliente.id} className="hover:bg-slate-50 transition group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800">{cliente.nome}</div>
                                        <div className="text-xs text-slate-500">{cliente.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-mono font-medium rounded bg-slate-100 text-slate-600 border border-slate-200">
                                            {cliente.documento}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                        {cliente.cidade ? `${cliente.cidade}/${cliente.uf}` : <span className="text-slate-300 italic">--</span>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => abrirEdicao(cliente)} className="text-blue-600 hover:bg-blue-50 p-2 rounded transition" title="Editar">
                                                <Edit size={18} />
                                            </button>
                                            <button onClick={() => handleExcluir(cliente.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded transition" title="Excluir">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
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