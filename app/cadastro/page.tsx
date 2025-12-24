'use client'; 

import { useState } from 'react';
import { useRouter } from 'next/navigation'; 
// CORREÇÃO AQUI: Adicionei '/app' no caminho
import { validarCPF } from '@/app/utils/cpf'; 

export default function Cadastro() {
  const router = useRouter();
  const [form, setForm] = useState({ nome: '', email: '', senha: '', cpf: '' });
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState(false);
  const [cpfInvalido, setCpfInvalido] = useState(false);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');

    setForm({ ...form, cpf: value });
    if (cpfInvalido) setCpfInvalido(false);
  };

  const handleBlurCpf = () => {
    if (form.cpf && !validarCPF(form.cpf)) {
        setCpfInvalido(true);
    } else {
        setCpfInvalido(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validarCPF(form.cpf)) {
        setErro(true);
        setMsg('Corrija o CPF antes de continuar.');
        setCpfInvalido(true);
        return;
    }

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
            <label className="block text-gray-700 text-sm font-bold mb-2">CPF</label>
            <input 
              type="text" 
              name="cpf" 
              value={form.cpf} 
              onChange={handleCpfChange} 
              onBlur={handleBlurCpf} 
              placeholder="000.000.000-00"
              className={`w-full p-2 border rounded focus:outline-none ${cpfInvalido ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-gray-300 focus:border-blue-500'}`}
              required
            />
            {cpfInvalido && <p className="text-xs text-red-500 mt-1">CPF inválido.</p>}
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