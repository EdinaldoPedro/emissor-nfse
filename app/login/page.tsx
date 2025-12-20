'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() { // <--- O "export default" é o que estava faltando/quebrando
  const router = useRouter();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    // Aqui faremos a lógica de login real depois
    console.log('Login tentado:', form);
    router.push('/dashboard'); 
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm p-6 bg-white rounded shadow-md">
        <h1 className="text-2xl font-bold mb-4 text-center">Entrar</h1>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Seu email"
            className="w-full p-2 border rounded"
            value={form.email}
            onChange={(e) => setForm({...form, email: e.target.value})}
          />
          <input
            type="password"
            placeholder="Sua senha"
            className="w-full p-2 border rounded"
            value={form.senha}
            onChange={(e) => setForm({...form, senha: e.target.value})}
          />
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
            Acessar
          </button>
        </form>
      </div>
    </div>
  );
}