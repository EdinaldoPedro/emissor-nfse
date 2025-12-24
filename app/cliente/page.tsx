'use client'; 

import { useEffect, useState } from 'react';
import { Save, X, Plus, Edit, Trash2, Search, MapPin } from 'lucide-react';

interface Cliente {
  id: string;
  nome: string;
  email: string;
  documento: string;
  // Campos de endereço para exibição na tabela
  cidade?: string;
  uf?: string;
  // Outros campos podem vir do banco, mas tipamos o principal aqui
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  codigoIbge?: string;
}

export default function MeusClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle do Formulário
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [buscando, setBuscando] = useState(false); // Loading da lupa
  
  // Estado do formulário (com endereço completo)
  const [clienteAtual, setClienteAtual] = useState<Cliente>({ 
    id: '', 
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

  // Carregar lista
  const carregarClientes = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    try {
      const res = await fetch('/api/clientes', { headers: { 'x-user-id': userId } });
      const dados = await res.json();
      setClientes(dados);
    } catch (erro) {
      console.error("Erro ao buscar clientes:", erro);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarClientes();
  }, []);

  // --- FUNÇÃO DE BUSCA CNPJ (Igual à da emissão) ---
  const buscarCNPJ = async () => {
    // Remove pontuação
    const docLimpo = clienteAtual.documento.replace(/\D/g, '');
    
    if (docLimpo.length !== 14) {
      alert("Para buscar automaticamente, digite um CNPJ válido (14 números).");
      return;
    }

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
          // Preenche endereço
          cep: dados.cep,
          logradouro: dados.logradouro,
          numero: dados.numero,
          bairro: dados.bairro,
          cidade: dados.cidade,
          uf: dados.uf,
          codigoIbge: dados.codigoIbge
        }));
      } else {
        alert("CNPJ não encontrado ou erro na consulta.");
      }
    } catch (e) {
      alert("Erro de conexão ao buscar CNPJ.");
    } finally {
      setBuscando(false);
    }
  };

  // Abrir modal para NOVO cadastro
  const abrirNovoCadastro = () => {
    setClienteAtual({ id: '', nome: '', email: '', documento: '', cidade: '', uf: '' });
    setIsFormOpen(true);
  }

  // Abrir modal para EDIÇÃO
  const abrirEdicao = (cliente: Cliente) => {
    setClienteAtual(cliente);
    setIsFormOpen(true);
  }

  // Ação de Salvar
  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const userId = localStorage.getItem('userId');

    try {
      const metodo = clienteAtual.id ? 'PUT' : 'POST';
      
      const res = await fetch('/api/clientes', {
        method: metodo,
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
        body: JSON.stringify(clienteAtual)
      });

      if (res.ok) {
        alert(clienteAtual.id ? 'Cliente atualizado!' : 'Cliente criado!');
        setIsFormOpen(false);
        carregarClientes();
      } else {
        alert('Erro ao salvar.');
      }
    } catch (error) {
      alert('Erro de conexão.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    const userId = localStorage.getItem('userId');
    try {
      const res = await fetch(`/api/clientes?id=${id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) carregarClientes();
      else alert("Erro ao excluir.");
    } catch (e) { alert("Erro de conexão."); }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando seus clientes...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Meus Clientes</h1>
          <p className="text-sm text-gray-500">Gerencie quem recebe suas notas fiscais.</p>
        </div>
        
        {!isFormOpen && (
          <button 
            onClick={abrirNovoCadastro}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
          >
            <Plus size={20} /> Novo Cliente
          </button>
        )}
      </div>

      {/* FORMULÁRIO COMPLETO */}
      {isFormOpen && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-blue-100 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between mb-4 pb-2 border-b">
            <h3 className="font-bold text-lg text-gray-700 flex items-center gap-2">
                {clienteAtual.id ? <Edit size={18}/> : <Plus size={18}/>}
                {clienteAtual.id ? 'Editar Cliente' : 'Novo Cliente'}
            </h3>
            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-red-500 transition">
              <X size={24} />
            </button>
          </div>
          
          <form onSubmit={handleSalvar} className="space-y-4">
            
            {/* LINHA 1: CNPJ (Com botão de busca) e EMAIL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">CPF / CNPJ</label>
                    <div className="flex gap-2">
                        <input 
                            required
                            placeholder="00.000.000/0000-00" 
                            className="p-2 border rounded flex-1 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={clienteAtual.documento}
                            onChange={e => setClienteAtual({...clienteAtual, documento: e.target.value})}
                        />
                        <button 
                            type="button"
                            onClick={buscarCNPJ}
                            disabled={buscando}
                            className="bg-blue-100 text-blue-700 px-3 rounded hover:bg-blue-200 transition flex items-center justify-center disabled:opacity-50"
                            title="Buscar dados na Receita"
                        >
                            {buscando ? '...' : <Search size={18} />}
                        </button>
                    </div>
                    <p className="text-[10px] text-blue-500 mt-1">* Clique na lupa para preencher automático.</p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Email</label>
                    <input 
                        placeholder="email@cliente.com" 
                        type="email"
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        value={clienteAtual.email || ''}
                        onChange={e => setClienteAtual({...clienteAtual, email: e.target.value})}
                    />
                </div>
            </div>

            {/* LINHA 2: NOME */}
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nome / Razão Social</label>
                <input 
                    required
                    placeholder="Nome do Cliente" 
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                    value={clienteAtual.nome}
                    onChange={e => setClienteAtual({...clienteAtual, nome: e.target.value})}
                />
            </div>

            {/* LINHA 3: ENDEREÇO (Cidade/UF) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Cidade</label>
                    <input 
                        className="w-full p-2 border rounded bg-gray-50"
                        value={clienteAtual.cidade || ''}
                        onChange={e => setClienteAtual({...clienteAtual, cidade: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">UF</label>
                    <input 
                        className="w-full p-2 border rounded bg-gray-50"
                        maxLength={2}
                        value={clienteAtual.uf || ''}
                        onChange={e => setClienteAtual({...clienteAtual, uf: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">CEP</label>
                    <input 
                        className="w-full p-2 border rounded bg-gray-50"
                        value={clienteAtual.cep || ''}
                        onChange={e => setClienteAtual({...clienteAtual, cep: e.target.value})}
                    />
                </div>
            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <button 
                    type="button" 
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded transition"
                >
                    Cancelar
                </button>
                <button 
                    type="submit" 
                    disabled={salvando}
                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition flex items-center gap-2 shadow-lg shadow-green-100"
                >
                    {salvando ? 'Salvando...' : <><Save size={18} /> {clienteAtual.id ? 'Atualizar Dados' : 'Cadastrar Cliente'}</>}
                </button>
            </div>
          </form>
        </div>
      )}

      {/* LISTAGEM */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nome / Razão</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">CNPJ</th>
              {/* NOVA COLUNA */}
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Município/UF</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clientes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <p className="text-lg font-medium mb-1">Sua lista está vazia</p>
                    <p className="text-sm">Cadastre seu primeiro cliente para emitir notas.</p>
                  </div>
                </td>
              </tr>
            ) : (
              clientes.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-gray-50 transition group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-800">{cliente.nome}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{cliente.email || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {cliente.documento}
                    </span>
                  </td>
                  {/* NOVA COLUNA - DADOS */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 flex items-center gap-1">
                        {cliente.cidade ? (
                            <>
                                <MapPin size={14} className="text-blue-400"/>
                                {cliente.cidade}/{cliente.uf}
                            </>
                        ) : (
                            <span className="text-gray-300 italic text-xs">Não inf.</span>
                        )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3 opacity-60 group-hover:opacity-100 transition">
                        <button 
                            onClick={() => abrirEdicao(cliente)}
                            className="text-indigo-600 hover:text-indigo-900 p-1 hover:bg-indigo-50 rounded"
                            title="Editar"
                        >
                            <Edit size={18} />
                        </button>
                        <button 
                            onClick={() => handleExcluir(cliente.id)}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                            title="Excluir"
                        >
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
  );
}