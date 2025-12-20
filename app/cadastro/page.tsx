'use client'; // <--- OBRIGATÓRIO NA PRIMEIRA LINHA

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // Nota: use 'next/navigation' no App Router

export default function Cadastro() {
  const router = useRouter();
  const [form, setForm] = useState({ nome: '', email: '', senha: '' });
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('Processando...');
    setErro(false);

    try {
      const response = await fetch('/api/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (response.ok) {
        setMsg('Sucesso! Redirecionando para login...');
        setTimeout(() => router.push('/login'), 2000);
      } else {
        setErro(true);
        setMsg(data.message || 'Erro ao cadastrar.');
      }
    } catch (err) {
      setErro(true);
      setMsg('Erro de conexão com o servidor.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Crie sua conta</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Nome Completo</label>
            <input 
              type="text" 
              name="nome" 
              value={form.nome} 
              onChange={handleChange} 
              className="w-full p-2 border rounded border-gray-300 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
            <input 
              type="email" 
              name="email" 
              value={form.email} 
              onChange={handleChange} 
              className="w-full p-2 border rounded border-gray-300 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Senha</label>
            <input 
              type="password" 
              name="senha" 
              value={form.senha} 
              onChange={handleChange} 
              className="w-full p-2 border rounded border-gray-300 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded transition duration-200"
          >
            Cadastrar Agora
          </button>
        </form>

        {msg && (
          <p className={`mt-4 text-center text-sm font-medium ${erro ? 'text-red-500' : 'text-green-500'}`}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}