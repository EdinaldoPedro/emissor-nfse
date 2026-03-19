'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, Users, Building, Shield, Activity, 
  LogOut, MapPin, List, LifeBuoy, CreditCard, Settings, Map, Briefcase // <--- 1. Importado Briefcase para o CRM
} from 'lucide-react'; 
import Link from 'next/link';
import { checkIsStaff } from '@/app/utils/permissions';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (!checkIsStaff(role)) {
      router.push('/login');
    } else {
      setAuthorized(true);
    }
  }, [router]);

  if (!authorized) return null;

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
    
    // === NOVO: MÓDULO DE CRM E NEGÓCIOS ===
    { icon: Briefcase, label: 'CRM / Clientes', href: '/admin/crm' }, 
    
    // Gestão do Negócio
    { icon: CreditCard, label: 'Planos e Pacotes', href: '/admin/planos' },
    { icon: Activity, label: 'Central de Emissões', href: '/admin/emissoes' }, 
    
    // Sistema (Antigo "Usuários")
    { icon: Users, label: 'Configurar Contas', href: '/admin/usuarios' },
    
    // Cadastros Técnicos
    { icon: Building, label: 'Base de Empresas', href: '/admin/empresas' }, 
    { icon: List, label: 'Tabela CNAEs', href: '/admin/cnaes' },
    { icon: MapPin, label: 'Trib. Municipal', href: '/admin/tributacao-municipal' },
    { icon: Map, label: 'Mapa de Cobertura', href: '/admin/cobertura' },
    
    // Suporte
    { icon: LifeBuoy, label: 'Helpdesk / Suporte', href: '/admin/suporte' },

    // Time
    { icon: Shield, label: 'Colaboradores', href: '/admin/colaboradores' }, 

    // Configurações
    { icon: Settings, label: 'Configurações', href: '/admin/configuracoes' },
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

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
                {menuItems.map((item) => (
                    <Link 
                    key={item.href} 
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-medium ${
                        item.href === '/admin/crm' 
                            ? 'bg-purple-900/50 text-purple-300 border border-purple-800/50 hover:bg-purple-800/50' // Destaque visual para o CRM
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                    >
                    <item.icon size={20} />
                    {item.label}
                    </Link>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-800 space-y-2">
                <Link href="/cliente/dashboard" className="flex items-center gap-3 px-4 py-3 text-blue-300 hover:bg-blue-900/30 rounded-lg w-full transition-colors border border-dashed border-blue-800">
                    <LayoutDashboard size={20} /> Área do Cliente
                </Link>

                <button 
                    onClick={() => { localStorage.clear(); router.push('/'); }} // <--- ALTERADO AQUI
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