'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Database, Shield, List, LogOut, MapPin, CreditCard } from 'lucide-react'; 
import Link from 'next/link';
import { checkIsStaff } from '@/app/utils/permissions';


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    
    // VERIFICAÇÃO ATUALIZADA:
    // Permite qualquer role que esteja na lista de STAFF
    if (!checkIsStaff(role)) {
      router.push('/login');
    } else {
      setAuthorized(true);
    }
  }, [router]);

  if (!authorized) return null;

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: Users, label: 'Clientes (Usuários SaaS)', href: '/admin/usuarios' }, 
    { icon: Database, label: 'Empresas (Base de Dados)', href: '/admin/empresas' }, 
    { icon: Shield, label: 'Colaboradores (Time)', href: '/admin/colaboradores' }, 
    { icon: List, label: 'Configurações', href: '/admin/configuracoes' },
    { icon: List, label: 'Tabela CNAEs', href: '/admin/cnaes' },
    { icon: MapPin, label: 'Trib. Municipal', href: '/admin/tributacao-municipal' },
    { icon: CreditCard, label: 'Planos & Preços', href: '/admin/planos' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
        {/* ... (Mantenha o restante do JSX igual, sem mudanças) ... */}
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

            <div className="p-4 border-t border-slate-800 space-y-2">
                {/* BOTÃO PARA VOLTAR AO MODO CLIENTE (SE O ADMIN TIVER EMPRESA) */}
                <Link href="/cliente/dashboard" className="flex items-center gap-3 px-4 py-3 text-blue-300 hover:bg-blue-900/30 rounded-lg w-full transition-colors border border-dashed border-blue-800">
                    <LayoutDashboard size={20} /> Área do Cliente
                </Link>

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