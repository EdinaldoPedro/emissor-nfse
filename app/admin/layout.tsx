'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// Adicionamos novos ícones: Users (Clientes), Database (Empresas), Shield (Colaboradores), List (CNAE)
import { LayoutDashboard, Users, Database, Shield, List, LogOut } from 'lucide-react'; 
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role !== 'ADMIN') {
      router.push('/login');
    } else {
      setAuthorized(true);
    }
  }, [router]);

  if (!authorized) return null;

  // --- AQUI ESTÁ A NOVA ESTRUTURA DO MENU ---
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: Users, label: 'Clientes (Usuários SaaS)', href: '/admin/usuarios' }, // Gestão de contrato/acesso
    { icon: Database, label: 'Empresas (Base de Dados)', href: '/admin/empresas' }, // Espelho do BD para edição bruta
    { icon: Shield, label: 'Colaboradores (Time)', href: '/admin/colaboradores' }, // Admins e Suporte
    { icon: List, label: 'Tabela CNAEs', href: '/admin/cnaes' }, // Nova opção
    { icon: List, label: 'Configurações', href: '/admin/configuracoes' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full shadow-xl z-20">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Shield size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Admin</h1>
            <p className="text-xs text-slate-400">Master Access</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-all font-medium"
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => { localStorage.clear(); router.push('/login'); }}
            className="flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-900/20 rounded-lg w-full transition-colors"
          >
            <LogOut size={20} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}