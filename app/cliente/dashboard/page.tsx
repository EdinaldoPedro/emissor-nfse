'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ClienteDashboard() {
  const router = useRouter();
  const [nomeUsuario, setNomeUsuario] = useState('');

  useEffect(() => {
    // Recupera o nome se estiver salvo (opcional, só visual)
    const storedName = localStorage.getItem('userName'); 
    if(storedName) setNomeUsuario(storedName);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <header className="flex justify-between items-center mb-8 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Painel do Cliente</h1>
          <p className="text-gray-500">Bem-vindo, {nomeUsuario || 'Empreendedor'}!</p>
        </div>
        <div className="flex gap-4 items-center">
          <Link 
            href="/configuracoes" 
            className="text-gray-600 hover:text-blue-600 font-medium text-sm flex items-center gap-1"
          >
            ⚙️ Minha Empresa
          </Link>
          <button onClick={handleLogout} className="text-red-500 text-sm hover:underline">
            Sair
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Botão de Emitir Nota - AGORA É UM LINK */}
        <Link href="/emitir">
          <div className="p-6 border rounded-lg bg-blue-50 hover:bg-blue-100 cursor-pointer transition shadow-sm h-full">
            <h2 className="text-xl font-bold text-blue-700 mb-2">🚀 Emitir Nova Nota</h2>
            <p className="text-sm text-blue-600">Clique aqui para preencher e gerar uma NFS-e.</p>
          </div>
        </Link>

        {/* Botão de Histórico (Aponta para clientes por enquanto ou notas futuras) */}
        <Link href="/cliente"> 
          <div className="p-6 border rounded-lg hover:bg-gray-50 cursor-pointer transition shadow-sm h-full">
            <h2 className="text-xl font-bold text-gray-700 mb-2">👥 Meus Clientes</h2>
            <p className="text-sm text-gray-500">Gerencie sua lista de tomadores de serviço.</p>
          </div>
        </Link>
      </div>
      
      {/* Aviso para completar cadastro */}
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800 text-sm">
          <strong>Atenção:</strong> Antes de emitir sua primeira nota, vá em <Link href="/configuracoes" className="underline font-bold">Minha Empresa</Link> e complete seus dados (CNPJ/CPF).
        </p>
      </div>
    </div>
  );
}