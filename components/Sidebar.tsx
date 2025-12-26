'use client';

import { useState, useEffect } from 'react';
import { Menu, X, User, Briefcase, FileText, Settings, LogOut, Phone, Shield } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { checkIsStaff } from '@/app/utils/permissions';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [userRole, setUserRole] = useState('');
  const router = useRouter();

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');
    
    if (role) setUserRole(role);

    const fetchUser = async () => {
        if(userId) {
            try {
                const res = await fetch('/api/perfil', { headers: {'x-user-id': userId}});
                if(res.ok) setUserData(await res.json());
            } catch (error) {
                console.error("Erro ao buscar perfil", error);
            }
        }
    };

    if (isOpen) fetchUser();
  }, [isOpen]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)} 
        className="p-2 hover:bg-gray-100 rounded-lg transition"
      >
        <Menu size={28} className="text-gray-700" />
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ESTRUTURA DO MENU (Flex Column)
          - h-full: Ocupa toda altura
          - flex flex-col: Organiza verticalmente
      */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        
        {/* CABEÇALHO (Fixo no topo) */}
        <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white shrink-0">
          <h2 className="font-bold text-lg">Configurações</h2>
          <button onClick={() => setIsOpen(false)} className="hover:bg-blue-700 p-1 rounded">
            <X size={24} />
          </button>
        </div>

        {/* CORPO (Rolagem Aqui) 
            - flex-1: Ocupa o espaço restante
            - overflow-y-auto: Permite rolar apenas esta área
        */}
        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
              <User size={14} /> Minha Conta
            </h3>
            <div className="space-y-3 text-sm">
              <p><span className="font-medium text-gray-700">Nome:</span> {userData?.nome || '...'}</p>
              <p><span className="font-medium text-gray-700">Email:</span> {userData?.email || '...'}</p>
              <p><span className="font-medium text-gray-700">CPF:</span> {userData?.cpf || 'Não informado'}</p>
              <p><span className="font-medium text-gray-700">Plano:</span> <span className="text-green-600 font-bold">{userData?.plano?.tipo || 'Gratuito'}</span></p>
              <Link href="/configuracoes/minha-conta" onClick={() => setIsOpen(false)} className="text-blue-600 hover:underline text-xs block mt-2">
                Editar Dados Pessoais
              </Link>
            </div>
          </section>

          <hr />

          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
              <Briefcase size={14} /> Minha Empresa (MEI)
            </h3>
            <div className="space-y-3 text-sm">
              <p><span className="font-medium text-gray-700">Razão Social:</span> {userData?.razaoSocial || '...'}</p>
              <p><span className="font-medium text-gray-700">CNPJ:</span> {userData?.documento || 'Não informado'}</p>
              <p><span className="font-medium text-gray-700">Certificado:</span> <span className="text-red-500">Pendente</span></p>
              <Link href="/configuracoes" onClick={() => setIsOpen(false)} className="text-blue-600 hover:underline text-xs block mt-2">
                Completar Cadastro PJ
              </Link>
            </div>
          </section>

          <hr />

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

          <hr />

          {checkIsStaff(userRole) && (
             <section>
                <h3 className="text-xs font-bold text-purple-600 uppercase mb-4 flex items-center gap-2">
                  <Shield size={14} /> Acesso Interno
                </h3>
                <Link 
                  href="/admin/dashboard" 
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 text-purple-700 bg-purple-50 hover:bg-purple-100 p-3 rounded border border-purple-200 font-bold transition"
                >
                    <Shield size={18} /> Acessar Painel Admin
                </Link>
             </section>
          )}

        </div>

        {/* RODAPÉ (Fixo no fundo) */}
        <div className="bg-gray-50 p-4 border-t space-y-2 shrink-0">
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