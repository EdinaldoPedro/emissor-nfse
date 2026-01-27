'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogOut, ArrowLeftCircle } from 'lucide-react'; // Ícone novo
import AppTour from '@/components/AppTour';

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const [isSupport, setIsSupport] = useState(false);
  const [isContadorContext, setIsContadorContext] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsSupport(localStorage.getItem('isSupportMode') === 'true');
    setIsContadorContext(!!localStorage.getItem('empresaContextId')); 
  }, []);

  const sairDoSuporte = () => {
    // 1. Recupera o ID original
    const adminId = localStorage.getItem('adminBackUpId');
    
    if (adminId) {
        // 2. Restaura a identidade do Admin
        localStorage.setItem('userId', adminId);
        
        // Dica: Se o seu sistema usa 'userRole' para menu, restaure também se possível, 
        // ou force um refresh para o backend enviar os dados novos.
        // Por segurança, removemos as flags de "falso cliente"
        localStorage.removeItem('adminBackUpId');
        localStorage.removeItem('isSupportMode');
        localStorage.removeItem('empresaContextId'); 
        
        // 3. Força a ida para o painel admin
        window.location.href = '/admin/usuarios'; // Use window.location para forçar refresh limpo
    } else {
        // Se perdeu o backup, infelizmente tem que relogar
        router.push('/login');
    }
  };

  // --- NOVA FUNÇÃO: Sair do modo de acesso do contador ---
  const sairDoContextoContador = () => {
      localStorage.removeItem('empresaContextId'); // Limpa o contexto
      router.push('/contador'); // Volta para a lista de empresas
  };

  return (
    <div className={`min-h-screen ${isSupport ? 'bg-amber-50 border-4 border-amber-400' : ''} ${isContadorContext ? 'border-t-4 border-purple-600' : ''}`}>
      
      {/* --- TUTORIAL INSERIDO AQUI --- */}
      <AppTour />

      {/* BARRA DE AVISO FLUTUANTE - SUPORTE */}
      {isSupport && (
        <div className="bg-amber-500 text-white p-2 px-6 flex justify-between items-center sticky top-0 z-50 shadow-lg">
          <span className="font-bold text-sm">🕵️ MODO SUPORTE ATIVO (Visualizando como cliente)</span>
          <button 
            onClick={sairDoSuporte}
            className="bg-white text-amber-600 px-4 py-1 rounded text-xs font-bold hover:bg-amber-50"
          >
            VOLTAR AO ADMIN
          </button>
        </div>
      )}

      {/* BARRA DE AVISO FLUTUANTE - CONTADOR */}
      {isContadorContext && (
        <div className="bg-purple-600 text-white p-2 px-6 flex justify-between items-center sticky top-0 z-50 shadow-lg animate-in slide-in-from-top">
          <div className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-purple-200"/>
              <span className="font-bold text-sm">Acesso Contador</span>
              <span className="text-xs text-purple-200 hidden md:inline"> | Você está visualizando os dados do seu cliente.</span>
          </div>
          <button 
            onClick={sairDoContextoContador}
            className="bg-white text-purple-600 px-4 py-1 rounded text-xs font-bold hover:bg-purple-50 flex items-center gap-2 transition"
          >
            <LogOut size={14}/> Sair / Trocar Empresa
          </button>
        </div>
      )}

      {children}
    </div>
  );
}