'use client'; 

import { useEffect, useState } from 'react';
import { Save, X, Plus, Edit } from 'lucide-react';

interface Cliente {
  id: string;
  nome: string;
  email: string;
  documento: string;
}

export default function MeusClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle do Formulário
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [novoCliente, setNovoCliente] = useState({ nome: '', email: '', documento: '' });
  const [salvando, setSalvando] = useState(false);

  const carregarClientes = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    try {
      const resposta = await fetch('/api/clientes', {
        headers: { 'x-user-id': userId }
      });
      const dados = await resposta.json();
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

  const handleSalvarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    const userId = localStorage.getItem('userId');

    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId || '' },
        body: JSON.stringify(novoCliente)
      });

      if (res.ok) {
        alert('Cliente cadastrado com sucesso!');
        setIsFormOpen(false); // Fecha o formulário
        setNovoCliente({ nome: '', email: '', documento: '' }); // Limpa
        carregarClientes(); // Atualiza a lista
      } else {
        alert('Erro ao cadastrar.');
      }
    } catch (error) {
      alert('Erro de conexão.');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando seus clientes...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Meus Clientes (Tomadores)</h1>
          <p className="text-sm text-gray-500">Gerencie quem recebe suas notas fiscais.</p>
        </div>
        
        {!isFormOpen && (
          <button 
            onClick={() => setIsFormOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus size={20} /> Novo Cliente
          </button>
        )}
      </div>

      {/* FORMULÁRIO DE CADASTRO (Aparece quando clica no botão) */}
      {isFormOpen && (
        <div className="bg-white p-6 rounded-lg shadow mb-8 border border-blue-100">
          <div className="flex justify-between mb-4">
            <h3 className="font-bold text-lg text-gray-700">Cadastrar Novo Cliente</h3>
            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-red-500">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSalvarCliente} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input 
              required
              placeholder="Nome ou Razão Social" 
              className="p-2 border rounded"
              value={novoCliente.nome}
              onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})}
            />
            <input 
              required
              placeholder="Email" 
              type="email"
              className="p-2 border rounded"
              value={novoCliente.email}
              onChange={e => setNovoCliente({...novoCliente, email: e.target.value})}
            />
            <input 
              required
              placeholder="CPF ou CNPJ" 
              className="p-2 border rounded"
              value={novoCliente.documento}
              onChange={e => setNovoCliente({...novoCliente, documento: e.target.value})}
            />
            <button 
              type="submit" 
              disabled={salvando}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition flex items-center justify-center gap-2 md:col-span-3"
            >
              {salvando ? 'Salvando...' : <><Save size={18} /> Salvar Cliente</>}
            </button>
          </form>
        </div>
      )}

      {/* LISTAGEM */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documento</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clientes.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            ) : (
              clientes.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cliente.nome}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cliente.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {cliente.documento}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end gap-1 w-full">
                      <Edit size={16} /> Editar
                    </button>
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