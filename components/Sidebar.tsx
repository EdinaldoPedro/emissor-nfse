'use client';

import { useState, useEffect } from 'react';
import { Menu, X, User, Briefcase, FileText, Settings, LogOut, Phone } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const router = useRouter();

  // Busca dados básicos para mostrar no menu
  useEffect(() => {
    const fetchUser = async () => {
        const userId = localStorage.getItem('userId');
        if(userId) {
            const res = await fetch('/api/perfil', { headers: {'x-user-id': userId}});
            if(res.ok) setUserData(await res.json());
        }
    };
    if (isOpen) fetchUser(); // Só busca quando abre o menu
  }, [isOpen]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <>
      {/* Botão de 3 traços (Hamburger) */}
      <button 
        onClick={() => setIsOpen(true)} 
        className="p-2 hover:bg-gray-100 rounded-lg transition"
      >
        <Menu size={28} className="text-gray-700" />
      </button>

      {/* Fundo Escuro (Overlay) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* O Menu Deslizante */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} overflow-y-auto`}>
        
        {/* Cabeçalho do Menu */}
        <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
          <h2 className="font-bold text-lg">Configurações</h2>
          <button onClick={() => setIsOpen(false)} className="hover:bg-blue-700 p-1 rounded">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* 1. DADOS DA CONTA */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
              <User size={14} /> Minha Conta
            </h3>
            <div className="space-y-3 text-sm">
              <p><span className="font-medium text-gray-700">Nome:</span> {userData?.nome || '...'}</p>
              <p><span className="font-medium text-gray-700">Email:</span> {userData?.email || '...'}</p>
              <p><span className="font-medium text-gray-700">CPF:</span> {userData?.cpf || 'Não informado'}</p>
              <p><span className="font-medium text-gray-700">Plano:</span> <span className="text-green-600 font-bold">{userData?.plano || 'Gratuito'}</span></p>
              <Link href="/configuracoes/minha-conta" className="text-blue-600 hover:underline text-xs block mt-2">
                Editar Dados Pessoais
              </Link>
            </div>
          </section>

          <hr />

          {/* 2. DADOS DA PJ (EMPRESA) */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
              <Briefcase size={14} /> Minha Empresa (MEI)
            </h3>
            <div className="space-y-3 text-sm">
              <p><span className="font-medium text-gray-700">Razão Social:</span> {userData?.razaoSocial || '...'}</p>
              <p><span className="font-medium text-gray-700">CNPJ:</span> {userData?.documento || 'Não informado'}</p>
              <p><span className="font-medium text-gray-700">CNAE:</span> {userData?.cnaePrincipal || '...'}</p>
              <p><span className="font-medium text-gray-700">Certificado:</span> <span className="text-red-500">Pendente</span></p>
              
              <Link href="/configuracoes" className="text-blue-600 hover:underline text-xs block mt-2">
                Completar Cadastro PJ
              </Link>
            </div>
          </section>

          <hr />

          {/* 3. GESTÃO */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
              <Settings size={14} /> Gestão
            </h3>
            <div className="flex flex-col gap-3">
                <Link href="/cliente" onClick={() => setIsOpen(false)} className="flex items-center gap-2 text-gray-700 hover:bg-gray-50 p-2 rounded">
                    <FileText size={18} /> Meus Clientes
                </Link>
                <Link href="/relatorios" onClick={() => setIsOpen(false)} className="flex items-center gap-2 text-gray-700 hover:bg-gray-50 p-2 rounded opacity-50 cursor-not-allowed">
                    <FileText size={18} /> Relatórios (Em breve)
                </Link>
            </div>
          </section>

        </div>

        {/* Rodapé do Menu */}
        <div className="absolute bottom-0 w-full bg-gray-50 p-4 border-t space-y-2">
            <button className="flex items-center gap-2 text-gray-600 hover:text-blue-600 w-full p-2 text-sm">
                <Phone size={16} /> Suporte
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 text-red-500 hover:text-red-700 w-full p-2 text-sm font-medium">
                <LogOut size={16} /> Sair do Sistema
            </button>
        </div>

      </div>
    </>
  );
}