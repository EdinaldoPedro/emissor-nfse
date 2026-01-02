'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Import para links

export default function Login() {
  const router = useRouter();
  // Mudamos de 'email' para 'login'
  const [form, setForm] = useState({ login: '', senha: '' });
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

      localStorage.removeItem('isSupportMode'); 
      localStorage.removeItem('adminBackUpId');

      localStorage.setItem('userId', dados.id); 
      localStorage.setItem('userRole', dados.role);

      if (dados.role === 'ADMIN' || dados.role === 'MASTER' || dados.role === 'SUPORTE') {
        router.push('/admin/dashboard');
      } else if (dados.role === 'CONTADOR') {
        router.push('/contador'); // <--- NOVA ROTA
      } else {
        router.push('/cliente/dashboard');
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Email ou CPF</label>
            <input
              type="text"
              required
              placeholder="seu@email.com ou 000.000.000-00"
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
              value={form.login}
              onChange={(e) => setForm({...form, login: e.target.value})}
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Senha</label>
                {/* BOTÃO ESQUECI MINHA SENHA */}
                <button 
                    type="button" 
                    onClick={() => alert('Em breve: Funcionalidade de recuperação de senha via email.')}
                    className="text-xs text-blue-600 hover:underline"
                >
                    Esqueceu a senha?
                </button>
            </div>
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
          Não tem conta? <Link href="/cadastro" className="text-blue-600 hover:underline">Cadastre-se</Link>
        </p>
      </div>
    </div>
  );
}