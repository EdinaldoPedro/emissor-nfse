'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const resposta = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        setError(dados.error || 'Erro ao fazer login');
        setLoading(false);
        return;
      }

      // Salva ID e Role no navegador
      localStorage.setItem('userId', dados.id); 
      localStorage.setItem('userRole', dados.role); // <--- IMPORTANTE

      // Redirecionamento Correto
      if (dados.role === 'ADMIN') {
        router.push('/admin/dashboard'); // Vai para a área VIP
      } else {
        router.push('/cliente/dashboard'); // Vai para a área comum
      }

    } catch (err) {
      setError('Ocorreu um erro inesperado.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Acessar Sistema</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
              value={form.email}
              onChange={(e) => setForm({...form, email: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              required
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
              value={form.senha}
              onChange={(e) => setForm({...form, senha: e.target.value})}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition font-medium disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        
        <p className="mt-4 text-center text-sm text-gray-600">
          Não tem conta? <a href="/cadastro" className="text-blue-600 hover:underline">Cadastre-se</a>
        </p>
      </div>
    </div>
  );
}