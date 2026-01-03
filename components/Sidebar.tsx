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
  const [isContador, setIsContador] = useState(false);
  const [notificacoes, setNotificacoes] = useState(0); 

  const router = useRouter();

  useEffect(() => {
    // Pega dados do localStorage (pode ser o ID real ou o do cliente que estamos "espiando")
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('userRole');
    
    if (role) {
        setUserRole(role);
        setIsContador(role === 'CONTADOR');
    }

    const fetchData = async () => {
        if(userId) {
            try {
                const contextId = localStorage.getItem('empresaContextId');
                
                // 1. Dados do Usuário
                const res = await fetch('/api/perfil', { 
                    headers: { 'x-user-id': userId, 'x-empresa-id': contextId || '' }
                });
                if(res.ok) setUserData(await res.json());

                // 2. Notificações (Só busca se NÃO for staff/admin)
                // Se estiver no "Modo Suporte", o role no localStorage é do cliente, então entra aqui.
                if (!checkIsStaff(role)) {
                    // CORREÇÃO AQUI: Mudado de '/api/cliente/...' para '/api/clientes/...'
                    const resNotif = await fetch('/api/clientes/notificacoes', {
                        headers: { 'x-user-id': userId }
                    });
                    if (resNotif.ok) {
                        const dataNotif = await resNotif.json();
                        setNotificacoes(dataNotif.count || 0);
                    }
                }
            } catch (error) { console.error("Erro sidebar", error); }
        }
    };

    if (isOpen) fetchData(); // Busca ao abrir o menu
    fetchData(); // Busca ao carregar a página também

  }, [isOpen]); 

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  const getStatusCertificado = () => {
    if (!userData?.temCertificado) return { label: 'Pendente', classes: 'text-red-500' };
    if (!userData.vencimentoCertificado) return { label: 'Ativo', classes: 'text-green-600' };
    const hoje = new Date();
    const vencimento = new Date(userData.vencimentoCertificado);
    const diffTime = vencimento.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: 'Vencido', classes: 'text-red-600 font-bold' };
    if (diffDays <= 30) return { label: 'A Vencer', classes: 'text-amber-600 font-bold' };
    return { label: 'Válido', classes: 'text-green-600' };
  };

  const statusCert = getStatusCertificado();
  const showAdminPanel = checkIsStaff(userRole) && userRole !== 'CONTADOR';

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)} 
        className="p-2 hover:bg-gray-100 rounded-lg transition relative"
      >
        <Menu size={28} className="text-gray-700" />
        
        {/* BALÃOZINHO NO ÍCONE HAMBÚRGUER */}
        {notificacoes > 0 && (
            <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        
        <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white shrink-0">
          <h2 className="font-bold text-lg">Menu</h2>
          <button onClick={() => setIsOpen(false)} className="hover:bg-blue-700 p-1 rounded">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
              <User size={14} /> Minha Conta
            </h3>
            <div className="space-y-3 text-sm">
              <p><span className="font-medium text-gray-700">Nome:</span> {userData?.nome || '...'}</p>
              <p><span className="font-medium text-gray-700">Email:</span> {userData?.email || '...'}</p>
              
              {!isContador && (
                  <p><span className="font-medium text-gray-700">Plano:</span> <span className="text-green-600 font-bold">{userData?.plano?.tipo || 'Gratuito'}</span></p>
              )}
              
              <Link href="/configuracoes/minha-conta" onClick={() => setIsOpen(false)} className="text-blue-600 hover:underline text-xs block mt-2">
                Editar Dados Pessoais
              </Link>
            </div>
          </section>

          <hr />

          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 flex items-center gap-2">
              <Briefcase size={14} /> Minha Empresa
            </h3>
            <div className="space-y-3 text-sm">
              <p>
                  <span className="font-medium text-gray-700 block mb-1">Razão Social:</span> 
                  <span className="text-gray-500 leading-tight">{userData?.razaoSocial || '...'}</span>
              </p>
              <p>
                  <span className="font-medium text-gray-700">CNPJ:</span> 
                  <span className="text-gray-500 ml-1">{userData?.documento || 'Não informado'}</span>
              </p>
              <p>
                  <span className="font-medium text-gray-700">Certificado:</span>{' '}
                  <span className={statusCert.classes}>{statusCert.label}</span>
              </p>
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

          {showAdminPanel && (
             <section>
                <hr className="mb-6"/>
                <h3 className="text-xs font-bold text-purple-600 uppercase mb-4 flex items-center gap-2">
                  <Shield size={14} /> Admin
                </h3>
                <Link href="/admin/dashboard" onClick={() => setIsOpen(false)} className="flex items-center gap-2 text-purple-700 bg-purple-50 hover:bg-purple-100 p-3 rounded border border-purple-200 font-bold transition">
                    <Shield size={18} /> Acessar Painel Admin
                </Link>
             </section>
          )}

        </div>

        <div className="bg-gray-50 p-4 border-t space-y-2 shrink-0">
            {/* O BOTÃO DE SUPORTE COM BALÃO DE NOTIFICAÇÃO */}
            <Link href="/cliente/suporte" onClick={() => setIsOpen(false)} className="flex items-center justify-between text-gray-600 hover:text-blue-600 w-full p-2 text-sm transition">
                <div className="flex items-center gap-2">
                    <Phone size={16} /> Suporte Técnico
                </div>
                {notificacoes > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                        {notificacoes}
                    </span>
                )}
            </Link>
            
            <button onClick={handleLogout} className="flex items-center gap-2 text-red-500 hover:text-red-700 w-full p-2 text-sm font-medium transition">
                <LogOut size={16} /> Sair do Sistema
            </button>
        </div>

      </div>
    </>
  );
}